// JF-1: a sampling point transcribed from a filled-in paper form, values only (no photo, no
// location, no site name). Four layers with their matrix and redox colors. This is the fixture
// the form engine, the PDF and the browser tests check against.
import { emptyHeader, type Layer, type Project, type SamplingPoint } from "../model"

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
  lat: "",
  long: "",
  datum: "",
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
  header: emptyHeader(),
  points: [JF1_POINT],
}

/** The profile rows as transcribed, in row order: depth, matrix color and %, redox color and %. */
export const JF1_ROWS = [
  ["0-20", "10YR 2/1", "100", "", ""],
  ["20-25", "10YR 3/1", "100", "", ""],
  ["25-29", "10YR 4/2", "97", "7.5YR 4/6", "3"],
  ["29-34", "10YR 5/2", "75", "7.5YR 4/6", "25"],
] as const

/**
 * JF-1's herb stratum as typed on the paper form: the names as Jon wrote them (not scientific names), the
 * absolute cover, and the plot size ("5"). Margin notes aside, the covers sum to 85. What each name should
 * come to, by the 2022 NWPL for NCNE and the supplement's rules, is in `JF1_PLANTS_EXPECTED`.
 */
export const JF1_PLANTS_TYPED: readonly (readonly [name: string, cover: number])[] = [
  ["Fall panicgrass", 50],
  ["Yellow foxtail", 10],
  ["RCG", 3],
  ["Creeping thistle", 10],
  ["Velvetleaf", 1],
  ["Barnyard grass", 5],
  ["Sow thistle", 2],
  ["Lady's thumb", 3],
  ["Stiff greenthread", 1],
]
export const JF1_REMARKS = "Bare ground - 10%"

/** [what the form prints as the name, status, how far identified] for each of `JF1_PLANTS_TYPED`. */
export const JF1_PLANTS_EXPECTED = [
  ["Panicum dichotomiflorum", "FACW", "species"],
  ["Setaria pumila", "FAC", "species"],
  ["Phalaris arundinacea", "FACW", "species"],
  ["Cirsium arvense", "FACU", "species"],
  ["Abutilon theophrasti", "FACU", "species"],
  ["Echinochloa crus-galli", "FAC", "species"],
  ["Sonchus spp.", "FACU", "genus"],
  ["Persicaria maculosa", "FAC", "species"],
  ["Stiff greenthread", "UPL", "species"],
] as const
