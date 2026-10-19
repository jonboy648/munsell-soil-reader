// The hydrophytic vegetation indicators for one sampling point, in the supplement's order: how the dominant
// species were chosen, what each indicator says with the rule quoted, the prevalence index applied
// anyway when the user says why, the indicators that rest on what the user saw, and "Hydrophytic
// Vegetation Present?", suggested and confirmed by the user. Nothing is ticked on the form until the user
// confirms it.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Form } from "@/delineation/formFor"
import type { IndicatorChoice, SamplingPoint } from "@/delineation/model"
import { vegetationOf } from "@/delineation/model"
import type { Vegetation } from "@/delineation/vegetation/entry"
import type { VegIndicator, VegIndicatorId } from "@/delineation/vegetation/hydrophytic"
import { STRATUM_LABEL } from "@/delineation/vegetation/strata"

interface Props {
  point: SamplingPoint
  form: Form
  /** Rejects when the Log could not be written. */
  onChange: (change: (vegetation: Vegetation) => Vegetation) => Promise<unknown>
}

const SHORT: Record<VegIndicatorId, string> = {
  rapid: "Rapid Test",
  dominance: "Dominance Test",
  prevalence: "Prevalence Index",
  morphological: "Morphological Adaptations",
  problematic: "Problematic Vegetation",
}

const STATE_WORDS: Record<VegIndicator["state"], string> = {
  satisfied: "Satisfied",
  "not met": "Not met",
  "not applied": "Not applied",
  yours: "Your observation",
}

const WRITE_PROBLEM = "The Log could not be written on this device. Try again."

/** Run a Log write and say so when it fails. */
function useWrite() {
  const [problem, setProblem] = React.useState<string | null>(null)
  const write = async (action: () => Promise<unknown>) => {
    try {
      await action()
      setProblem(null)
    } catch {
      setProblem(WRITE_PROBLEM)
    }
  }
  return { problem, write, clear: () => setProblem(null), fail: (text: string) => setProblem(text) }
}

function IndicatorCard({ i, onChoose, children }: { i: VegIndicator; onChoose: (id: VegIndicatorId, choice: IndicatorChoice | null) => Promise<unknown>; children?: React.ReactNode }) {
  const { problem, write } = useWrite()
  return (
    <li data-testid="veg-indicator" data-indicator={i.id} data-state={i.state} data-decision={i.decision} data-stale={i.stale} className="grid min-w-0 gap-2 rounded-lg border border-border bg-card p-3">
      <p className="font-heading text-lg font-bold [overflow-wrap:anywhere]">{i.printed}</p>
      <p className="text-sm">
        <b className="font-semibold">{STATE_WORDS[i.state]}.</b> <span data-testid="veg-indicator-reason">{i.reason}</span>
      </p>
      <blockquote data-testid="veg-indicator-rule" className="min-w-0 border-l-4 border-foreground/40 pl-3 text-sm [overflow-wrap:anywhere]">
        {i.rule}
        <footer className="mt-1 text-xs text-muted-foreground">{i.citation}</footer>
      </blockquote>
      {i.state !== "yours" &&
        (i.decision === "pending" ? (
          i.state === "satisfied" && <div className="flex gap-2">
            <Button className="h-11 flex-1 text-base" aria-label={`Confirm ${SHORT[i.id]}`} onClick={() => void write(() => onChoose(i.id, { state: "confirmed" }))}>
              Confirm
            </Button>
            <Button variant="outline" className="h-11 flex-1 text-base" aria-label={`Reject ${SHORT[i.id]}`} onClick={() => void write(() => onChoose(i.id, { state: "rejected" }))}>
              Reject
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p data-testid="veg-indicator-state" className="text-sm font-semibold">
              {i.stale
                ? "Confirmed earlier, no longer satisfied: not ticked. It goes on the cover note."
                : i.decision === "confirmed"
                  ? "Confirmed: ticked on the Vegetation page."
                  : "Rejected: not ticked."}
            </p>
            <Button variant="outline" className="h-11 text-base" aria-label={`Undo ${SHORT[i.id]}`} onClick={() => void write(() => onChoose(i.id, null))}>
              Undo
            </Button>
          </div>
        ))}
      {children}
      {problem && <p role="alert" className="text-sm font-medium">{problem}</p>}
    </li>
  )
}

/** The user's own tick, with the reason the form asks for. */
function OwnTick({ i, onChoose }: { i: VegIndicator; onChoose: (id: VegIndicatorId, choice: IndicatorChoice | null) => Promise<unknown> }) {
  const [remark, setRemark] = React.useState("")
  const { problem, write, fail } = useWrite()
  if (i.decision === "confirmed") {
    return (
      <div className="flex items-center justify-between gap-2">
        <p data-testid="veg-indicator-state" className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">
          Ticked: {i.remark}
        </p>
        <Button variant="outline" className="h-11 shrink-0 text-base" aria-label={`Remove ${SHORT[i.id]}`} onClick={() => void write(() => onChoose(i.id, null))}>
          Remove
        </Button>
      </div>
    )
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (remark.trim() === "") return fail("Say what you saw. It goes on the cover note.")
    void write(async () => {
      await onChoose(i.id, { state: "confirmed", manual: true, remark: remark.trim() })
      setRemark("")
    })
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-2" aria-label={`Tick ${SHORT[i.id]}`}>
      <Label htmlFor={`veg-tick-${i.id}`}>What you saw</Label>
      <Input id={`veg-tick-${i.id}`} className="h-11 text-base" autoComplete="off" value={remark} onChange={(e) => setRemark(e.target.value)} />
      {problem && <p role="alert" className="text-sm font-medium">{problem}</p>}
      <Button type="submit" variant="outline" className="h-11 text-base">
        Tick it
      </Button>
    </form>
  )
}

