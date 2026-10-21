import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CONCLUSIONS, answerText, type Answer, type ConclusionId, type Determination, type SummaryConclusion } from "@/delineation/determination"

interface Props {
  determination: Determination
  onAnswer: (id: ConclusionId, answer: Answer | null, remark?: string) => Promise<unknown>
}

function ConclusionCard({ conclusion: c, onAnswer }: { conclusion: SummaryConclusion; onAnswer: Props["onAnswer"] }) {
  const [editing, setEditing] = React.useState(false)
  const [answer, setAnswer] = React.useState<Answer | "">("")
  const [remark, setRemark] = React.useState("")
  const [problem, setProblem] = React.useState("")
  const [writing, setWriting] = React.useState(false)
  const save = async (value: Answer | null, reason = "") => {
    setWriting(true)
    try {
      await onAnswer(c.id, value, reason)
      setProblem("")
      setEditing(false)
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "The Log could not be written on this device. Try again.")
    } finally {
      setWriting(false)
    }
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!answer) return setProblem("Choose Yes or No.")
    if (!remark.trim()) return setProblem("Explain your decision in the remark. It prints in Summary Remarks.")
    void save(answer, remark)
  }
  return (
    <div data-testid={`summary-${c.id}`} data-answer={c.confirmed ?? ""} className="grid min-w-0 gap-2 rounded-lg border border-border bg-card p-3 [overflow-wrap:anywhere]">
      <h5 className="font-heading text-lg font-bold">{c.question}</h5>
      <p className="text-xs text-muted-foreground">{c.page}</p>
      <p className="text-sm"><b>{c.suggested ? `Suggested: ${answerText(c.suggested)}. ` : "No automatic suggestion. "}</b>{c.because}</p>
      <p role="status" className="text-sm font-semibold">{c.confirmed ? `Confirmed: ${answerText(c.confirmed)}. Printed on the form.` : "Pending: blank on the form."}</p>
      {c.remark && <p className="text-sm">Remark: {c.remark}</p>}
      {c.review && <p className="text-sm font-semibold">{c.review}</p>}
      <div className="flex flex-wrap gap-2">
        {c.suggested && (c.confirmed !== c.suggested || c.review) && (
          <Button disabled={writing} className="min-h-11 text-base" onClick={() => void save(c.suggested)}>Confirm suggested {answerText(c.suggested)}</Button>
        )}
        <Button disabled={writing} variant="outline" className="min-h-11 text-base" onClick={() => {
          setAnswer(c.confirmed ?? "")
          setRemark(c.remark)
          setEditing(!editing)
          setProblem("")
        }}>Override or decide</Button>
        {c.confirmed && <Button disabled={writing} variant="outline" className="min-h-11 text-base" onClick={() => void save(null)}>Undo confirmation</Button>}
      </div>
      {editing && (
        <form aria-label={`Decide ${c.question}`} onSubmit={submit} noValidate className="grid min-w-0 gap-2">
          <Label htmlFor={`summary-answer-${c.id}`}>Your answer</Label>
          <select id={`summary-answer-${c.id}`} value={answer} onChange={(event) => setAnswer(event.target.value as Answer | "")} className="h-11 w-full rounded-lg border border-input bg-background px-2 text-base">
            <option value="">Choose one</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
          <Label htmlFor={`summary-remark-${c.id}`}>Remark explaining your decision</Label>
          <Textarea id={`summary-remark-${c.id}`} value={remark} onChange={(event) => setRemark(event.target.value)} className="text-base" />
          <Button disabled={writing} type="submit" className="min-h-11 text-base">Confirm answer with remark</Button>
        </form>
      )}
      {problem && <p role="alert" className="text-sm font-medium">{problem}</p>}
    </div>
  )
}

/** One place to review and override the answers shared with each individual page. */
export function DeterminationPanel({ determination, onAnswer }: Props) {
  return (
    <section id="determination" aria-label="Summary of findings" className="grid min-w-0 gap-3">
      <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Summary of findings, page 1</h4>
      <p className="text-sm text-muted-foreground">The parameter answers are shared with their pages. Confirm the overall wetland determination separately. Overrides and decisions without a suggestion need a remark.</p>
      {CONCLUSIONS.map((id) => <ConclusionCard key={id} conclusion={determination.conclusions[id]} onAnswer={onAnswer} />)}
    </section>
  )
}
