// Photo quality warnings: what is wrong with the Photo, where, and what to do about it.
// Gray only, so a warning differs from the rest by icon, a heavy left edge and bold words,
// never by color.
import { CircleAlert, Contrast, Maximize2, Sun, SunDim } from "lucide-react"
import type { QualityWarning } from "@/engine"

const TITLE: Record<QualityWarning["kind"], string> = {
  glare: "Glare",
  clipped: "Clipped",
  "uneven-light": "Uneven light",
  "card-too-small": "Card too small",
}

const ICON = {
  glare: Sun,
  clipped: Contrast,
  "uneven-light": SunDim,
  "card-too-small": Maximize2,
}

/** Where a warning applies, in the words the interface uses elsewhere. */
export const placeOf = (where: QualityWarning["where"]): string =>
  where === "card" ? "Card" : `Spot ${where + 1}`

/** The warnings that concern the Card and one Spot, the Card's first. */
export const warningsFor = (quality: QualityWarning[], spotIndex: number): QualityWarning[] =>
  quality.filter((w) => w.where === "card" || w.where === spotIndex)

/** A warning's one-line label for the peek above the bottom bar. */
export function QualityFlag({ warnings }: { warnings: QualityWarning[] }) {
  if (warnings.length === 0) return null
  const [first] = warnings
  return (
    <span
      data-testid="quality-flag"
      className="mt-1 inline-flex h-7 items-center gap-1.5 rounded-full border border-foreground px-3 text-sm font-semibold whitespace-nowrap"
    >
      <CircleAlert className="size-4" aria-hidden="true" />
      {warnings.length === 1 ? `${TITLE[first.kind]}: ${placeOf(first.where)}` : `${warnings.length} warnings`}
    </span>
  )
}

export function QualityWarnings({ warnings }: { warnings: QualityWarning[] }) {
  if (warnings.length === 0) return null
  return (
    <ul className="grid gap-2" aria-label="Photo warnings">
      {warnings.map((w) => {
        const Icon = ICON[w.kind]
        return (
          <li
            key={`${w.kind}-${w.where}`}
            data-testid="quality-warning"
            data-kind={w.kind}
            data-where={w.where}
            className="grid gap-1 rounded-sm border border-foreground/40 border-l-4 border-l-foreground py-2 pr-3 pl-3"
          >
            <p className="flex items-center gap-2 text-sm font-bold">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {TITLE[w.kind]}
              <span className="font-medium text-muted-foreground">{placeOf(w.where)}</span>
            </p>
            <p className="text-sm">{w.advice}</p>
          </li>
        )
      })}
    </ul>
  )
}
