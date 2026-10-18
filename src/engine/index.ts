// The reading engine's public surface. Pure TypeScript: no DOM, no React.
export { readPhoto, CARD_CHECK_GOOD, UnsupportedCardError } from "./readPhoto"
export { deltaE2000 } from "./color"
export { patchCenters } from "./colorchecker"
export { patchRadius, spotRadius } from "./sampling"
export { CHIP_LIST } from "./chipList"
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
