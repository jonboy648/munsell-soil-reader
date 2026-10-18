import { Check } from "lucide-react"
import { Stepper, StepperIndicator, StepperItem, StepperSeparator } from "@/components/ui/stepper"
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
  const steps = [
    {
      label: noCard ? "Card skipped" : cardKind === "page" ? "Page Chips" : "Card corners",
      detail: noCard ? "" : `${cornersTapped}/${cornerCount}`,
      active: step === "corners",
      done: step === "spots",
    },
    {
      label: "Spots",
      detail: spotCount ? String(spotCount) : "",
      active: step === "spots",
      done: spotCount > 0,
    },
  ]
  // The step the user is on, counting from 1; none until there is a Photo.
  const current = step === "corners" ? 1 : step === "spots" ? 2 : 0
  return (
    <Stepper
      value={current}
      // A list of steps to read, not tabs to press.
      role="list"
      aria-orientation={undefined}
      aria-label="Steps"
      indicators={{ completed: <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> }}
      className="flex items-center gap-2 text-sm"
    >
      {steps.map((s, i) => (
        <StepperItem
          key={s.label}
          step={i + 1}
          completed={s.done}
          role="listitem"
          aria-current={s.active ? "step" : undefined}
          className="gap-2"
        >
          <StepperIndicator className="font-mono font-semibold">{i + 1}</StepperIndicator>
          <span className={cn("font-medium", !s.active && !s.done && "text-muted-foreground")}>{s.label}</span>
          {s.detail && <span className="font-mono text-xs">{s.detail}</span>}
          {i < steps.length - 1 && <StepperSeparator className="h-0.5 flex-1" />}
        </StepperItem>
      ))}
    </Stepper>
  )
}
