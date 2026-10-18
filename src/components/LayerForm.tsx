// A Layer's fields: depths in inches, the matrix color and its percent, the texture, any redox colors with
// their type and location, remarks.
import * as React from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { REDOX_LOCATIONS, REDOX_TYPES } from "@/delineation/codes"
import { checkColor } from "@/delineation/colorCheck"
import {
  draftOfLayer,
  emptyLayerDraft,
  emptyRedoxDraft,
  layerOfDraft,
  type LayerDraft,
  type RedoxDraft,
} from "@/delineation/layerDraft"
import type { Layer } from "@/delineation/model"
import { ORGANIC_TERMS, TEXTURE_CLASSES, TEXTURE_SOURCE } from "@/delineation/texture"

interface Props {
  /** The Layer being edited. Absent when adding one. */
  layer?: Layer
  /** Rejects when the Log could not be written. */
  onSave: (layer: Layer) => Promise<unknown>
  onCancel: () => void
}

const INPUT = "h-11 text-base"
const SELECT =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

/** What the typed color is: a Chip of the book (with its name), or a valid notation the book does not print. */
function ColorHint({ text }: { text: string }) {
  if (text.trim() === "") return null
  const check = checkColor(text)
  const message =
    check.kind === "chip" ? `${check.notation} is a Chip in the soil book: ${check.name}.` : check.kind === "exact" ? check.note : `Not yet a color: ${check.problem}`
  return (
    <p data-testid="color-hint" data-kind={check.kind} className={`min-w-0 text-sm [overflow-wrap:anywhere] ${check.kind === "exact" ? "font-medium" : "text-muted-foreground"}`}>
      {message}
    </p>
  )
}

export function LayerForm({ layer, onSave, onCancel }: Props) {
  const [draft, setDraft] = React.useState<LayerDraft>(layer ? draftOfLayer(layer) : emptyLayerDraft)
  const [problem, setProblem] = React.useState<string | null>(null)
  const set = <K extends keyof LayerDraft>(key: K, value: LayerDraft[K]) => setDraft({ ...draft, [key]: value })
  const setRedox = (i: number, change: Partial<RedoxDraft>) =>
    set("redox", draft.redox.map((row, j) => (j === i ? { ...row, ...change } : row)))
  const mineral = TEXTURE_CLASSES.some((t) => t.term === draft.textureBase)

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
      <div className="grid gap-1.5">
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
        <ColorHint text={draft.matrix} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="layer-texture">Texture</Label>
        <select id="layer-texture" className={SELECT} value={draft.textureBase} onChange={(e) => set("textureBase", e.target.value)}>
          <option value="">Not recorded</option>
          <optgroup label="Mineral soil">
            {TEXTURE_CLASSES.map((t) => (
              <option key={t.term} value={t.term}>{t.term}</option>
            ))}
          </optgroup>
          <optgroup label="Organic soil material">
            {ORGANIC_TERMS.map((t) => (
              <option key={t.term} value={t.term}>{t.term}</option>
            ))}
          </optgroup>
        </select>
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-foreground"
            checked={draft.mucky && mineral}
            disabled={!mineral}
            onChange={(e) => set("mucky", e.target.checked)}
          />
          Mucky (mineral soil with more than 10 percent organic matter)
        </label>
        <p className="text-xs text-muted-foreground">{TEXTURE_SOURCE}.</p>
      </div>

      {draft.redox.map((row, i) => (
        <div key={i} className="grid gap-2 rounded-md border border-border p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-end gap-3">
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
          <ColorHint text={row.color} />
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`layer-redox-type-${i}`}>Redox type {i + 1}</Label>
              <select id={`layer-redox-type-${i}`} className={SELECT} value={row.type} onChange={(e) => setRedox(i, { type: e.target.value })}>
                <option value="">Not recorded</option>
                {REDOX_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>{t.code}: {t.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`layer-redox-location-${i}`}>Redox location {i + 1}</Label>
              <select id={`layer-redox-location-${i}`} className={SELECT} value={row.location} onChange={(e) => setRedox(i, { location: e.target.value })}>
                <option value="">Not recorded</option>
                {REDOX_LOCATIONS.map((l) => (
                  <option key={l.code} value={l.code}>{l.code}: {l.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" className="h-11 text-base" onClick={() => set("redox", [...draft.redox, emptyRedoxDraft])}>
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
