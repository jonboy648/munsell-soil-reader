// Public JF-1 transcription plus explicitly simulated hydrology for software acceptance tests.
// This is not a field observation or validation of an actual wetland determination.
import { JF1_PLANTS_EXPECTED, JF1_PLANTS_TYPED, JF1_POINT, JF1_PROJECT, JF1_REMARKS } from "./jf1"
import { emptyHydrology, type Project, type SamplingPoint } from "../model"
import { emptyVegetation } from "../vegetation/entry"

export const JF1_DETERMINATION_PROJECT: Project = {
  ...JF1_PROJECT,
  header: { ...JF1_PROJECT.header, normalCircumstances: "yes",
    disturbed: { vegetation: "no", soil: "no", hydrology: "no" },
    problematic: { vegetation: "no", soil: "no", hydrology: "no" } },
}

export const JF1_DETERMINATION_POINT: SamplingPoint = {
  ...JF1_POINT,
  indicators: { A12: { state: "confirmed" } },
  vegetation: {
    ...emptyVegetation,
    plants: JF1_PLANTS_EXPECTED.map(([name, status, identified], i) => ({
      id: `jf-plant-${i}`, name, status, identified, stratum: "herb", listed: status, symbol: "", note: "",
      typed: JF1_PLANTS_TYPED[i][0], cover: JF1_PLANTS_TYPED[i][1],
    })),
    remarks: JF1_REMARKS,
    plotSizes: { herb: "5" },
    indicators: { rapid: { state: "confirmed" }, dominance: { state: "confirmed" } },
  },
  hydrology: { ...emptyHydrology, ticked: ["B6", "D2"], remarks: "Simulated test hydrology only; not a JF-1 field observation." },
}
