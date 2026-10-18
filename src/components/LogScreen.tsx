// The Log screen: browse Samples and their Readings, edit a Sample's fields, delete a Reading
// or a Sample (after an in-page confirm), and export the lot as CSV.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { SampleForm } from "@/components/SampleForm"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  depthText,
  draftOf,
  fieldsOf,
  problemWith,
  type SampleDraft,
  type Sample,
  type SavedReading,
} from "@/lib/log"
import { downloadCsv } from "@/lib/logCsv"
import { shownReading } from "@/lib/verdict"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  samples: Sample[]
  /** Both reject when the Log could not be written. */
  onChange: (sample: Sample) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

const CARD_TEXT = { colorchecker: "ColorChecker", none: "No Card" }
const cardText = ({ card }: SavedReading) =>
  card.kind === "page" ? `Page ${card.hue ?? ""}`.trim() : CARD_TEXT[card.kind]
const CHECK_TEXT = { good: "Card check good", failed: "Card check failed", uncorrected: "Not corrected" }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })

/** Asks "Delete this?" in the page, in place of the button that started it. */
function Confirm({ what, onYes, onNo }: { what: string; onYes: () => void; onNo: () => void }) {
  return (
    <div
      role="group"
      aria-label={`Confirm: delete ${what}`}
      className="grid gap-2 rounded-md border-2 border-foreground p-3"
    >
      <p className="text-sm font-medium">Delete {what}? This cannot be undone.</p>
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1 text-base" onClick={onNo}>
          Keep
        </Button>
        <Button className="h-11 flex-1 text-base" onClick={onYes}>
          Yes, delete
        </Button>
      </div>
    </div>
  )
}

function Swatch({ rgb, label }: { rgb: [number, number, number]; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-block h-8 w-8 rounded-[3px] border border-foreground/25"
      style={{ background: `rgb(${rgb.join(",")})` }}
    />
  )
}

function ReadingItem({
  saved,
  confirming,
  ask,
  onRemove,
}: {
  saved: SavedReading
  confirming: boolean
  ask: (on: boolean) => void
  onRemove: () => void
}) {
  const { verdict, main } = shownReading(saved.reading, saved.cardCheck)
  return (
    <li data-testid="log-reading" className="grid gap-2 border-t border-border py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p data-testid="log-notation" className="font-mono text-2xl leading-none font-semibold tracking-tight">
            {main.chip.notation}
          </p>
          {main.chip.name && <p className="mt-1">{main.chip.name}</p>}
          <p className="mt-1 font-mono text-xs text-muted-foreground">exact {main.exact}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Swatch rgb={main.rgb} label="Soil color" />
          <Swatch rgb={main.chipRgb} label="Chip color" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {CHECK_TEXT[verdict]}
        {saved.cardCheck && ` ${saved.cardCheck.meanDE.toFixed(1)}`} · {cardText(saved)} · Spot at{" "}
        {Math.round(saved.reading.spot.x)}, {Math.round(saved.reading.spot.y)}
      </p>
      <p className="font-mono text-xs text-muted-foreground">
        Top 3: {main.top3.map(({ chip }) => chip.notation).join(", ")}
      </p>
      {saved.quality.map((w, i) => (
        <p key={i} className="text-sm">
          <b className="font-semibold">{w.kind}:</b> {w.advice}
        </p>
      ))}
      {confirming ? (
        <Confirm what="this Reading" onYes={onRemove} onNo={() => ask(false)} />
      ) : (
        <Button variant="outline" className="h-11 text-base" onClick={() => ask(true)}>
          Delete Reading
        </Button>
      )}
    </li>
  )
}

