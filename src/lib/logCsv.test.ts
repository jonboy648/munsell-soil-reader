// The CSV's guard for text Excel would not read as text. The strings are the ones Excel 16
// turned into formulas, numbers, times, dates or booleans, plus the ones it always caught.
import { describe, expect, test } from "vitest"
import { asText } from "@/lib/logCsv"

describe("text Excel would read as something else gets a leading apostrophe", () => {
  const formulas = ["=1+1", '=HYPERLINK("http://example.com")', "+5", "-5", "@x", "@home, 5 m from the road", "\tx", "\rx", "- slight effervescence"]
  const numbers = ["001", "1-2", "3/4", "1e5", "1.5", ".5", " 7", "2024-01-05", "10° slope", "12:30"]
  const times = ["1 A", "10 A", "3 p", "11 pm"]
  const dates = ["1-Mar", "Mar 5", "Oct 3", "Sep-12", "5 March", "March 5, 2026", "Dec 25"]
  const other = ["(5)", "($5)", "$5", "€5", "TRUE", "false", "True"]

  test.each([...formulas, ...numbers, ...times, ...dates, ...other])("%j", (text) => {
    expect(asText(text)).toBe(`'${text}`)
  })
})

describe("text that is only text stays as typed", () => {
  test.each([
    "",
    "A1",
    "Pit 3",
    "Pit 1 A",
    "Sample 12",
    "North pit",
    "(north pit)",
    "Marsh 5",
    "Mar",
    "May be wet",
    "Dec 12 pit",
    "#5",
    "TRUE north",
    "Truesdale",
    "'001",
    "Dark, mottled topsoil",
  ])("%j", (text) => {
    expect(asText(text)).toBe(text)
  })
})
