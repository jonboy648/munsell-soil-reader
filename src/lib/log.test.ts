import { describe, expect, test } from "vitest"
import { cmSampleToInches, inchesFromCm, type Sample } from "./log"

// A Sample as the first version of the Log stored it: depths in centimeters.
const cmEra: Sample = {
  id: "old",
  name: "Pit 1",
  depthTop: 0,
  depthBottom: 15,
  condition: "moist",
  notes: "dark topsoil",
  location: null,
  createdAt: 1_700_000_000_000,
  readings: [],
}

describe("the Log's one-time move from centimeters to inches", () => {
  test("a cm-era Sample reads in inches, to a tenth, and nothing else changes", () => {
    expect(cmSampleToInches(cmEra)).toEqual({ ...cmEra, depthTop: 0, depthBottom: 5.9 })
    expect(cmSampleToInches({ ...cmEra, depthTop: 30, depthBottom: 45 })).toMatchObject({ depthTop: 11.8, depthBottom: 17.7 })
  })

  test("a depth that was not recorded stays not recorded", () => {
    expect(cmSampleToInches({ ...cmEra, depthTop: null, depthBottom: 2.54 })).toMatchObject({ depthTop: null, depthBottom: 1 })
  })

  test("2.54 cm is an inch", () => {
    expect(inchesFromCm(2.54)).toBe(1)
    expect(inchesFromCm(100)).toBe(39.4)
  })
})
