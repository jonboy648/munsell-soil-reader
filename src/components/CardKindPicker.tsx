// Which Card is in the Photo: the ColorChecker, whose corners the user taps, or the frame, which
// the app finds by its markers.
import { cn } from "@/lib/utils"
import type { CardKind } from "@/lib/session"

const KINDS: { kind: CardKind; name: string }[] = [
  { kind: "colorchecker", name: "ColorChecker" },
  { kind: "frame", name: "Frame" },
]

interface Props {
  cardKind: CardKind
  onCardKind: (kind: CardKind) => void
}

export function CardKindPicker({ cardKind, onCardKind }: Props) {
  return (
    <div role="group" aria-label="Card in the Photo" className="flex items-center gap-2">
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Card</span>
      {KINDS.map(({ kind, name }) => (
        <button
          key={kind}
          type="button"
          aria-pressed={cardKind === kind}
          onClick={() => onCardKind(kind)}
          className={cn(
            "min-h-10 flex-1 rounded-lg border px-3 text-sm font-medium",
            cardKind === kind ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground",
          )}
        >
          {name}
        </button>
      ))}
    </div>
  )
}
