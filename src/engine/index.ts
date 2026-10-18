// The reading engine's public surface. Pure TypeScript: no DOM, no React.
export {
  readPhoto,
  CARD_CHECK_GOOD,
  FRAME_OFF_CARD_STOPS,
  FRAME_UNEVEN_STOPS,
  UnsupportedCardError,
} from "./readPhoto"
export {
  BLOWN_CHANNELS,
  BLOWN_LEVEL,
  CLIP_SHARE,
  CRUSHED_LEVEL,
  GLARE_SHARE,
  MIN_LIT_SAMPLES,
  MIN_SPACING_PX,
  NEAR_CLIP_LEVEL,
  WHITE_CLIPPED_LEVEL,
} from "./quality"
export { deltaE2000 } from "./color"
export { patchSites } from "./colorchecker"
export { gridMap, gridSites } from "./grid"
export { spotRadius } from "./sampling"
export { CHIP_LIST } from "./chipList"
export { SOIL_BOOK_CHIPS } from "./chips"
export type { Four, GridMap, GridPoint, Site } from "./grid"
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
