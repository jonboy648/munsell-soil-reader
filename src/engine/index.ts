// The reading engine's public surface. Pure TypeScript: no DOM, no React.
export { readPhoto, CARD_CHECK_GOOD, UnsupportedCardError } from "./readPhoto"
export { deltaE2000 } from "./color"
export { BATCH_COLUMNS, BATCH_METHOD_CAMERA, FRAME_SLOTS, SWATCH_IDS, formatBatchCsv, parseBatchCsv, swatchSlot } from "./batchFile"
export { batchRows, measureShot, summarizeShots, swatchRadius } from "./measure"
export { patchSites } from "./colorchecker"
export { gridMap, gridSites } from "./grid"
export { spotRadius } from "./sampling"
export { CHIP_LIST } from "./chipList"
export { SOIL_BOOK_CHIPS } from "./chips"
export type { BatchRow } from "./batchFile"
export type { Four, GridMap, GridPoint, Site } from "./grid"
export type { MeasureSummary, ShotMeasurement, SwatchSummary, SwatchTap } from "./measure"
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
