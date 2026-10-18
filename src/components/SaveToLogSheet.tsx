// "Save to Log": put the current Spots' new Readings into a new Sample or an existing one.
import * as React from "react"
import { SampleForm } from "@/components/SampleForm"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  depthText,
  emptyDraft,
  fieldsOf,
  locationSetting,
  problemWith,
  setLocationSetting,
  type Sample,
  type SampleFields,
} from "@/lib/log"

export type SaveTarget = { sampleId: string } | { fields: SampleFields }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Spots not yet in the Log, and Spots of this Photo that already are. */
  newCount: number
  savedCount: number
  samples: Sample[]
  /** Resolves to a problem to show, or nothing when saved. Rejects when the Log could not be written. */
  onSave: (target: SaveTarget, withLocation: boolean) => Promise<string | void>
}

const NEW = "new"
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

function SaveForm({
  newCount,
  samples,
  onSave,
  onDone,
}: Pick<Props, "newCount" | "samples" | "onSave"> & { onDone: () => void }) {
  const [choice, setChoice] = React.useState(NEW)
  const [draft, setDraft] = React.useState(emptyDraft)
  const [withLocation, setWithLocation] = React.useState(locationSetting)
  const [problem, setProblem] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const existing = samples.find((s) => s.id === choice)
  // A save outlives the form when it is cancelled. Its late answer must not touch a newer sheet.
  const open = React.useRef(true)
  React.useEffect(() => {
    open.current = true
    return () => {
      open.current = false
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const invalid = existing ? null : problemWith(draft)
    if (invalid) return setProblem(invalid)
    setProblem(null)
    setSaving(true)
    try {
      const refused = await onSave(existing ? { sampleId: existing.id } : { fields: fieldsOf(draft) }, withLocation)
      if (!open.current) return
      if (refused) {
        setProblem(refused)
        setChoice(NEW)
        setSaving(false)
      } else {
        onDone()
      }
    } catch {
      if (!open.current) return
      setProblem("The Log could not be written on this device. Try again.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 overflow-y-auto px-4 pb-6" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="save-target">Add to</Label>
        <select
          id="save-target"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value={NEW}>New Sample</option>
          {[...samples].reverse().map((s) => (
            <option key={s.id} value={s.id}>
              {[s.name, depthText(s), s.condition].filter(Boolean).join(", ")}
            </option>
          ))}
        </select>
      </div>

      {existing ? (
        <p className="text-sm text-muted-foreground">
          {plural(existing.readings.length, "Reading")} in this Sample so far. Change its name, depth
          or notes in the Log.
        </p>
      ) : (
        <>
          <SampleForm idPrefix="new" draft={draft} onChange={setDraft} />
          <div className="flex items-start gap-3">
            <Switch
              id="save-location"
              checked={withLocation}
              onCheckedChange={(on) => {
                setWithLocation(on)
                setLocationSetting(on)
              }}
              className="mt-0.5"
            />
            <div className="grid gap-0.5">
              <Label htmlFor="save-location">Save my location with this Sample</Label>
              <p className="text-sm text-muted-foreground">
                Off unless you switch it on. It is read once, when you save, and stays on this
                device.
              </p>
            </div>
          </div>
        </>
      )}

      {problem && (
        <p role="alert" className="rounded-md border-2 border-foreground p-3 text-sm font-medium">
          {problem}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={saving}>
        {saving ? "Saving..." : `Save ${plural(newCount, "Reading")}`}
      </Button>
      <Button type="button" variant="outline" size="lg" className="h-12 text-base" onClick={onDone}>
        Cancel
      </Button>
    </form>
  )
}

export function SaveToLogSheet({ open, onOpenChange, savedCount, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92svh] rounded-t-xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>Save to Log</SheetTitle>
          <SheetDescription>
            {plural(rest.newCount, "new Reading")} from this Photo
            {savedCount > 0 && `, ${savedCount} already saved`}.
          </SheetDescription>
        </SheetHeader>
        <SaveForm {...rest} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}
