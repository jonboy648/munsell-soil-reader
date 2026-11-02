// The Sample's fields: name or number, depth top and bottom, Condition, notes. Used to make a
// Sample when saving to the Log and to edit one in the Log.
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { SampleDraft } from "@/lib/log"

interface Props {
  draft: SampleDraft
  onChange: (draft: SampleDraft) => void
  /** Makes the ids unique when two forms are on the page. */
  idPrefix: string
}

const INPUT = "h-11 text-base"

export function SampleForm({ draft, onChange, idPrefix }: Props) {
  const set = <K extends keyof SampleDraft>(key: K, value: SampleDraft[K]) => onChange({ ...draft, [key]: value })
  const id = (name: string) => `${idPrefix}-${name}`
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={id("name")}>Sample name or number</Label>
        <Input
          id={id("name")}
          className={INPUT}
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={id("top")}>Depth top (in)</Label>
          <Input
            id={id("top")}
            className={INPUT}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={draft.depthTop}
            onChange={(e) => set("depthTop", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={id("bottom")}>Depth bottom (in)</Label>
          <Input
            id={id("bottom")}
            className={INPUT}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={draft.depthBottom}
            onChange={(e) => set("depthBottom", e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <span id={id("condition")} className="text-sm leading-none font-medium">
          Condition
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={2}
          className="w-full"
          aria-labelledby={id("condition")}
          value={draft.condition}
          onValueChange={(value) => set("condition", value as SampleDraft["condition"])}
        >
          {(["moist", "dry"] as const).map((condition) => (
            <ToggleGroupItem
              key={condition}
              value={condition}
              className="h-11 flex-1 text-base capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {condition}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("notes")}>Notes</Label>
        <Textarea
          id={id("notes")}
          className="text-base"
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
    </div>
  )
}
