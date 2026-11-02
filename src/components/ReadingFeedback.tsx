import * as React from "react"
import { Button } from "@/components/ui/button"
import type { SavedReading } from "@/lib/log"
import { addReadingFeedback, feedbackForReading, RATINGS, watchFeedback, type Feedback, type Rating } from "@/lib/readingFeedback"

export function ReadingFeedback({ reading, compact = false }: { reading: SavedReading; compact?: boolean }) {
  const [entries, setEntries] = React.useState<Feedback[]>([])
  const [note, setNote] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const writing = React.useRef(false)
  const [status, setStatus] = React.useState("")
  const [problem, setProblem] = React.useState("")
  const noteId = React.useId()
  React.useEffect(() => {
    let active = true
    const refresh = () => feedbackForReading(reading.id).then((saved) => {
      if (active) setEntries(saved)
    }).catch(() => { if (active) setProblem("Previous feedback could not be read on this device.") })
    void refresh()
    const stop = watchFeedback(() => void refresh())
    return () => { active = false; stop() }
  }, [reading.id])
  const save = async (rating: Rating) => {
    if (writing.current) return
    writing.current = true
    setBusy(true); setProblem(""); setStatus("")
    try {
      await addReadingFeedback(reading, rating, note)
      setNote("")
      setStatus("Feedback saved on this device")
    } catch {
      setProblem("Feedback was not saved. Your reading is unchanged. Try again or free device storage.")
    } finally { writing.current = false; setBusy(false) }
  }
  return <section aria-label={compact ? "Quick reading feedback" : "Reading feedback"} className="grid gap-2 rounded-lg border border-border bg-card p-3">
    <p className="text-sm font-semibold">Did this reading look right?</p>
    {!compact && <label htmlFor={noteId} className="text-sm">Optional note
      <textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} disabled={busy} rows={2} placeholder="For example: wrong page, uneven light, or expected 10YR 4/3" className="mt-1 block w-full rounded-md border border-input bg-transparent p-2 text-base" />
    </label>}
    <div className="flex flex-wrap gap-2">
      {(Object.entries(RATINGS) as [Rating, string][]).map(([rating, label]) => <Button type="button" key={rating} variant="outline" className="min-h-11 flex-1" disabled={busy} onClick={() => void save(rating)}>{label}</Button>)}
    </div>
    {status && <p role="status" className="text-xs">{status}</p>}
    {problem && <p role="alert" className="text-sm">{problem}</p>}
    {!compact && <>
      <p className="text-xs text-muted-foreground">Tap an answer to save it with your note. Feedback keeps a reading snapshot; original data stays unchanged. Local only, not sent.</p>
      {entries.length > 0 && <ul aria-label="Previous feedback" className="grid gap-2 border-t border-border pt-2">{entries.map((entry) => <li key={entry.id} className="text-sm">
        <span className="font-semibold">{RATINGS[entry.rating]}</span>{" · "}<time dateTime={new Date(entry.at).toISOString()} className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString()}</time>
        {entry.note && <p className="whitespace-pre-wrap break-words">{entry.note}</p>}
      </li>)}</ul>}
    </>}
    {compact && <p className="text-xs text-muted-foreground">Local only · Add a note in Readings or Sample History.</p>}
  </section>
}
