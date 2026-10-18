// The Log's way into the page: Save to Log, Open Log, and the Log's own state. The Samples are
// read from the device and read again after every change, and whenever another tab or window
// changes them, so what is on screen is always what is stored.
import * as React from "react"
import type { Card, ReadPhotoResult, XY } from "@/engine"
import { LogScreen } from "@/components/LogScreen"
import { SaveToLogSheet, type SaveTarget } from "@/components/SaveToLogSheet"
import { Button } from "@/components/ui/button"
import { currentLocation, savedReadings, type Sample } from "@/lib/log"
import {
  addReadings,
  addSample,
  askToKeepLog,
  deleteSample,
  listSamples,
  removeLocation,
  removeReading,
  updateFields,
  watchLog,
} from "@/lib/logStore"
import { useBackClosesSheet } from "@/lib/sheetHistory"

interface Props {
  result: ReadPhotoResult | null
  card: Card | null
  /** The Spots `result` was read from, in the same order. */
  spots: XY[]
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export function LogPanel({ result, card, spots }: Props) {
  const [samples, setSamples] = React.useState<Sample[]>([]) // oldest first
  const [saveOpen, setSaveOpen] = React.useState(false)
  const [logOpen, setLogOpen] = React.useState(false)
  // Spots already saved to the Log. A new Photo, Start over and No Card all make new Spot
  // objects, so nothing here needs clearing: a Spot is saved only if this very Spot was.
  const [saved, setSaved] = React.useState<XY[]>([])
  // What was just saved, good only while the Spots are the ones it was saved from.
  const [status, setStatus] = React.useState<{ text: string; spots: XY[] } | null>(null)
  const [problem, setProblem] = React.useState<string | null>(null)

  useBackClosesSheet(saveOpen, setSaveOpen)
  useBackClosesSheet(logOpen, setLogOpen)

  const refresh = React.useCallback(async () => {
    try {
      setSamples((await listSamples()).sort((a, b) => a.createdAt - b.createdAt))
      setProblem(null)
    } catch {
      setProblem("The Log can't be opened on this device, so nothing can be saved.")
    }
  }, [])
  React.useEffect(() => {
    void refresh()
    return watchLog(() => void refresh())
  }, [refresh])

  /** Writes to the Log, then reads it back. Rejects when the write fails. */
  const write = async (work: () => Promise<unknown>) => {
    await work()
    await refresh()
  }

  const newSpots = spots.map((_, i) => i).filter((i) => !saved.includes(spots[i]))
  const savedCount = spots.length - newSpots.length

  const save = async (target: SaveTarget, withLocation: boolean): Promise<string | void> => {
    if (!result || !card) return
    const readings = savedReadings(result, card, newSpots)
    let name: string
    let missingLocation = false
    if ("sampleId" in target) {
      const updated = await addReadings(target.sampleId, readings)
      if (!updated) {
        await refresh()
        return "That Sample was deleted in another window. Save to a new Sample instead."
      }
      name = updated.name
    } else {
      // The only place the location is asked for, and only when the user has switched it on.
      const location = withLocation ? await currentLocation() : null
      missingLocation = withLocation && location === null
      name = target.fields.name
      await addSample({ id: crypto.randomUUID(), ...target.fields, location, createdAt: Date.now(), readings })
    }
    askToKeepLog()
    setSaved((all) => [...all, ...newSpots.map((i) => spots[i])])
    setStatus({
      text:
        `Saved ${plural(readings.length, "Reading")} to ${name}.` +
        (missingLocation ? " The location was not available, so this Sample has none." : ""),
      spots,
    })
    await refresh()
  }

  const readingCount = samples.reduce((n, s) => n + s.readings.length, 0)
  const canSave = !!result && !!card && newSpots.length > 0
  const pending =
    spots.length === 0
      ? "Tap a Spot to get a Reading you can save."
      : newSpots.length === 0
        ? spots.length === 1
          ? "The Reading from this Photo is already saved."
          : `All ${spots.length} Readings from this Photo are already saved.`
        : `${plural(newSpots.length, "new Reading")} to save${savedCount > 0 ? `; ${savedCount} already saved` : ""}.`
  return (
    <section aria-label="Log" className="grid gap-2">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Log</h2>
      <div className="flex gap-2">
        <Button size="lg" className="h-12 flex-1 text-base" disabled={!canSave} onClick={() => setSaveOpen(true)}>
          Save to Log
        </Button>
        <Button variant="outline" size="lg" className="h-12 flex-1 text-base" onClick={() => setLogOpen(true)}>
          Open Log
        </Button>
      </div>
      <p className="text-sm" data-testid="log-pending">
        {pending}
      </p>
      <p className="text-sm text-muted-foreground" data-testid="log-summary">
        {readingCount === 0
          ? "Nothing in the Log yet."
          : `${plural(samples.length, "Sample")}, ${plural(readingCount, "Reading")} in the Log on this device.`}
      </p>
      {status?.spots === spots && (
        <p role="status" className="text-sm font-medium">
          {status.text}
        </p>
      )}
      {problem && (
        <p role="alert" className="rounded-md border-2 border-foreground p-3 text-sm font-medium">
          {problem}
        </p>
      )}
      <SaveToLogSheet
        open={saveOpen}
        onOpenChange={setSaveOpen}
        newCount={newSpots.length}
        savedCount={savedCount}
        samples={samples}
        onSave={save}
      />
      <LogScreen
        open={logOpen}
        onOpenChange={setLogOpen}
        samples={samples}
        onEdit={(id, fields) => write(() => updateFields(id, fields))}
        onRemoveReading={(id, readingId) => write(() => removeReading(id, readingId))}
        onRemoveLocation={(id) => write(() => removeLocation(id))}
        onDelete={(id) => write(() => deleteSample(id))}
      />
    </section>
  )
}
