// The hydric soil indicators for one sampling point: what the layers satisfy, with the rule quoted and the
// layers named, to confirm or reject; what the others still need; indicators the user ticks themselves;
// and "Hydric Soil Present?", suggested from what is confirmed and confirmed by the user. Nothing is
// ticked on the form until the user confirms it.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Form } from "@/delineation/formFor"
import type { IndicatorChoice, Project, SamplingPoint } from "@/delineation/model"
import { regionOf } from "@/delineation/regions"
import { indicatorLabel, type Suggestion } from "@/delineation/rules/suggest"

interface Props {
  project: Project
  point: SamplingPoint
  form: Form
  /** Rejects when the Log could not be written. */
  onChoose: (id: string, choice: IndicatorChoice | null) => Promise<unknown>
  onHydric: (answer: "yes" | "no" | null) => Promise<unknown>
}

const layerText = (s: Suggestion): string => {
  const first = s.layers[0]
  const last = s.layers[s.layers.length - 1]
  const ns = s.layers.map((l) => l.n)
  const word = ns.length === 1 ? `Layer ${ns[0]}` : `Layers ${ns[0]} to ${ns[ns.length - 1]}`
  return `${word} (${first.top}-${last.bottom} in)`
}

function SuggestionCard({ s, onChoose }: { s: Suggestion; onChoose: Props["onChoose"] }) {
  const [problem, setProblem] = React.useState<string | null>(null)
  const choose = async (choice: IndicatorChoice | null) => {
    try {
      await onChoose(s.indicator, choice)
      setProblem(null)
    } catch {
      setProblem("The Log could not be written on this device. Try again.")
    }
  }
  return (
    <li data-testid="suggestion" data-indicator={s.indicator} data-decision={s.decision} className="grid min-w-0 gap-2 rounded-lg border border-border bg-card p-3">
      <p className="font-heading text-lg font-bold [overflow-wrap:anywhere]">
        {indicatorLabel(s)}
      </p>
      <p className="text-sm">
        <b className="font-semibold">Suggested from {layerText(s)}.</b>
        {s.combinedWith && " Met by combining layers."}
      </p>
      <blockquote data-testid="suggestion-rule" className="min-w-0 border-l-4 border-foreground/40 pl-3 text-sm [overflow-wrap:anywhere]">
        {s.rule}
        <footer className="mt-1 text-xs text-muted-foreground">{s.citations.map((c) => `${c.document}, ${c.page}`).join("; ")}</footer>
      </blockquote>
      <ul data-testid="suggestion-evidence" className="grid list-disc gap-1 pl-5 text-sm">
        {s.evidence.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
      {s.checks.length > 0 && (
        <ul data-testid="suggestion-checks" className="grid gap-1 rounded-md border border-foreground/40 p-2 text-sm">
          {s.checks.map((c, i) => (
            <li key={i}>
              <b className="font-semibold">Check: </b>
              {c}
            </li>
          ))}
        </ul>
      )}
      {s.decision === "pending" ? (
        <div className="flex gap-2">
          <Button className="h-11 flex-1 text-base" aria-label={`Confirm ${s.code}`} onClick={() => void choose({ state: "confirmed" })}>
            Confirm
          </Button>
          <Button variant="outline" className="h-11 flex-1 text-base" aria-label={`Reject ${s.code}`} onClick={() => void choose({ state: "rejected" })}>
            Reject
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p data-testid="suggestion-state" className="text-sm font-semibold">
            {s.decision === "confirmed" ? "Confirmed: ticked on the Soil page." : "Rejected: not ticked."}
          </p>
          <Button variant="outline" className="h-11 text-base" aria-label={`Undo ${s.code}`} onClick={() => void choose(null)}>
            Undo
          </Button>
        </div>
      )}
      {problem && <p role="alert" className="text-sm font-medium">{problem}</p>}
    </li>
  )
}

/** Tick an indicator the app did not suggest, with a reason. */
function ManualTick({ project, form, onChoose }: Pick<Props, "project" | "form" | "onChoose">) {
  const region = regionOf(project.region)
  const taken = new Set([...form.hydric.suggestions.map((s) => s.indicator), ...form.hydric.ticked.map((t) => t.indicator)])
  const options = region.indicators.filter((i) => !taken.has(i.id))
  const [id, setId] = React.useState("")
  const [remark, setRemark] = React.useState("")
  const [problem, setProblem] = React.useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (id === "") return setProblem("Pick the indicator to tick.")
    if (remark.trim() === "") return setProblem("Say why in the remark. It goes on the cover note.")
    try {
      await onChoose(id, { state: "confirmed", manual: true, remark: remark.trim() })
      setId("")
      setRemark("")
      setProblem(null)
    } catch {
      setProblem("The Log could not be written on this device. Try again.")
    }
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-2 rounded-lg border border-border p-3" aria-label="Tick another indicator">
      <h5 className="text-sm font-semibold">Tick an indicator the app did not suggest</h5>
      <div className="grid gap-1.5">
        <Label htmlFor="tick-indicator">Indicator</Label>
        <select
          id="tick-indicator"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">Choose one</option>
          {options.map((i) => (
            <option key={i.id} value={i.id}>
              {i.printed}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tick-remark">Remark</Label>
        <Input id="tick-remark" className="h-11 text-base" autoComplete="off" value={remark} onChange={(e) => setRemark(e.target.value)} />
      </div>
      {problem && <p role="alert" className="text-sm font-medium">{problem}</p>}
      <Button type="submit" variant="outline" className="h-11 text-base">
        Tick it
      </Button>
      {form.hydric.ticked.length > 0 && (
        <ul data-testid="ticked" className="grid gap-2 text-sm">
          {form.hydric.ticked.map((t) => (
            <li key={t.indicator} className="flex items-center justify-between gap-2">
              <span className="min-w-0 [overflow-wrap:anywhere]">
                <b className="font-semibold">{indicatorLabel(t)}</b>
                {t.remark && `: ${t.remark}`}
              </span>
              <Button type="button" variant="outline" className="h-11 shrink-0 text-base" aria-label={`Remove ${t.code || "Other"}`} onClick={() => void onChoose(t.indicator, null)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}

export function IndicatorsPanel({ project, point, form, onChoose, onHydric }: Props) {
  const region = regionOf(project.region)
  const sub = project.subregion
  const subregion = sub ? `LRR ${sub.lrr}${sub.mlra && sub.mlra !== "other" ? `, MLRA ${sub.mlra}` : ""}` : null
  const { conclusion } = form.hydric
  return (
    <section aria-label="Hydric soil indicators" data-testid="indicators" className="grid gap-3">
      <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Hydric soil indicators</h4>
      <p className="text-sm text-muted-foreground">
        {subregion ? `Subregion: ${subregion}.` : "The project's subregion is not picked, so indicators limited to some subregions are not suggested."}{" "}
        {region.name} indicators are suggested from the layers recorded. Nothing is ticked on the Soil page until you confirm it.
      </p>
      {form.hydric.suggestions.length === 0 ? (
        <p className="text-base" data-testid="no-suggestions">The recorded layers satisfy no indicator the app can decide yet.</p>
      ) : (
        <ul className="grid gap-3">
          {form.hydric.suggestions.map((s) => (
            <SuggestionCard key={s.indicator} s={s} onChoose={onChoose} />
          ))}
        </ul>
      )}

      {form.hydric.needs.length > 0 && (
        <details data-testid="needs" className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-sm font-semibold">Needs more information ({form.hydric.needs.length})</summary>
          <ul className="mt-2 grid gap-2 text-sm">
            {form.hydric.needs.map((n) => (
              <li key={n.indicator} data-indicator={n.indicator}>
                <b className="font-semibold">{n.code} {n.name}</b>
                {n.colorsFit && " (the colors and depths fit)"}: needs {n.needs.join(" ")}
              </li>
            ))}
          </ul>
        </details>
      )}

      <ManualTick project={project} form={form} onChoose={onChoose} />

      <div data-testid="hydric-present" data-answer={point.hydricSoilPresent ?? ""} className="grid gap-2 rounded-lg border-2 border-foreground p-3">
        <p className="font-heading text-lg font-bold">{conclusion.question}</p>
        <p className="text-sm">
          {conclusion.suggested ? <b className="font-semibold">Suggested: Yes. </b> : null}
          {conclusion.because}
        </p>
        <div className="flex gap-2" role="group" aria-label="Your answer">
          <Button
            className="h-11 flex-1 text-base"
            variant={point.hydricSoilPresent === "yes" ? "default" : "outline"}
            aria-pressed={point.hydricSoilPresent === "yes"}
            onClick={() => void onHydric(point.hydricSoilPresent === "yes" ? null : "yes")}
          >
            Yes
          </Button>
          <Button
            className="h-11 flex-1 text-base"
            variant={point.hydricSoilPresent === "no" ? "default" : "outline"}
            aria-pressed={point.hydricSoilPresent === "no"}
            onClick={() => void onHydric(point.hydricSoilPresent === "no" ? null : "no")}
          >
            No
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {point.hydricSoilPresent ? `Confirmed: ${point.hydricSoilPresent === "yes" ? "Yes" : "No"}, printed on the Soil page.` : "Your answer prints on the Soil page only once you confirm it."}
        </p>
      </div>
    </section>
  )
}
