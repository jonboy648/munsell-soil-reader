// JF-1: a sampling point transcribed from a filled-in paper form, values only (no photo, no
// location, no site name). Four layers with their matrix and redox colors. This is the fixture
// the form engine, the PDF and the browser tests check against.
import type { Layer, Project, SamplingPoint } from "../model"

const layer = (top: number, bottom: number, matrix: string, matrixPercent: number, redox?: [string, number]): Layer => ({
  id: `jf1-${top}-${bottom}`,
  top,
  bottom,
  matrix: { notation: matrix, percent: matrixPercent },
  redox: redox ? [{ notation: redox[0], percent: redox[1] }] : [],
  remarks: "",
})

export const JF1_POINT: SamplingPoint = {
  id: "jf-1",
  name: "JF-1",
  layers: [
    layer(0, 20, "10YR 2/1", 100),
    layer(20, 25, "10YR 3/1", 100),
    layer(25, 29, "10YR 4/2", 97, ["7.5YR 4/6", 3]),
    layer(29, 34, "10YR 5/2", 75, ["7.5YR 4/6", 25]),
  ],
}

export const JF1_PROJECT: Project = {
  id: "jf-project",
  name: "JF fixture",
  region: "NCNE",
  createdAt: 0,
  points: [JF1_POINT],
}

/** The profile rows as transcribed, in row order: depth, matrix color and %, redox color and %. */
export const JF1_ROWS = [
  ["0-20", "10YR 2/1", "100", "", ""],
  ["20-25", "10YR 3/1", "100", "", ""],
  ["25-29", "10YR 4/2", "97", "7.5YR 4/6", "3"],
  ["29-34", "10YR 5/2", "75", "7.5YR 4/6", "25"],
] as const