function SampleCard({ sample, onChange, onRemove }: Pick<Props, "onChange" | "onRemove"> & { sample: Sample }) {
  const [draft, setDraft] = React.useState<SampleDraft | null>(null) // set while editing
  const [confirming, setConfirming] = React.useState<string | null>(null) // "sample" or a Reading's id
  const [problem, setProblem] = React.useState<string | null>(null)

  const attempt = async (work: () => Promise<void>) => {
    setProblem(null)
    try {
      await work()
    } catch {
      setProblem("The Log could not be written on this device. Try again.")
    }
  }
  const saveEdit = () => {
    if (!draft) return
    const invalid = problemWith(draft)
    if (invalid) return setProblem(invalid)
    void attempt(async () => {
      await onChange({ ...sample, ...fieldsOf(draft) })
      setDraft(null)
    })
  }
  const removeReading = (id: string) =>
    attempt(async () => {
      await onChange({ ...sample, readings: sample.readings.filter((r) => r.id !== id) })
      setConfirming(null)
    })

  const meta = [depthText(sample), sample.condition, when(sample.createdAt)].filter(Boolean).join(" · ")
  return (
    <section
      aria-label={`Sample ${sample.name}`}
      data-testid="log-sample"
      className="grid gap-2 rounded-lg border border-border bg-card p-4"
    >
      {draft ? (
        <div className="grid gap-4">
          <SampleForm idPrefix={`edit-${sample.id}`} draft={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 flex-1 text-base"
              onClick={() => {
                setDraft(null)
                setProblem(null)
              }}
            >
              Cancel
            </Button>
            <Button className="h-11 flex-1 text-base" onClick={saveEdit}>
              Save changes
            </Button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="font-heading text-lg font-bold">{sample.name}</h3>
          <p className="text-sm text-muted-foreground">{meta}</p>
          {sample.location && (
            <p className="font-mono text-xs text-muted-foreground">
              {sample.location.lat.toFixed(5)}, {sample.location.lon.toFixed(5)} (within{" "}
              {Math.round(sample.location.accuracy)} m)
            </p>
          )}
          {sample.notes && <p className="text-sm whitespace-pre-wrap">{sample.notes}</p>}
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1 text-base" onClick={() => setDraft(draftOf(sample))}>
              Edit Sample
            </Button>
            {confirming !== "sample" && (
              <Button variant="outline" className="h-11 flex-1 text-base" onClick={() => setConfirming("sample")}>
                Delete Sample
              </Button>
            )}
          </div>
          {confirming === "sample" && (
            <Confirm
              what={`Sample ${sample.name} and its ${plural(sample.readings.length, "Reading")}`}
              onYes={() => attempt(() => onRemove(sample.id))}
              onNo={() => setConfirming(null)}
            />
          )}
          <p className="mt-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {plural(sample.readings.length, "Reading")}
          </p>
          <ul>
            {sample.readings.map((saved) => (
              <ReadingItem
                key={saved.id}
                saved={saved}
                confirming={confirming === saved.id}
                ask={(on) => setConfirming(on ? saved.id : null)}
                onRemove={() => removeReading(saved.id)}
              />
            ))}
          </ul>
        </>
      )}
      {problem && (
        <p role="alert" className="rounded-md border-2 border-foreground p-3 text-sm font-medium">
          {problem}
        </p>
      )}
    </section>
  )
}

export function LogScreen({ open, onOpenChange, samples, onChange, onRemove }: Props) {
  const readingCount = samples.reduce((n, s) => n + s.readings.length, 0)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 rounded-t-xl data-[side=bottom]:h-[96svh]">
        <SheetHeader className="pr-14">
          <SheetTitle>Log</SheetTitle>
          <SheetDescription>
            The Log lives only on this device. Nothing is uploaded, and clearing this browser's data
            erases it. Export a CSV file to keep a copy or to move to another phone.
          </SheetDescription>
        </SheetHeader>
        <div className="grid content-start gap-4 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Button
            size="lg"
            className="h-12 text-base"
            disabled={readingCount === 0}
            onClick={() => downloadCsv(samples)}
          >
            Export CSV
          </Button>
          {samples.length === 0 ? (
            <p className="text-base">Nothing saved yet. Read a Spot, then tap Save to Log.</p>
          ) : (
            [...samples].reverse().map((sample) => (
              <SampleCard key={sample.id} sample={sample} onChange={onChange} onRemove={onRemove} />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
