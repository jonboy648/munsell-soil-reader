// The Log's way into the page: Save to Log, Open Log, and the Log's own state. The Samples
// load from the device once and are kept in step with every write.
import * as React from "react"
import type { Card, ReadPhotoResult } from "@/engine"
import { LogScreen } from "@/components/LogScreen"
import { SaveToLogSheet, type SaveTarget } from "@/components/SaveToLogSheet"
import { Button } from "@/components/ui/button"
import { currentLocation, savedReadings, type Sample } from "@/lib/log"
import { deleteSample, listSamples, putSample } from "@/lib/logStore"

interface Props {
  result: ReadPhotoResult | null
  card: Card | null
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export function LogPanel({ result, card }: Props) {
  const [samples, setSamples] = React.useState<Sample[]>([]) // oldest first
  const [saveOpen, setSaveOpen] = React.useState(false)
  const [logOpen, setLogOpen] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>(null)
  const [problem, setProblem] = React.useState<string | null>(null)

  React.useEffect(() => {
    listSamples()
      .then((saved) => setSamples([...saved].sort((a, b) => a.createdAt - b.createdAt)))
      .catch(() => setProblem("The Log can't be opened on this device, so nothing can be saved."))
  }, [])

  const change = async (sample: Sample) => {
    await putSample(sample)
    setSamples((all) =>
      all.some((s) => s.id === sample.id) ? all.map((s) => (s.id === sample.id ? sample : s)) : [...all, sample],
    )
  }
  const remove = async (id: string) => {
    await deleteSample(id)
    setSamples((all) => all.filter((s) => s.id !== id))
  }

  const save = async (target: SaveTarget, withLocation: boolean) => {
    if (!result || !card) return
    const readings = savedReadings(result, card)
    let sample: Sample
    let missingLocation = false
    if ("sampleId" in target) {
      const existing = samples.find((s) => s.id === target.sampleId)
      if (!existing) throw new Error("That Sample is gone")
      sample = { ...existing, readings: [...existing.readings, ...readings] }
    } else {
      // The only place the location is asked for, and only when the user has switched it on.
      const location = withLocation ? await currentLocation() : null
      missingLocation = withLocation && location === null
      sample = { id: crypto.randomUUID(), ...target.fields, location, createdAt: Date.now(), readings }
    }
    await change(sample)
    setStatus(
      `Saved ${plural(readings.length, "Reading")} to ${sample.name}.` +
        (missingLocation ? " The location was not available, so this Sample has none." : ""),
    )
  }

  const readingCount = samples.reduce((n, s) => n + s.readings.length, 0)
  const canSave = !!result && !!card && result.readings.length > 0
  return (
    <section aria-label="Log" className="grid gap-2">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Log</h2>
      <div className="flex gap-2">
        <Button
          size="lg"
          className="h-12 flex-1 text-base"
          disabled={!canSave}
          onClick={() => {
            setStatus(null)
            setSaveOpen(true)
          }}
        >
          Save to Log
        </Button>
        <Button variant="outline" size="lg" className="h-12 flex-1 text-base" onClick={() => setLogOpen(true)}>
          Open Log
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="log-summary">
        {readingCount === 0
          ? "Nothing in the Log yet."
          : `${plural(samples.length, "Sample")}, ${plural(readingCount, "Reading")} in the Log on this device.`}
        {!canSave && " Tap a Spot to get a Reading you can save."}
      </p>
      {status && (
        <p role="status" className="text-sm font-medium">
          {status}
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
        readingCount={result?.readings.length ?? 0}
        samples={samples}
        onSave={save}
      />
      <LogScreen open={logOpen} onOpenChange={setLogOpen} samples={samples} onChange={change} onRemove={remove} />
    </section>
  )
}
