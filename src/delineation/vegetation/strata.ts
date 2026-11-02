// The four vegetation strata of the form (supplement ch. 2, pp. 18-19), and the plot each is sampled in.
export const STRATA = ["tree", "saplingShrub", "herb", "woodyVine"] as const
export type Stratum = (typeof STRATA)[number]

export const STRATUM_LABEL: Record<Stratum, string> = {
  tree: "Tree",
  saplingShrub: "Sapling/shrub",
  herb: "Herb",
  woodyVine: "Woody vine",
}

/** What each stratum is, in the supplement's words (p. 18), for the entry screen. */
export const STRATUM_DEFINITION: Record<Stratum, string> = {
  tree: "Woody plants 3 in. (7.6 cm) or more in diameter at breast height, regardless of height.",
  saplingShrub: "Woody plants less than 3 in. DBH and at least 3.28 ft (1 m) tall.",
  herb: "All herbaceous plants, including herbaceous vines, regardless of size, and woody plants less than 3.28 ft tall.",
  woodyVine: "All woody vines greater than 3.28 ft in height.",
}

/** The plot the supplement suggests for each stratum (p. 19), as it is written in the form's Plot size field. */
export const SUGGESTED_PLOT: Record<Stratum, string> = {
  tree: "30 ft radius",
  saplingShrub: "15 ft radius",
  herb: "5 ft radius",
  woodyVine: "30 ft radius",
}
