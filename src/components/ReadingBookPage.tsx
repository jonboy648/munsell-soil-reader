import { SOIL_BOOK_CHIPS } from "@/engine/chips"
import type { Chip, ChipPage } from "@/engine"

const PAGE_LABELS: Partial<Record<ChipPage, string>> = { GLEY1: "Gley 1", GLEY2: "Gley 2", WHITE: "White" }

/** Resolve from the book catalog even for older saved readings that did not carry page metadata. */
export function ReadingBookPage({ chip }: { chip: Chip }) {
  const pages = SOIL_BOOK_CHIPS.find((known) => known.notation === chip.notation)?.pages
  const label = pages?.map((page) => PAGE_LABELS[page] ?? page).join(" / ")
  return <p className="text-sm text-muted-foreground">{label ? `Soil book page: ${label}` : "This saved result is not in the current soil-book catalog; check it against your book."}</p>
}
