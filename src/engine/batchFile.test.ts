// The batch file: what measurement mode writes and the frame card reads.
import { describe, expect, it } from "vitest"
import {
  BATCH_COLUMNS,
  FRAME_SLOTS,
  SWATCH_IDS,
  formatBatchCsv,
  parseBatchCsv,
  swatchSlot,
  type BatchRow,
} from "./batchFile"

const row = (patch: string, extra: Partial<BatchRow> = {}): BatchRow => ({
  patch,
  lab: [95.123, -0.4, 1.2],
  sd: [0.31, 0.05, 0.121],
  n: 6,
  method: "camera vs ColorChecker",
  date: "2026-10-18",
  ...extra,
})

const HEADER = BATCH_COLUMNS.join(",")

describe("writing", () => {
  it("is the header, then one line per patch, Lab and spread to two decimals", () => {
    expect(formatBatchCsv([row("G1"), row("S01", { sd: undefined, n: undefined, method: "X-Rite i1, lab 2" })])).toBe(
      [
        "patch,L,a,b,sd_L,sd_a,sd_b,n,method,date",
        "G1,95.12,-0.40,1.20,0.31,0.05,0.12,6,camera vs ColorChecker,2026-10-18",
        'S01,95.12,-0.40,1.20,,,,,"X-Rite i1, lab 2",2026-10-18',
        "",
      ].join("\n"),
    )
  })

  it("is only the header for no rows", () => {
    expect(formatBatchCsv([])).toBe(`${HEADER}\n`)
  })
})

describe("reading", () => {
  it("gives back what was written, to the two decimals written", () => {
    const rows = [row("G1"), row("S01", { sd: undefined, n: undefined, method: 'a "quoted", method' })]
    expect(parseBatchCsv(formatBatchCsv(rows))).toEqual([
      { patch: "G1", lab: [95.12, -0.4, 1.2], sd: [0.31, 0.05, 0.12], n: 6, method: "camera vs ColorChecker", date: "2026-10-18" },
      { patch: "S01", lab: [95.12, -0.4, 1.2], method: 'a "quoted", method', date: "2026-10-18" },
    ])
  })

  it("leaves patch ids and completeness to the reader: a repeated or unknown id is not refused here", () => {
    const text = `${HEADER}\nG1,95,0,1,,,,,m,2026-10-18\nG1,90,0,1,,,,,m,2026-10-18\nZ9,90,0,1,,,,,m,2026-10-18\n`
    expect(parseBatchCsv(text).map((r) => r.patch)).toEqual(["G1", "G1", "Z9"])
  })

  it("accepts a header in another case, as a spreadsheet may save it", () => {
    expect(parseBatchCsv("Patch,l,A,B,SD_L,sd_A,Sd_b,N,Method,DATE\nG1,95,0,1,,,,,m,2026-10-18\n")).toHaveLength(1)
  })

  it("accepts a byte order mark, CRLF line ends, a missing final newline and blank lines", () => {
    const text = "﻿" + formatBatchCsv([row("G1"), row("G2")]).trimEnd().replaceAll("\n", "\r\n\r\n")
    expect(parseBatchCsv(text).map((r) => r.patch)).toEqual(["G1", "G2"])
  })

  it.each([
    ["a wrong header", "patch,L,a\nG1,1,2\n", /Line 1: the first line must be the header/],
    ["a header with the columns in another order", "patch,a,L,b,sd_L,sd_a,sd_b,n,method,date\n", /Line 1/],
    ["no header", "", /Line 1: the first line must be the header/],
    ["a short line", `${HEADER}\nG1,95,0,1\n`, /Line 2: expected 10 columns, found 4/],
    ["a bad number", `${HEADER}\nG1,95,x,1,,,,,m,2026-10-18\n`, /Line 2, a: "x" is not a number/],
    ["a bad date", `${HEADER}\nG1,95,0,1,,,,,m,18/10/2026\n`, /Line 2, date: "18\/10\/2026" is not a YYYY-MM-DD date/],
    ["a half-given spread", `${HEADER}\nG1,95,0,1,0.3,,,,m,2026-10-18\n`, /Line 2, sd_a/],
    ["a fractional shot count", `${HEADER}\nG1,95,0,1,,,,2.5,m,2026-10-18\n`, /Line 2, n/],
    ["an impossible date", `${HEADER}\nG1,95,0,1,,,,,m,2026-02-30\n`, /Line 2, date: "2026-02-30" is not a YYYY-MM-DD date/],
    ["a lightness out of range", `${HEADER}\nG1,101,0,1,,,,,m,2026-10-18\n`, /Line 2, L: 101 is outside 0 to 100/],
    ["a negative lightness", `${HEADER}\nG1,-1,0,1,,,,,m,2026-10-18\n`, /Line 2, L: -1 is outside 0 to 100/],
    ["an a out of range", `${HEADER}\nG1,50,129,1,,,,,m,2026-10-18\n`, /Line 2, a: 129 is outside -128 to 128/],
    ["a b out of range", `${HEADER}\nG1,50,0,-130,,,,,m,2026-10-18\n`, /Line 2, b: -130 is outside -128 to 128/],
    ["a negative spread", `${HEADER}\nG1,50,0,1,0.1,-0.2,0.1,,m,2026-10-18\n`, /Line 2, sd_a: -0.2 is outside 0 to any size/],
    ["no shots", `${HEADER}\nG1,50,0,1,,,,0,m,2026-10-18\n`, /Line 2, n: 0 is outside 1 to any size/],
    ["an empty method", `${HEADER}\nG1,50,0,1,,,,,,2026-10-18\n`, /Line 2, method: is empty/],
    ["an empty patch", `${HEADER}\n,50,0,1,,,,,m,2026-10-18\n`, /Line 2, patch: is empty/],
    ["an unclosed quote", `${HEADER}\nG1,95,0,1,,,,,"m,2026-10-18\n`, /ends inside a quoted field/],
  ])("refuses %s, saying where", (_what, text, message) => {
    expect(() => parseBatchCsv(text)).toThrow(message)
  })
})

describe("swatches and slots", () => {
  it("has 18 of each: swatch_01 to _06 are the grays G1 to G6, swatch_07 to _18 the soil colors S01 to S12", () => {
    expect(SWATCH_IDS).toHaveLength(18)
    expect(FRAME_SLOTS).toHaveLength(18)
    expect(swatchSlot("swatch_01")).toBe("G1")
    expect(swatchSlot("swatch_06")).toBe("G6")
    expect(swatchSlot("swatch_07")).toBe("S01")
    expect(swatchSlot("swatch_18")).toBe("S12")
  })

  it("refuses a name that is not a tile of the card", () => {
    expect(() => swatchSlot("swatch_19")).toThrow(/not one of the swatch card's tiles/)
  })
})
