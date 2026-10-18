import { Check, CircleDashed, TriangleAlert } from "lucide-react"
import type { CardCheck } from "@/engine"
import { cn } from "@/lib/utils"
import type { Verdict } from "@/lib/verdict"

// Gray only, so the states differ by icon, words and border: filled = good, heavy outline =
// failed, dashed = not corrected. None of them depends on seeing a color.
const STYLE: Record<Verdict, string> = {
  good: "border-transparent bg-foreground text-background",
  failed: "border-2 border-foreground bg-background font-bold text-foreground",
  uncorrected: "border border-dashed border-foreground/70 text-foreground",
}

export function CardCheckBadge({
  verdict,
  cardCheck,
  className,
}: {
  verdict: Verdict
  cardCheck?: CardCheck
  className?: string
}) {
  const text = {
    good: "Card check good",
    failed: "Card check failed",
    uncorrected: "Not corrected",
  }[verdict]
  const Icon = { good: Check, failed: TriangleAlert, uncorrected: CircleDashed }[verdict]
  return (
    <span
      data-testid="card-check"
      data-verdict={verdict}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap",
        STYLE[verdict],
        className,
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {text}
      {cardCheck && <span className="font-mono text-xs font-normal">{cardCheck.meanDE.toFixed(1)}</span>}
    </span>
  )
}
