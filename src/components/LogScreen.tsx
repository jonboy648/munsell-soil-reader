// The Log screen: browse Samples and their Readings, edit a Sample's fields, delete a Reading
// or a Sample or remove a Sample's location (after an in-page confirm), and export the lot as CSV.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Confirm } from "@/components/Confirm"
import { SampleForm } from "@/components/SampleForm"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  changedFields,
  depthText,
  draftOf,
  problemWith,
  type Sample,
  type SampleDraft,
  type SampleFields,
  type SavedReading,
} from "@/lib/log"
import { downloadCsv } from "@/lib/logCsv"
import { shownReading } from "@/lib/verdict"
import { ReadingBookPage } from "./ReadingBookPage"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  samples: Sample[]
  /** Each rejects when the Log could not be written. */
  onEdit: (id: string, fields: Partial<SampleFields>) => Promise<unknown>
  onRemoveReading: (id: string, readingId: string) => Promise<unknown>
  onRemoveLocation: (id: string) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

const CARD_TEXT = { colorchecker: "ColorChecker", frame: "Frame", none: "No Card" }
const cardText = ({ card }: SavedReading) =>
  card.kind === "page" ? `Page ${card.hue ?? ""}`.trim() : CARD_TEXT[card.kind]
const CHECK_TEXT = { good: "Card check good", caution: "Card check caution", failed: "Card check failed", uncorrected: "Not corrected" }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })

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
          <ReadingBookPage chip={main.chip} />
          <p className="mt-1 text-xs text-muted-foreground">Calculated estimate: <span className="font-mono">{main.exact}</span> — not a printed chip.</p>
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
        <Confirm verb="Delete" what="this Reading" onYes={onRemove} onNo={() => ask(false)} />
      ) : (
        <Button variant="outline" className="h-11 text-base" onClick={() => ask(true)}>
          Delete Reading
        </Button>
      )}
    </li>
  )
}

type SampleCardProps = Pick<Props, "onEdit" | "onRemoveReading" | "onRemoveLocation" | "onDelete"> & {
  sample: Sample
}

function SampleCard({ sample, onEdit, onRemoveReading, onRemoveLocation, onDelete }: SampleCardProps) {
  // Set while editing: the form as it started and as it is now, so that saving sends only what changed.
  const [edit, setEdit] = React.useState<{ start: SampleDraft; draft: SampleDraft } | null>(null)
  const [confirming, setConfirming] = React.useState<string | null>(null) // "sample", "location" or a Reading's id
  const [problem, setProblem] = React.useState<string | null>(null)

  const attempt = async (work: () => Promise<unknown>) => {
    setProblem(null)
    try {
      await work()
      setConfirming(null)
    } catch {
      setProblem("The Log could not be written on this device. Try again.")
    }
  }
  const saveEdit = () => {
    if (!edit) return
    const invalid = problemWith(edit.draft)
    if (invalid) return setProblem(invalid)
    const changed = changedFields(edit.start, edit.draft)
    void attempt(async () => {
      if (Object.keys(changed).length > 0) await onEdit(sample.id, changed)
      setEdit(null)
    })
  }

  const meta = [depthText(sample), sample.condition, when(sample.createdAt)].filter(Boolean).join(" · ")
  return (
    <section
      aria-label={`Sample ${sample.name}`}
      data-testid="log-sample"
      className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-lg border border-border bg-card p-4"
    >
      {edit ? (
        <div className="grid gap-4">
          <SampleForm
            idPrefix={`edit-${sample.id}`}
            draft={edit.draft}
            onChange={(draft) => setEdit({ ...edit, draft })}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-11 flex-1 text-base"
              onClick={() => {
                setEdit(null)
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
          <h3 className="min-w-0 font-heading text-lg font-bold [overflow-wrap:anywhere]">{sample.name}</h3>
          <p className="text-sm text-muted-foreground">{meta}</p>
          {sample.location && (
            <div className="grid gap-2">
              <p className="font-mono text-xs text-muted-foreground">
                {sample.location.lat.toFixed(5)}, {sample.location.lon.toFixed(5)} (within{" "}
                {Math.round(sample.location.accuracy)} m)
              </p>
              {confirming === "location" ? (
                <Confirm
                  verb="Remove"
                  what="this Sample's location"
                  onYes={() => attempt(() => onRemoveLocation(sample.id))}
                  onNo={() => setConfirming(null)}
                />
              ) : (
                <Button variant="outline" className="h-11 text-base" onClick={() => setConfirming("location")}>
                  Remove location
                </Button>
              )}
            </div>
          )}
          {sample.notes && (
            <p className="min-w-0 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{sample.notes}</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1 text-base" onClick={() => setEdit({ start: draftOf(sample), draft: draftOf(sample) })}>
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
              verb="Delete"
              what={`Sample ${sample.name} and its ${plural(sample.readings.length, "Reading")}`}
              onYes={() => attempt(() => onDelete(sample.id))}
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
                onRemove={() => attempt(() => onRemoveReading(sample.id, saved.id))}
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

export function LogScreen({ open, onOpenChange, samples, ...changes }: Props) {
  const readingCount = samples.reduce((n, s) => n + s.readings.length, 0)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 rounded-t-xl data-[side=bottom]:h-[96svh]">
        <SheetHeader className="pr-14">
          <SheetTitle>Log</SheetTitle>
          <SheetDescription>
            The Log lives only on this device. Nothing is uploaded. Your browser can also erase it on
            its own (on iPhone, after a week without opening the app unless it is added to the Home
            Screen), so export a CSV after each trip.
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-4 overflow-y-auto px-4 pb-4">
          <Button
            size="lg"
            className="h-12 text-base"
            disabled={readingCount === 0}
            onClick={() => downloadCsv(samples)}
          >
            Export CSV
          </Button>
          <p className="text-sm text-muted-foreground">
            Excel shows a leading ' on text it could mistake for a formula, number or date, such as
            001 or 1 A. The export puts it there on purpose; it is not damage.
          </p>
          {samples.length === 0 ? (
            <p className="text-base">Nothing saved yet. Read a Spot, then tap Save to Log.</p>
          ) : (
            [...samples].reverse().map((sample) => <SampleCard key={sample.id} sample={sample} {...changes} />)
          )}
        </div>
        {/* In the thumb zone, so closing never means reaching for the corner. */}
        <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" size="lg" className="h-12 w-full text-base" onClick={() => onOpenChange(false)}>
            Close Log
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
