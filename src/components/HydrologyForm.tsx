// The Hydrology section of page 1: the indicators to tick, the Field Observations with their depths,
// the two boxes of notes, and "Wetland Hydrology Present?", which the rule suggests and the user confirms.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { suggestWetlandHydrology } from "@/delineation/hydrology"
import { emptyHydrology, withPoint, type Hydrology, type Project, type SamplingPoint } from "@/delineation/model"
import { regionOf } from "@/delineation/regions"
import { OBSERVATIONS, type HydrologyIndicator, type Observation } from "@/delineation/regions/types"

interface Props {
  project: Project
  point: SamplingPoint
  /** Rejects when the Log could not be written. */
  change: (projectId: string, change: (project: Project) => Project) => Promise<unknown>
}

const OBSERVATION_LABELS: Record<Observation, string> = {
  surfaceWater: "Surface Water Present?",
  waterTable: "Water Table Present?",
  saturation: "Saturation Present? (includes capillary fringe)",
}

const YES_NO = "h-11 flex-1 text-base data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"

function IndicatorRow({ indicator, ticked, onTick }: { indicator: HydrologyIndicator; ticked: boolean; onTick: (on: boolean) => void }) {
  return (
    <li className="grid min-w-0 gap-1">
      <label className="flex min-h-11 items-center gap-3 text-base">
        <input type="checkbox" className="size-5 shrink-0 accent-foreground" checked={ticked} onChange={(e) => onTick(e.target.checked)} />
        <span className="min-w-0 [overflow-wrap:anywhere]">{indicator.label}</span>
      </label>
      <details className="pl-8 text-sm text-muted-foreground">
        <summary className="min-h-8 cursor-pointer">What it is</summary>
        <p className="[overflow-wrap:anywhere]">{indicator.definition}</p>
        <p className="mt-1 text-xs">{indicator.citation}</p>
      </details>
    </li>
  )
}

