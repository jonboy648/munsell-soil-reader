// A Layer's fields: depths in inches, the matrix color and its percent, any redox colors, remarks.
import * as React from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { draftOfLayer, emptyLayerDraft, layerOfDraft, type LayerDraft } from "@/delineation/layerDraft"
import type { Layer } from "@/delineation/model"

interface Props {
  /** The Layer being edited. Absent when adding one. */
  layer?: Layer
  /** Rejects when the Log could not be written. */
  onSave: (layer: Layer) => Promise<unknown>
  onCancel: () => void
}

const INPUT = "h-11 text-base"

export function LayerForm({ layer, onSave, onCancel }: Props) {
  const [draft, setDraft] = React.useState<LayerDraft>(layer ? draftOfLayer(layer) : emptyLayerDraft)
  const [problem, setProblem] = React.useState<string | null>(null)
  const set = <K extends keyof LayerDraft>(key: K, value: LayerDraft[K]) => setDraft({ ...draft, [key]: value })
  const setRedox = (i: number, change: Partial<LayerDraft["redox"][number]>) =>
    set("redox", draft.redox.map((row, j) => (j === i ? { ...row, ...change } : row)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = layerOfDraft(draft, layer)
    if ("problem" in parsed) return setProblem(parsed.problem)
    setProblem(null)
    try {
      await onSave(parsed.value)
    } catch {
      setProblem("The Log could not be written on this device. Try again.")
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="layer-top">Top (in)</Label>
          <Input id="layer-top" className={INPUT} inputMode="decimal" value={draft.top} onChange={(e) => set("top", e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="layer-bottom">Bottom (in)</Label>
          <Input id="layer-bottom" className={INPUT} inputMode="decimal" value={draft.bottom} onChange={(e) => set("bottom", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="layer-matrix">Matrix color</Label>
          <Input
            id="layer-matrix"
            className={INPUT}
            placeholder="10YR 4/2"
            autoCapitalize="characters"
            autoComplete="off"
            value={draft.matrix}
            onChange={(e) => set("matrix", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="layer-matrix-percent">Matrix %</Label>
          <Input
            id="layer-matrix-percent"
            className={INPUT}
            inputMode="decimal"
            value={draft.matrixPercent}
            onChange={(e) => set("matrixPercent", e.target.value)}
          />
        </div>
      </div>
      {draft.redox.map((row, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`layer-redox-${i}`}>Redox color {i + 1}</Label>
            <Input
              id={`layer-redox-${i}`}
              className={INPUT}
              placeholder="7.5YR 4/6"
              autoCapitalize="characters"
              autoComplete="off"
              value={row.color}
              onChange={(e) => setRedox(i, { color: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`layer-redox-percent-${i}`}>Redox % {i + 1}</Label>
            <Input
              id={`layer-redox-percent-${i}`}
              className={INPUT}
              inputMode="decimal"
              value={row.percent}
              onChange={(e) => setRedox(i, { percent: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="size-11"
            aria-label={`Remove redox ${i + 1}`}
            onClick={() => set("redox", draft.redox.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-11 text-base"
        onClick={() => set("redox", [...draft.redox, { color: "", percent: "" }])}
      >
        <Plus /> Add a redox color
      </Button>
      <div className="grid gap-1.5">
        <Label htmlFor="layer-remarks">Remarks</Label>
        <Input id="layer-remarks" className={INPUT} value={draft.remarks} onChange={(e) => set("remarks", e.target.value)} />
      </div>
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
          Save layer
        </Button>
      </div>
    </form>
  )
}
