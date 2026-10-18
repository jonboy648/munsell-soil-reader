import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CardKind, Step } from "@/lib/session"

interface Props {
  step: Step
  cornersTapped: number
  cornerCount: number
  noCard: boolean
  cardKind: CardKind
  spotCount: number
}

/** A compact two-step indicator: Card corners (a Page: its Chips), then Spots. */
export function StepIndicator({ step, cornersTapped, cornerCount, noCard, cardKind, spotCount }: Props) {
  const cardDone = step === "spots"
  const steps = [
    {
      label: noCard ? "Card skipped" : cardKind === "page" ? "Page Chips" : "Card corners",
      detail: noCard ? "" : `${cornersTapped}/${cornerCount}`,
      active: step === "corners",
      done: cardDone,
    },
    {
      label: "Spots",
      detail: spotCount ? String(spotCount) : "",
      active: step === "spots",
      done: spotCount > 0,
    },
  ]
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Steps">
      {steps.map((s, i) => (
        <li
          key={s.label}
          aria-current={s.active ? "step" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5",
            s.active ? "border-foreground text-foreground" : "border-border text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "grid size-5 place-items-center rounded-full font-mono text-xs font-semibold",
              s.done ? "bg-foreground text-background" : s.active ? "bg-foreground text-background" : "bg-muted",
            )}
          >
            {s.done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
          </span>
          <span className="font-medium">{s.label}</span>
          {s.detail && <span className="font-mono text-xs">{s.detail}</span>}
        </li>
      ))}
    </ol>
  )
}
