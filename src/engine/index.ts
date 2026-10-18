// The reading engine's public surface. Pure TypeScript: no DOM, no React.
export { readPhoto, CARD_CHECK_GOOD, UnsupportedCardError } from "./readPhoto"
export { deltaE2000 } from "./color"
export { patchSites } from "./colorchecker"
export { gridMap, gridSites } from "./grid"
export { spotRadius } from "./sampling"
export type { Four, GridMap, GridPoint, Site } from "./grid"
export type {
  Card,
  CardCheck,
  Chip,
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
