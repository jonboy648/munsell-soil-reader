// The Card: which one it is, which corner or Chip to tap next, drawn as the Card itself, or what
// is already marked.
import { PAGE_CHROMAS, PAGE_HUES, pageModel, type PageHue } from "@/engine"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group-1"
import { cn } from "@/lib/utils"
import { CORNER_COUNT, type CardKind } from "@/lib/session"

// Corner patches in the order the user taps them, and how to find each on the Card.
const CORNERS = [
  { cell: 0, name: "brown patch (top left)" },
  { cell: 5, name: "bluish-green patch (top right)" },
  { cell: 23, name: "black patch (bottom right)" },
  { cell: 18, name: "white patch (bottom left)" },
]

/** Where each of a Page's four Chips is on the Page, in the order they are tapped. */
function pageTapName(hue: PageHue, tapped: number): string {
  if (tapped === 1) {
    // The last Chip of the top row is at the top right only on a Page whose top row is full.
    const { chips, taps } = pageModel(hue)
    const lastCol = Math.max(...chips.map((c) => c.col))
    return taps[1].col === lastCol ? "top right" : "last Chip of the top row"
  }
  return ["top left", "top right", "lowest in the last column", "bottom left"][tapped]
}

interface Props {
  /** How many corners are tapped so far. */
  tapped: number
  noCard: boolean
  cardKind: CardKind
  /** The Page's hue, once chosen. */
  hue: PageHue | null
  /** Absent where the Card is fixed (measurement mode), which hides the choice of Card. */
  onCardKind?: (kind: CardKind) => void
  onHue?: (hue: PageHue) => void
}

/** Two or more choices side by side, one chosen. Gray, so the choice never tints the Photo. */
function Choice<T extends string>({
  label,
  options,
  value,
  onPick,
  testId,
}: {
  label: string
  options: { value: T; text: string }[]
  value: T | null
  onPick: (value: T) => void
  testId: string
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="lg"
      aria-label={label}
      data-testid={testId}
      value={value ?? ""}
      // Pressing the chosen one again would clear it; a choice stays chosen.
      onValueChange={(picked) => picked && onPick(picked as T)}
      className="w-fit max-w-full flex-wrap shadow-none"
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className="text-sm">
          {option.text}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
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

/**
 * The Page's Chips as a small grid: the printed ones filled, the four to tap numbered, the next
 * one outlined. The grid's bottom right is often empty, so the four are not its corners.
 */
function PageDiagram({ hue, tapped }: { hue: PageHue; tapped: number }) {
  const { values, chips, taps } = pageModel(hue)
  const printed = new Set(chips.map((c) => `${c.col},${c.row}`))
  return (
    <div
      aria-hidden="true"
      data-testid="page-diagram"
      className="grid shrink-0 gap-[3px] rounded-md bg-muted p-1.5"
      style={{ width: 84, gridTemplateColumns: `repeat(${PAGE_CHROMAS.length}, 1fr)` }}
    >
      {values.flatMap((_, row) =>
        PAGE_CHROMAS.map((_, col) => {
          const order = taps.findIndex((t) => t.col === col && t.row === row)
          const done = order >= 0 && order < tapped
          const next = order === tapped
          const isPrinted = printed.has(`${col},${row}`)
          return (
            <span
              key={`${col},${row}`}
              className={cn(
                "grid aspect-[3/4] place-items-center rounded-[2px] font-mono text-[9px] font-bold leading-none",
                isPrinted && order < 0 && "bg-muted-foreground/25",
                done && "bg-foreground text-background",
                next && "bg-background text-foreground ring-2 ring-foreground",
                order >= 0 && !done && !next && "bg-muted-foreground/50",
              )}
            >
              {order >= 0 ? order + 1 : null}
            </span>
          )
        }),
      )}
    </div>
  )
}

/** The prompt for the next Chip to tap on a Page, naming it the way the book prints it. */
function PageTapPrompt({ hue, tapped }: { hue: PageHue; tapped: number }) {
  const { chip } = pageModel(hue).taps[tapped]
  return (
    <p className="text-base" data-testid="corner-prompt">
      Tap the middle of the Chip{" "}
      <b className="font-semibold underline decoration-2 underline-offset-4">
        {chip.value}/{chip.chroma}
      </b>{" "}
      ({pageTapName(hue, tapped)}).{" "}
      <span className="font-mono text-sm text-muted-foreground">{tapped + 1}/{CORNER_COUNT}</span>
    </p>
  )
}

export function CardPanel({ tapped, noCard, cardKind, hue, onCardKind, onHue }: Props) {
  if (noCard) {
    return (
      <p className="text-sm text-muted-foreground">
        <b className="font-semibold text-foreground">No Card.</b> Readings come straight from the
        Photo, so the light and the camera shift them.
      </p>
    )
  }
  const picker = onCardKind && onHue && (
    <div className="grid gap-2">
      <Choice
        label="Card"
        testId="card-kind"
        value={cardKind}
        onPick={onCardKind}
        options={[
          { value: "colorchecker", text: "ColorChecker" },
          { value: "page", text: "Soil-book Page" },
        ]}
      />
      {cardKind === "page" && (
        <Choice
          label="Page hue"
          testId="page-hue"
          value={hue}
          onPick={onHue}
          options={PAGE_HUES.map((h) => ({ value: h, text: h }))}
        />
      )}
    </div>
  )
  if (cardKind === "page" && !hue) {
    return (
      <div className="grid gap-2">
        {picker}
        <p className="text-base" data-testid="hue-prompt">
          Choose the hue printed on the Page you laid beside the soil.
        </p>
      </div>
    )
  }
  if (tapped >= CORNER_COUNT) {
    return (
      <div className="grid gap-2">
        {picker}
        <p className="text-sm text-muted-foreground">
          <b className="font-semibold text-foreground">Card marked.</b>{" "}
          {cardKind === "page"
            ? `The ${pageModel(hue!).chips.length} Chips are outlined on the Photo. Tap a Spot inside a hole, where the soil shows through.`
            : "The 24 patches are outlined on the Photo."}
        </p>
      </div>
    )
  }
  return (
    <div className="grid gap-2">
      {picker}
      {cardKind === "page" ? (
        <div className="flex items-center gap-3">
          <PageDiagram hue={hue!} tapped={tapped} />
          <PageTapPrompt hue={hue!} tapped={tapped} />
        </div>
      ) : (
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
      )}
    </div>
  )
}
