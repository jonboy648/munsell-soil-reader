// The root-polynomial port in correctionCandidates.testkit.ts is the baseline the comparison
// in correction.test.ts measures the shipped correction against, so it has to be right. The
// golden numbers are colour-science's own, made by golden/make_root_polynomial_golden.py.
// (A port with two wrong expansion terms once passed every other test.)
import { describe, expect, it } from "vitest"
import type { Vec3 } from "./color"
import { expandRootPolynomial, fitRootPolynomial, type RootPolynomialDegree } from "./correctionCandidates.testkit"
import golden from "./golden/rootPolynomialGolden.json"

const DEGREES: RootPolynomialDegree[] = [1, 2, 3, 4]

describe.each(DEGREES)("root-polynomial degree %i against colour-science", (degree) => {
  const expected = golden.degrees[String(degree) as "1" | "2" | "3" | "4"]

  it("expands a color into the same terms, in the same order", () => {
    golden.probes.forEach((probe, i) => {
      const terms = expandRootPolynomial(probe as Vec3, degree)
      expect(terms).toHaveLength(expected.expansion[i].length)
      terms.forEach((t, k) => expect(t, `probe ${i} term ${k}`).toBeCloseTo(expected.expansion[i][k], 10))
    })
  })

  it("corrects a color the same way", () => {
    const references = golden.measured.map((m, i) => ({ measured: m as Vec3, truth: golden.target[i] as Vec3 }))
    const correct = fitRootPolynomial(degree)(references)
    expected.corrected.forEach((want, i) => {
      correct(golden.probes[i] as Vec3).forEach((v, c) => expect(v, `probe ${i} channel ${c}`).toBeCloseTo(want[c], 6))
    })
  })
})
