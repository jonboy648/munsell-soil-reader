// Example Photos from the simulated camera, to practice the taps before going into the field.
import { EXAMPLES, type ExamplePhoto } from "@/engine/simulate"
import { cn } from "@/lib/utils"

interface Props {
  activeId: string | undefined
  onPick: (example: ExamplePhoto) => void
  /** The examples to offer; the soil Photos by default. */
  examples?: ExamplePhoto[]
}

export function ExamplePicker({ activeId, onPick, examples = EXAMPLES }: Props) {
  return (
    <section aria-label="Example Photos" className="grid gap-2">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Practice Photos (simulated camera)
      </h2>
      <ul className="grid gap-2">
        {examples.map((example) => (
          <li key={example.id}>
            <button
              type="button"
              onClick={() => onPick(example)}
              aria-pressed={activeId === example.id}
              className={cn(
                "grid min-h-14 w-full gap-0.5 rounded-lg border bg-card p-3 text-left",
                activeId === example.id
                  ? "border-foreground ring-1 ring-foreground"
                  : "border-border",
              )}
            >
              <span className="font-heading text-base font-bold">{example.name}</span>
              <span className="text-sm text-muted-foreground">{example.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