export function HydrologyForm({ project, point, change }: Props) {
  const region = regionOf(project.region)
  const h = point.hydrology ?? emptyHydrology
  const update = (fn: (hydrology: Hydrology) => Hydrology) =>
    change(project.id, (p) => withPoint(p, point.id, (pt) => ({ ...pt, hydrology: fn(pt.hydrology ?? emptyHydrology) })))

  // Text and depths are saved when the field is left, not on every key.
  const [describe, setDescribe] = React.useState(h.describe)
  const [remarks, setRemarks] = React.useState(h.remarks)
  const [depths, setDepths] = React.useState<Record<Observation, string>>({
    surfaceWater: h.surfaceWater.depth === null ? "" : String(h.surfaceWater.depth),
    waterTable: h.waterTable.depth === null ? "" : String(h.waterTable.depth),
    saturation: h.saturation.depth === null ? "" : String(h.saturation.depth),
  })

  const tick = (id: string) => (on: boolean) =>
    update((x) => ({ ...x, ticked: on ? [...x.ticked.filter((t) => t !== id), id] : x.ticked.filter((t) => t !== id) }))
  const primary = region.hydrology.indicators.filter((i) => i.kind === "primary")
  const secondary = region.hydrology.indicators.filter((i) => i.kind === "secondary")
  const suggestion = suggestWetlandHydrology(region, h.ticked)

  return (
    <section aria-label="Hydrology" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Hydrology, page 1</h4>

      <fieldset className="grid gap-1">
        <legend className="font-heading text-base font-bold">Primary indicators (minimum of one)</legend>
        <ul>
          {primary.map((i) => (
            <IndicatorRow key={i.id} indicator={i} ticked={h.ticked.includes(i.id)} onTick={tick(i.id)} />
          ))}
          <li>
            <label className="flex min-h-11 items-center gap-3 text-base">
              <input type="checkbox" className="size-5 shrink-0 accent-foreground" checked={h.ticked.includes("other")} onChange={(e) => tick("other")(e.target.checked)} />
              Other (Explain in Remarks)
            </label>
          </li>
        </ul>
      </fieldset>

      <fieldset className="grid gap-1">
        <legend className="font-heading text-base font-bold">Secondary indicators (minimum of two)</legend>
        <ul>
          {secondary.map((i) => (
            <IndicatorRow key={i.id} indicator={i} ticked={h.ticked.includes(i.id)} onTick={tick(i.id)} />
          ))}
        </ul>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="font-heading text-base font-bold">Field Observations</legend>
        {OBSERVATIONS.map((o) => (
          <div key={o} className="grid min-w-0 gap-2 rounded-lg border border-border bg-card p-3">
            <span id={`obs-${o}`} className="text-sm font-medium">{OBSERVATION_LABELS[o]}</span>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={2}
              className="w-full"
              aria-labelledby={`obs-${o}`}
              value={h[o].present === null ? "" : h[o].present ? "yes" : "no"}
              onValueChange={(value) =>
                update((x) => ({ ...x, [o]: { present: value === "" ? null : value === "yes", depth: value === "yes" ? x[o].depth : null } }))
              }
            >
              <ToggleGroupItem value="yes" className={YES_NO}>Yes</ToggleGroupItem>
              <ToggleGroupItem value="no" className={YES_NO}>No</ToggleGroupItem>
            </ToggleGroup>
            {h[o].present === true && (
              <div className="grid gap-1.5">
                <Label htmlFor={`depth-${o}`}>{OBSERVATION_LABELS[o].replace(" Present?", "").replace(" (includes capillary fringe)", "")} depth (in)</Label>
                <Input
                  id={`depth-${o}`}
                  className="h-11 text-base"
                  inputMode="decimal"
                  value={depths[o]}
                  onChange={(e) => setDepths({ ...depths, [o]: e.target.value })}
                  onBlur={() => {
                    const depth = depths[o].trim() === "" ? null : Number(depths[o])
                    if (depth !== null && (!Number.isFinite(depth) || depth < 0)) return
                    void update((x) => ({ ...x, [o]: { ...x[o], depth } }))
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="hydrology-describe">Describe Recorded Data (stream gauge, monitoring well, aerial photos, previous inspections)</Label>
        <Textarea id="hydrology-describe" className="text-base" value={describe} onChange={(e) => setDescribe(e.target.value)} onBlur={() => void update((x) => ({ ...x, describe }))} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="hydrology-remarks">Hydrology remarks</Label>
        <Textarea id="hydrology-remarks" className="text-base" value={remarks} onChange={(e) => setRemarks(e.target.value)} onBlur={() => void update((x) => ({ ...x, remarks }))} />
      </div>

      <div className="grid gap-3 rounded-lg border-2 border-foreground p-3">
        <h5 className="font-heading text-base font-bold">Wetland Hydrology Present?</h5>
        <p data-testid="hydrology-suggestion" className="min-w-0 text-sm [overflow-wrap:anywhere]">
          Suggested. {suggestion.text} <span className="text-muted-foreground">({suggestion.citation})</span>
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={2}
          className="w-full"
          aria-label="Wetland Hydrology Present?"
          value={h.present === null ? "" : h.present ? "yes" : "no"}
          onValueChange={(value) => void update((x) => ({ ...x, present: value === "" ? null : value === "yes" }))}
        >
          <ToggleGroupItem value="yes" className={YES_NO}>Yes</ToggleGroupItem>
          <ToggleGroupItem value="no" className={YES_NO}>No</ToggleGroupItem>
        </ToggleGroup>
        {h.present === suggestion.answer ? (
          <p role="status" className="text-sm font-medium">Confirmed: {h.present ? "Yes" : "No"}, printed on the form.</p>
        ) : (
          <>
            <Button className="h-12 text-base" onClick={() => void update((x) => ({ ...x, present: suggestion.answer }))}>
              Confirm {suggestion.answer ? "Yes" : "No"}
            </Button>
            <p className="text-sm text-muted-foreground">
              {h.present === null
                ? "Until you answer, neither Yes nor No is printed."
                : `You answered ${h.present ? "Yes" : "No"}, which differs from the suggestion. Your answer is printed.`}
            </p>
          </>
        )}
      </div>
    </section>
  )
}
