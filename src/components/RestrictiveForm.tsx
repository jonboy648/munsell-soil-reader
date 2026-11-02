// The Soil page's Restrictive Layer box: the kind of root-limiting layer, if one was observed, and its depth.
import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RESTRICTION_KINDS } from "@/delineation/codes"
import { withPoint, type Project, type Restrictive, type SamplingPoint } from "@/delineation/model"

interface Props {
  project: Project
  point: SamplingPoint
  /** Rejects when the Log could not be written. */
  change: (projectId: string, change: (project: Project) => Project) => Promise<unknown>
}

const SELECT =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

export function RestrictiveForm({ project, point, change }: Props) {
  const [type, setType] = React.useState(point.restrictive?.type ?? "")
  const [depth, setDepth] = React.useState(point.restrictive?.depth == null ? "" : String(point.restrictive.depth))
  const [problem, setProblem] = React.useState<string | null>(null)

  const save = async (nextType: string, nextDepth: string) => {
    const value = nextDepth.trim() === "" ? null : Number(nextDepth)
    if (value !== null && (!Number.isFinite(value) || value < 0)) return setProblem("The depth is in inches from the surface, zero or more.")
    setProblem(null)
    const restrictive: Restrictive | undefined = nextType === "" ? undefined : { type: nextType, depth: value }
    try {
      await change(project.id, (p) => withPoint(p, point.id, ({ restrictive: _old, ...pt }) => ({ ...pt, ...(restrictive && { restrictive }) })))
    } catch {
      setProblem("The Log could not be written on this device. Try again.")
    }
  }

  return (
    <section aria-label="Restrictive layer" className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-3">
      <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Restrictive layer (if observed)</h4>
      <div className="grid gap-1.5">
        <Label htmlFor="restrictive-type">Restrictive layer type</Label>
        <select
          id="restrictive-type"
          className={SELECT}
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            if (e.target.value === "") setDepth("")
            void save(e.target.value, e.target.value === "" ? "" : depth)
          }}
        >
          <option value="">None observed</option>
          {RESTRICTION_KINDS.map((kind) => (
            <option key={kind} value={kind}>{kind}</option>
          ))}
        </select>
      </div>
      {type !== "" && (
        <div className="grid gap-1.5">
          <Label htmlFor="restrictive-depth">Restrictive layer depth (in)</Label>
          <Input
            id="restrictive-depth"
            className="h-11 text-base"
            inputMode="decimal"
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
            onBlur={() => void save(type, depth)}
          />
        </div>
      )}
      {problem && <p role="alert" className="text-sm font-medium">{problem}</p>}
      <p className="text-xs text-muted-foreground">Kinds from the NRCS Field Book for Describing and Sampling Soils, v4.0, pp. 1-29 and 1-30.</p>
    </section>
  )
}
