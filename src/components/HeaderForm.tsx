// The header of page 1, entered once for a Project and printed on every Sampling point's form.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group-1"
import { PROJECT_FIELDS } from "@/delineation/headerFields"
import type { Conditions, ProjectHeader, YesNo } from "@/delineation/model"

interface Props {
  header: ProjectHeader
  /** Rejects when the Log could not be written. */
  onSave: (header: ProjectHeader) => Promise<unknown>
  onCancel: () => void
}

const INPUT = "h-11 text-base"

/** Yes or No, or neither: pressing the chosen one again clears it. */
function YesNoChoice({ label, value, onPick }: { label: string; value: YesNo; onPick: (value: YesNo) => void }) {
  return (
    <ToggleGroup type="single" variant="outline" size="lg" aria-label={label} value={value} onValueChange={(v) => onPick(v as YesNo)} className="w-fit">
      <ToggleGroupItem value="yes" className="min-w-16 text-base">Yes</ToggleGroupItem>
      <ToggleGroupItem value="no" className="min-w-16 text-base">No</ToggleGroupItem>
    </ToggleGroup>
  )
}

/** The question on the form that is answered for vegetation, soil and hydrology in turn. */
function ConditionsQuestion({ question, value, onChange }: { question: string; value: Conditions; onChange: (value: Conditions) => void }) {
  return (
    <fieldset className="grid gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-medium">Are vegetation, soil or hydrology {question}?</legend>
      {(["vegetation", "soil", "hydrology"] as const).map((part) => (
        <div key={part} className="flex items-center justify-between gap-3">
          <span className="text-base capitalize">{part}</span>
          <YesNoChoice label={`${part[0].toUpperCase()}${part.slice(1)} ${question}`} value={value[part]} onPick={(v) => onChange({ ...value, [part]: v })} />
        </div>
      ))}
    </fieldset>
  )
}

export function HeaderForm({ header, onSave, onCancel }: Props) {
  const [draft, setDraft] = React.useState<ProjectHeader>(header)
  const [problem, setProblem] = React.useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProblem(null)
    try {
      await onSave(draft)
    } catch {
      setProblem("The Log could not be written on this device. Try again.")
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        These lines are printed at the top of page 1 of every sampling point's form. Leave a line blank to leave it blank on the form.
      </p>
      {PROJECT_FIELDS.map(({ key, label, hint }) => (
        <div key={key} className="grid gap-1.5">
          <Label htmlFor={`header-${key}`}>
            {label}
            {hint && <span className="font-normal text-muted-foreground"> ({hint})</span>}
          </Label>
          <Input
            id={`header-${key}`}
            className={INPUT}
            type={key === "date" ? "date" : "text"}
            autoComplete="off"
            value={String(draft[key])}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          />
        </div>
      ))}
      <fieldset className="grid gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Are "Normal Circumstances" present?</legend>
        <YesNoChoice label={'Are "Normal Circumstances" present?'} value={draft.normalCircumstances} onPick={(v) => setDraft({ ...draft, normalCircumstances: v })} />
      </fieldset>
      <ConditionsQuestion question="significantly disturbed" value={draft.disturbed} onChange={(disturbed) => setDraft({ ...draft, disturbed })} />
      <ConditionsQuestion question="naturally problematic" value={draft.problematic} onChange={(problematic) => setDraft({ ...draft, problematic })} />
      {problem && (
        <p role="alert" className="min-w-0 rounded-md border-2 border-foreground p-3 text-sm font-medium [overflow-wrap:anywhere]">
          {problem}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-12 flex-1 text-base" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="h-12 flex-1 text-base">
          Save header
        </Button>
      </div>
    </form>
  )
}