/** Apply the prevalence index where the supplement's order would not, and say why. */
function ApplyAnyway({ reason, onChange }: { reason: string; onChange: Props["onChange"] }) {
  const [text, setText] = React.useState("")
  const { problem, write, fail } = useWrite()
  if (reason !== "") {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">Applied at your request: {reason}</p>
        <Button variant="outline" className="h-11 shrink-0 text-base" onClick={() => void write(() => onChange(({ prevalenceReason: _gone, ...v }) => v))}>
          Stop applying
        </Button>
      </div>
    )
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim() === "") return fail("Say why. It goes on the cover note.")
    void write(async () => {
      await onChange((v) => ({ ...v, prevalenceReason: text.trim() }))
      setText("")
    })
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-2" aria-label="Apply the prevalence index anyway">
      <Label htmlFor="veg-prevalence-reason">Apply the prevalence index anyway, because</Label>
      <Input id="veg-prevalence-reason" className="h-11 text-base" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
      {problem && <p role="alert" className="text-sm font-medium">{problem}</p>}
      <Button type="submit" variant="outline" className="h-11 text-base">
        Apply it
      </Button>
    </form>
  )
}

export function VegetationIndicators({ point, form, onChange }: Props) {
  const vegetation = vegetationOf(point)
  const result = form.vegetation
  const answer = vegetation.present
  const { problem, write } = useWrite()
  const nameOf = (id: string) => vegetation.plants.find((p) => p.id === id)?.name ?? id
  const coverOf = (id: string) => vegetation.plants.find((p) => p.id === id)?.cover ?? 0
  const choose = (id: VegIndicatorId, choice: IndicatorChoice | null) =>
    onChange((v) => {
      const { [id]: _gone, ...rest } = v.indicators ?? {}
      return { ...v, indicators: choice ? { ...rest, [id]: choice } : rest }
    })
  const answerWith = (value: "yes" | "no" | null) => write(() => onChange(({ present: _gone, ...v }) => (value ? { ...v, present: value } : v)))
  // With no plants there is nothing to suggest, but a decision or an answer already stored stays in reach.
  const stored = Object.keys(vegetation.indicators ?? {}).length > 0 || answer !== undefined || (vegetation.prevalenceReason ?? "").trim() !== ""
  if (vegetation.plants.length === 0 && !stored) return null

  return (
    <section aria-label="Hydrophytic vegetation" data-testid="veg-indicators" className="grid gap-3">
      <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Hydrophytic vegetation</h4>
      <p className="text-sm text-muted-foreground">
        The dominant species and the worksheets follow the supplement's arithmetic and are filled on the page. The indicators are suggestions: nothing is ticked until you confirm it.
      </p>

      <div data-testid="veg-dominants" className="grid gap-2 rounded-lg border border-border p-3 text-sm">
        <p className="font-semibold">Dominant species, by the 50/20 rule</p>
        {result.dominance.strata.map((s) => (
          <p key={s.stratum} data-stratum={s.stratum}>
            <b className="font-semibold">{STRATUM_LABEL[s.stratum]}:</b> total cover {s.total}, 50% is {s.half}, 20% is {s.fifth}.{" "}
            {s.used ? s.dominants.map((id) => `${nameOf(id)} (${coverOf(id)})`).join(", ") || "No dominant." : s.note}
          </p>
        ))}
      </div>

      <ul className="grid gap-3">
        {result.indicators.map((i) => (
          <IndicatorCard key={i.id} i={i} onChoose={choose}>
            {i.state === "yours" && <OwnTick i={i} onChoose={choose} />}
            {i.id === "prevalence" && i.state !== "satisfied" && !result.prevalenceApplied && <ApplyAnyway reason="" onChange={onChange} />}
            {i.id === "prevalence" && result.cover.prevalenceReason !== "" && <ApplyAnyway reason={result.cover.prevalenceReason} onChange={onChange} />}
          </IndicatorCard>
        ))}
      </ul>

      <div data-testid="veg-present" data-answer={answer ?? ""} className="grid gap-2 rounded-lg border-2 border-foreground p-3">
        <p className="font-heading text-lg font-bold">Hydrophytic Vegetation Present?</p>
        <p className="text-sm">
          {result.conclusion.suggested ? <b className="font-semibold">Suggested: Yes. </b> : null}
          {result.conclusion.because}
        </p>
        <div className="flex gap-2" role="group" aria-label="Your answer">
          <Button className="h-11 flex-1 text-base" variant={answer === "yes" ? "default" : "outline"} aria-pressed={answer === "yes"} onClick={() => void answerWith(answer === "yes" ? null : "yes")}>
            Yes
          </Button>
          <Button className="h-11 flex-1 text-base" variant={answer === "no" ? "default" : "outline"} aria-pressed={answer === "no"} onClick={() => void answerWith(answer === "no" ? null : "no")}>
            No
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {answer ? `Confirmed: ${answer === "yes" ? "Yes" : "No"}, printed on the Vegetation page.` : "Your answer prints on the Vegetation page only once you confirm it."}
        </p>
        {problem && <p role="alert" className="text-sm font-medium">{problem}</p>}
      </div>
    </section>
  )
}
