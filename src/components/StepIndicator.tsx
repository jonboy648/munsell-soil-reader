import { Check } from "lucide-react"
import { Stepper, StepperIndicator, StepperItem } from "@/components/ui/stepper"
import { cn } from "@/lib/utils"
import type { CardKind, Step } from "@/lib/session"

interface Props {
  step: Step
  cornersTapped: number
  cornerCount: number
  cardKind: CardKind
  /** The frame step's state in a word or two: looking, found, ok. */
  frameDetail: string
  noCard: boolean
  spotCount: number
}

/** A compact two-step indicator: Card corners (a Page: its Chips; the frame: its outline), then Spots. */
export function StepIndicator({ step, cornersTapped, cornerCount, cardKind, frameDetail, noCard, spotCount }: Props) {
  const steps = [
    {
      label: noCard ? "Card skipped" : cardKind === "frame" ? "Frame" : cardKind === "page" ? "Page Chips" : "Card corners",
      detail: noCard ? "" : cardKind === "frame" ? frameDetail : `${cornersTapped}/${cornerCount}`,
      active: step === "corners" || step === "frame",
      done: step === "spots",
      description: noCard ? "Uncorrected reading" : cardKind === "frame" ? "Confirm the outline" : "Mark the reference",
    },
    {
      label: "Spots",
      detail: spotCount ? String(spotCount) : "",
      active: step === "spots",
      done: spotCount > 0,
      description: "Tap the soil to read it",
    },
  ]
  // The step the user is on, counting from 1; none until there is a Photo.
  const current = step === "corners" || step === "frame" ? 1 : step === "spots" ? 2 : 0
  return (
    <Stepper
      value={current}
      // A list of steps to read, not tabs to press.
      role="list"
      aria-orientation={undefined}
      aria-label="Steps"
      indicators={{ completed: <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> }}
      className="grid grid-cols-2 gap-2 text-sm"
    >
      {steps.map((s, i) => (
        <StepperItem
          key={s.label}
          step={i + 1}
          completed={s.done}
          role="listitem"
          aria-current={s.active ? "step" : undefined}
          className="reader-step min-w-0 justify-start gap-3 rounded-xl border border-border bg-card p-3 data-[state=active]:border-foreground/60 data-[state=active]:bg-accent"
        >
          <StepperIndicator className="size-8 font-mono font-semibold">{i + 1}</StepperIndicator>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={cn("font-semibold", !s.active && !s.done && "text-muted-foreground")}>{s.label}</span>
              {s.detail && <span className="font-mono text-xs">{s.detail}</span>}
            </div>
            <p className="reader-step-description mt-0.5 text-xs text-muted-foreground">{s.description}</p>
          </div>
        </StepperItem>
      ))}
    </Stepper>
  )
}
