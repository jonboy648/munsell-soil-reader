// Measurement mode: the color of printed swatches, measured against a ColorChecker. Each shot is
// corrected with the normal correction and judged by the normal Card check, the swatches are
// read from it, and the shots that pass are averaged. The result is the batch file (#49 reads
// it): per swatch, the mean CIELAB under D50, its spread across shots and the number of shots.
import { linearToLabD50, type Vec3 } from "./color"
import { patchSites } from "./colorchecker"
import { fitCorrection } from "./correction"
import { BATCH_METHOD_CAMERA, swatchSlot, type BatchRow } from "./batchFile"
import { fitCard } from "./readPhoto"
import { medianLinear } from "./sampling"
import type { CardCheck, Corners, Pixels, XY } from "./types"

/**
 * A swatch is read in a circle this share of the size of the circle the ColorChecker's nearest
 * patch is read in. The swatches are 20 mm squares and a ColorChecker patch is about 40 mm, so
 * the circle stays well inside the tile with room for a tap a few millimetres off.
 */
const SWATCH_READ_SHARE = 0.5

/**
 * Radius, in Photo pixels, to read a swatch tapped at `at` in. It follows the ColorChecker patch
 * nearest the tap, so it shrinks with the swatch when the card is photographed at an angle.
 */
export function swatchRadius(corners: Corners, at: XY): number {
  const near = patchSites(corners).reduce((best, site) =>
    Math.hypot(site.center.x - at.x, site.center.y - at.y) < Math.hypot(best.center.x - at.x, best.center.y - at.y) ? site : best,
  )
  return Math.max(2, SWATCH_READ_SHARE * near.radius)
}

export interface SwatchTap {
  /** The swatch's id, swatch_01 to swatch_18. */
  id: string
  /** Where it was tapped, in Photo pixels. */
  at: XY
}

/** One Photo's measurement: how good its Card check was and what each swatch read as. */
export interface ShotMeasurement {
  cardCheck: CardCheck
  swatches: { id: string; lab: Vec3 }[]
}

/** Corrects a Photo of swatches beside a ColorChecker and reads each swatch as CIELAB under D50. */
export function measureShot(pixels: Pixels, corners: Corners, taps: SwatchTap[]): ShotMeasurement {
  const { correct, check } = fitCard(pixels, corners, fitCorrection)
  return {
    cardCheck: check,
    swatches: taps.map(({ id, at }) => ({
      id,
      lab: linearToLabD50(correct(medianLinear(pixels, at, swatchRadius(corners, at)))),
    })),
  }
}

export interface SwatchSummary {
  id: string
  /** Mean over the shots used. */
  lab: Vec3
  /** Sample standard deviation per channel; absent with a single shot. */
  sd?: Vec3
  /** Shots used. */
  n: number
}

export interface MeasureSummary {
  /** Swatches in id order, each from the shots whose Card check was good. */
  swatches: SwatchSummary[]
  /** Shots left out because the Card check was not good, by their number (1 is the first). */
  excluded: { shot: number; meanDE: number }[]
}

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length
const spread = (values: number[]) => {
  const m = mean(values)
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1))
}

/** Averages swatches across shots. A shot whose Card check is not good is left out and listed. */
export function summarizeShots(shots: ShotMeasurement[]): MeasureSummary {
  const excluded = shots.flatMap((shot, i) => (shot.cardCheck.ok ? [] : [{ shot: i + 1, meanDE: shot.cardCheck.meanDE }]))
  const reads = new Map<string, Vec3[]>()
  for (const shot of shots) {
    if (!shot.cardCheck.ok) continue
    for (const { id, lab } of shot.swatches) reads.set(id, [...(reads.get(id) ?? []), lab])
  }
  const swatches = [...reads]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, labs]): SwatchSummary => {
      const channel = (c: number) => labs.map((lab) => lab[c])
      return {
        id,
        lab: [mean(channel(0)), mean(channel(1)), mean(channel(2))],
        ...(labs.length > 1 ? { sd: [spread(channel(0)), spread(channel(1)), spread(channel(2))] as Vec3 } : {}),
        n: labs.length,
      }
    })
  return { swatches, excluded }
}

/** The summary as the batch file's rows, by frame slot. `date` is ISO, YYYY-MM-DD. */
export function batchRows(summary: MeasureSummary, date: string): BatchRow[] {
  return summary.swatches.map(({ id, lab, sd, n }) => ({
    patch: swatchSlot(id),
    lab,
    ...(sd ? { sd } : {}),
    n,
    method: BATCH_METHOD_CAMERA,
    date,
  }))
}
