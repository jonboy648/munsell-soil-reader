// The Readings: a peek at the latest one above the bottom bar, and every Spot's Reading in a
// bottom sheet. Raw and corrected sit side by side, with the nearest Chip and the Card check.
import { ChevronUp } from "lucide-react"
import type { ChipReading, ReadPhotoResult, RgbTriple } from "@/engine"
import { CardCheckBadge } from "@/components/CardCheckBadge"
import { QualityFlag, QualityWarnings, cardWarnings, warningsFor } from "@/components/QualityWarnings"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { shownReading, type CardInfo } from "@/lib/verdict"

const css = (rgb: RgbTriple) => `rgb(${rgb.join(",")})`
const fmt = (n: number) => n.toFixed(1)

/** A block of color: the one place besides the Photo where color appears on screen. */
function ColorBlock({ rgb, label }: { rgb: RgbTriple; label: string }) {
  return (
    <div className="grid w-16 gap-1 text-center">
      <div
        role="img"
        aria-label={`${label} color`}
        className="h-20 rounded-sm border border-foreground/25"
        style={{ background: css(rgb) }}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function ReadingRow({ label, reading }: { label: string; reading: ChipReading }) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className="py-2 pr-2 text-left font-medium">{label}</th>
      <td className="py-2 pr-2">
        <span
          aria-hidden="true"
          className="inline-block h-4 w-6 rounded-[3px] border border-foreground/25 align-middle"
          style={{ background: css(reading.rgb) }}
        />
      </td>
      <td className="py-2 pr-2 font-mono whitespace-nowrap">{reading.chip.notation}</td>
      <td className="py-2 pr-2 font-mono whitespace-nowrap text-muted-foreground">{reading.exact}</td>
      <td className="py-2 text-right font-mono">{fmt(reading.chipDE)}</td>
    </tr>
  )
}

function SpotReading({ result, index, card }: { result: ReadPhotoResult; index: number; card: CardInfo }) {
  const reading = result.readings[index]
  const { verdict, main, beside, why } = shownReading(reading, result.cardCheck, cardWarnings(result.quality), result.offCard, card)
  const corrected = verdict === "good" || verdict === "caution"
  const leftOut = result.cardCheck?.leftOut ?? []
  const better = corrected && card.kind === "page" ? reading.betterPage : undefined
  return (
    <section aria-label={`Spot ${index + 1}`} className="grid gap-3 border-t border-border py-4 first:border-t-0">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Spot {index + 1}
      </h3>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p data-testid="drawer-notation" className="font-mono text-4xl leading-none font-semibold tracking-tight">
            {main.chip.notation}
          </p>
          <p data-testid="drawer-name" className="mt-1 text-base">{main.chip.name}</p>
          <p className="mt-2 font-mono text-sm text-muted-foreground">exact {main.exact}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <ColorBlock rgb={main.rgb} label={corrected ? "Corrected" : "Raw"} />
          {beside && <ColorBlock rgb={beside.rgb} label="Raw" />}
          <ColorBlock rgb={main.chipRgb} label="Chip" />
        </div>
      </div>
      <div>
        <CardCheckBadge verdict={verdict} cardCheck={result.cardCheck} />
      </div>
      <p className="text-sm text-muted-foreground">{why}</p>
      {card.kind === "page" && leftOut.length > 0 && (
        <p className="text-sm" data-testid="left-out">
          <b className="font-semibold">Left out of the fit:</b>{" "}
          <span className="font-mono">{leftOut.join(", ")}</span>. {leftOut.length === 1 ? "It" : "They"}{" "}
          disagreed with the rest of the Page, as a smudged or worn Chip does.
        </p>
      )}
      {better && card.kind === "page" && (
        <p className="text-sm" data-testid="better-page">
          <b className="font-semibold">Try the {better} Page.</b> This soil reads closer to the {better} Page
          than to the {card.hue} Page you used, and the correction is strongest near the Page's own hue.
          Retake the Photo with the {better} Page beside the soil.
        </p>
      )}
      <QualityWarnings warnings={warningsFor(result.quality, index)} />
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="pb-1 text-left font-medium">Reading</th>
            <th scope="col" className="pb-1" />
            <th scope="col" className="pb-1 text-left font-medium">Chip</th>
            <th scope="col" className="pb-1 text-left font-medium">Exact</th>
            <th scope="col" className="pb-1 text-right font-medium">Off by</th>
          </tr>
        </thead>
        <tbody>
          <ReadingRow label="Raw" reading={reading.raw} />
          {reading.corrected && (
            <ReadingRow label={verdict === "failed" ? "Corrected (not trusted)" : "Corrected"} reading={reading.corrected} />
          )}
        </tbody>
      </table>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">Top 3 Chips</p>
        <ol aria-label="Top 3 Chips" className="flex flex-wrap gap-2">
          {main.top3.map(({ chip, de }) => (
            <li key={chip.notation} className="rounded-md border border-border px-2 py-1 text-sm">
              <span className="font-mono">{chip.notation}</span> {chip.name}{" "}
              <span className="font-mono text-muted-foreground">{fmt(de)}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function ReadingsPanel({ result, card }: { result: ReadPhotoResult | null; card: CardInfo }) {
  if (!result || result.readings.length === 0) return null
  const last = result.readings.length - 1
  const { verdict, main } = shownReading(result.readings[last], result.cardCheck, cardWarnings(result.quality), result.offCard, card)
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 border-t border-border bg-card px-4 py-3 text-left"
          aria-label="Open Readings"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Spot {last + 1} Reading</span>
            <span data-testid="reading-notation" className="block font-mono text-3xl leading-tight font-semibold tracking-tight">
              {main.chip.notation}
            </span>
            <QualityFlag warnings={warningsFor(result.quality, last)} />
          </span>
          <CardCheckBadge verdict={verdict} />
          <ChevronUp className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Readings</DrawerTitle>
          <DrawerDescription>
            "Off by" is the CIEDE2000 color difference to the nearest Chip. Under 2 is hard to see.
            Over 3 is usually a different Chip.
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          {result.readings.map((_, i) => (
            <SpotReading key={i} result={result} index={i} card={card} />
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
