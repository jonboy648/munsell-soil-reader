// The reading engine's public surface. Pure TypeScript: no DOM, no React.
export { readPhoto, UnsupportedCardError } from "./readPhoto"
export { CARD_CHECK_GOOD, CARD_CHECK_CAUTION } from "./cardCheck"
export { deltaE2000 } from "./color"
export { patchSites } from "./colorchecker"
export { gridMap, gridSites } from "./grid"
export { PAGE_CHROMAS, PAGE_HUES, isPageHue, pageModel, pagePaperSites, pageSites, suggestedPage } from "./page"
export { spotRadius } from "./sampling"
export { CHIP_LIST } from "./chipList"
export { SOIL_BOOK_CHIPS } from "./chips"
export type { Four, GridMap, GridPoint, Site } from "./grid"
export type { PageChip, PageHue, PageModel } from "./page"
export type {
  Card,
  CardCheck,
  Chip,
  ChipPage,
  ChipReading,
  Corners,
  Pixels,
  QualityWarning,
  ReadPhotoInput,
  ReadPhotoResult,
  Reading,
  RgbTriple,
  XY,
} from "./types"
