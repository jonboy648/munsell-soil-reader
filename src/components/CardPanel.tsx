// The Card: which corner to tap next, drawn as the Card itself, or what is already marked.
import { cn } from "@/lib/utils"
import { CORNER_COUNT } from "@/lib/session"

// Corner patches in the order the user taps them, and how to find each on the Card.
const CORNERS = [
  { cell: 0, name: "brown patch (top left)" },
  { cell: 5, name: "bluish-green patch (top right)" },
  { cell: 23, name: "black patch (bottom right)" },
  { cell: 18, name: "white patch (bottom left)" },
]

interface Props {
  /** How many corners are tapped so far. */
  tapped: number
  noCard: boolean
}

/** The Card's 24 patches as a small grid; the corner to tap next is outlined and numbered. */
function CardDiagram({ tapped }: { tapped: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid shrink-0 grid-cols-6 gap-[3px] rounded-md bg-muted p-1.5"
      style={{ width: 96 }}
    >
      {Array.from({ length: 24 }, (_, cell) => {
        const order = CORNERS.findIndex((c) => c.cell === cell)
        const done = order >= 0 && order < tapped
        const next = order === tapped
        return (
          <span
            key={cell}
            className={cn(
              "grid aspect-square place-items-center rounded-[2px] font-mono text-[9px] font-bold leading-none",
              order < 0 && "bg-muted-foreground/25",
              done && "bg-foreground text-background",
              next && "bg-background text-foreground ring-2 ring-foreground",
              order >= 0 && !done && !next && "bg-muted-foreground/50",
            )}
          >
            {order >= 0 ? order + 1 : null}
          </span>
        )
      })}
    </div>
  )
}

export function CardPanel({ tapped, noCard }: Props) {
  if (noCard) {
    return (
      <p className="text-sm text-muted-foreground">
        <b className="font-semibold text-foreground">No Card.</b> Readings come straight from the
        Photo, so the light and the camera shift them.
      </p>
    )
  }
  if (tapped >= CORNER_COUNT) {
    return (
      <p className="text-sm text-muted-foreground">
        <b className="font-semibold text-foreground">Card marked.</b> The 24 patches are outlined on
        the Photo.
      </p>
    )
  }
  return (
    <div className="flex items-center gap-3">
      <CardDiagram tapped={tapped} />
      <p className="text-base" data-testid="corner-prompt">
        Tap the middle of the Card's{" "}
        <b className="font-semibold underline decoration-2 underline-offset-4">
          {CORNERS[tapped].name}
        </b>
        . <span className="font-mono text-sm text-muted-foreground">{tapped + 1}/{CORNER_COUNT}</span>
      </p>
    </div>
  )
}
