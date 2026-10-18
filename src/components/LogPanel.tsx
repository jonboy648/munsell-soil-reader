// The Log's way into the page: Save to Log, Open Log, and the Log's own state. The Samples are
// read from the device and read again after every change, and whenever another tab or window
// changes them, so what is on screen is always what is stored.
import * as React from "react"
import type { Card, ReadPhotoResult, XY } from "@/engine"
import { LogScreen } from "@/components/LogScreen"
import { ProjectsSheet } from "@/components/ProjectsSheet"
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

/** A save that is waiting on the location or on the write. */
interface Attempt {
  spots: XY[]
  cancelled: boolean
  /** The write has started, so it is too late to cancel: the Reading will be saved. */
  writing: boolean
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

// The Reading written for each saved Spot. A Spot counts as saved while that Reading is still in
// the Log (deleting the Reading, or its Sample, in the Log or in another tab makes the Spot new
// again; Photos are not stored, so that Reading would otherwise be lost). Kept outside the
// component because the Method page unmounts the reader, and keyed by the Spot object: a new
// Photo, Start over and No Card all make new Spot objects, so nothing ever needs clearing.
const readingOfSpot = new WeakMap<XY, string>()

export function LogPanel({ result, card, spots }: Props) {
  const [samples, setSamples] = React.useState<Sample[]>([]) // oldest first
  const [saveOpen, setSaveOpen] = React.useState(false)
  const [logOpen, setLogOpen] = React.useState(false)
  const [projectsOpen, setProjectsOpen] = React.useState(false)
  // Spots a save is working on right now, so that nothing can save them a second time meanwhile.
  const [inFlight, setInFlight] = React.useState<XY[]>([])
  const saving = React.useRef<Attempt | null>(null)
  // What was just saved, shown only while the Spots are the ones it was saved from and the
  // Readings are still in the Log.
  const [status, setStatus] = React.useState<{ text: string; spots: XY[]; readingIds: string[] } | null>(null)
  const [problem, setProblem] = React.useState<string | null>(null)

  // Closing the Save sheet while it is still saving (Cancel, Back, Esc, the corner X) means
  // cancel: the save is dropped before it writes, and its Spots are free again at once.
  const setSaveSheet = React.useCallback((open: boolean) => {
    const attempt = saving.current
    if (!open && attempt && !attempt.writing) {
      attempt.cancelled = true
      setInFlight((all) => all.filter((spot) => !attempt.spots.includes(spot)))
    }
    setSaveOpen(open)
  }, [])
  useBackClosesSheet(saveOpen, setSaveSheet)
  useBackClosesSheet(logOpen, setLogOpen)
  useBackClosesSheet(projectsOpen, setProjectsOpen)

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

  const inLog = React.useMemo(() => new Set(samples.flatMap((s) => s.readings.map((r) => r.id))), [samples])
  const isSaved = (spot: XY) => {
    const readingId = readingOfSpot.get(spot)
    return inFlight.includes(spot) || (readingId !== undefined && inLog.has(readingId))
  }
  const newSpots = spots.map((_, i) => i).filter((i) => !isSaved(spots[i]))
  const savedCount = spots.length - newSpots.length
  // The sheet counts the Spots it is saving as new until the save is done.
  const sheetNew = newSpots.length + spots.filter((spot) => inFlight.includes(spot)).length

  const save = async (target: SaveTarget, withLocation: boolean): Promise<string | void> => {
    if (!result || !card) return
    const chosen = newSpots.map((i) => spots[i])
    const readings = savedReadings(result, card, newSpots)
    const attempt: Attempt = { spots: chosen, cancelled: false, writing: false }
    saving.current = attempt
    setInFlight((all) => [...all, ...chosen]) // before the first await
    try {
      let name: string
      let missingLocation = false
      if ("sampleId" in target) {
        if (attempt.cancelled) return
        attempt.writing = true
        const updated = await addReadings(target.sampleId, readings)
        if (!updated) {
          await refresh()
          return "That Sample was deleted in another window. Save to a new Sample instead."
        }
        name = updated.name
      } else {
        // The only place the location is asked for, and only when the user has switched it on.
        const location = withLocation ? await currentLocation() : null
        if (attempt.cancelled) return
        attempt.writing = true
        missingLocation = withLocation && location === null
        name = target.fields.name
        await addSample({ id: crypto.randomUUID(), ...target.fields, location, createdAt: Date.now(), readings })
      }
      askToKeepLog()
      chosen.forEach((spot, k) => readingOfSpot.set(spot, readings[k].id))
      await refresh()
      setStatus({
        text:
          `Saved ${plural(readings.length, "Reading")} to ${name}.` +
          (missingLocation ? " The location was not available, so this Sample has none." : ""),
        spots,
        readingIds: readings.map((r) => r.id),
      })
    } finally {
      if (saving.current === attempt) saving.current = null
      setInFlight((all) => all.filter((spot) => !chosen.includes(spot)))
    }
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
    <section aria-label="Log" className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Log</h2>
      <div className="flex gap-2">
        <Button size="lg" className="h-12 flex-1 text-base" disabled={!canSave} onClick={() => setSaveOpen(true)}>
          Save to Log
        </Button>
        <Button variant="outline" size="lg" className="h-12 flex-1 text-base" onClick={() => setLogOpen(true)}>
          Open Log
        </Button>
      </div>
      <Button variant="outline" size="lg" className="h-12 text-base" onClick={() => setProjectsOpen(true)}>
        Projects
      </Button>
      <p className="text-sm" data-testid="log-pending">
        {pending}
      </p>
      <p className="text-sm text-muted-foreground" data-testid="log-summary">
        {readingCount === 0
          ? "Nothing in the Log yet."
          : `${plural(samples.length, "Sample")}, ${plural(readingCount, "Reading")} in the Log on this device.`}
      </p>
      {status?.spots === spots && status.readingIds.some((id) => inLog.has(id)) && (
        <p role="status" className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
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
        onOpenChange={setSaveSheet}
        newCount={sheetNew}
        savedCount={spots.length - sheetNew}
        samples={samples}
        onSave={save}
      />
      <ProjectsSheet open={projectsOpen} onOpenChange={setProjectsOpen} />
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
