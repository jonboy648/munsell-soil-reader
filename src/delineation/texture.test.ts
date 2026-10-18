// The pick lists the Soil page asks for: texture (NRCS Field Book), the redox codes (the form's own
// footnotes, read from the official page), restriction kinds, and typed colors.
import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"
import { REDOX_LOCATIONS, REDOX_TYPES, RESTRICTION_KINDS } from "./codes"
import { checkColor } from "./colorCheck"
import { notationOf } from "./model"
import { ORGANIC_TERMS, TEXTURE_CLASSES, isBaseTerm, parseTextureTerm, textureCode, textureTerm } from "./texture"
import { pdfText } from "./testing/pdfText"

describe("the Field Book's texture classes", () => {
  test("there are the 21 classes of p. 2-36, with their codes", () => {
    expect(TEXTURE_CLASSES.map((t) => `${t.term} ${t.code}`)).toEqual([
      "coarse sand COS", "sand S", "fine sand FS", "very fine sand VFS",
      "loamy coarse sand LCOS", "loamy sand LS", "loamy fine sand LFS", "loamy very fine sand LVFS",
      "coarse sandy loam COSL", "sandy loam SL", "fine sandy loam FSL", "very fine sandy loam VFSL",
      "loam L", "silt loam SIL", "silt SI", "sandy clay loam SCL", "clay loam CL", "silty clay loam SICL",
      "sandy clay SC", "silty clay SIC", "clay C",
    ])
    expect(ORGANIC_TERMS.map((t) => `${t.term} ${t.code}`)).toEqual(["muck MUCK", "mucky peat MPT", "peat PEAT"])
  })

  test("the mucky modifier goes on a mineral class only, and a stored term comes apart again", () => {
    expect(textureTerm("silt loam", true)).toBe("mucky silt loam")
    expect(textureTerm("silt loam", false)).toBe("silt loam")
    expect(textureTerm("muck", true)).toBe("muck")
    expect(textureTerm("peat", true)).toBe("peat")
    for (const t of [...TEXTURE_CLASSES, ...ORGANIC_TERMS]) {
      expect(parseTextureTerm(t.term)).toEqual({ base: t.term, mucky: false })
      expect(isBaseTerm(t.term)).toBe(true)
    }
    for (const t of TEXTURE_CLASSES) expect(parseTextureTerm(`mucky ${t.term}`)).toEqual({ base: t.term, mucky: true })
    expect(parseTextureTerm("mucky muck")).toBeNull()
    expect(parseTextureTerm("gravelly loam")).toBeNull()
    expect(parseTextureTerm("")).toBeNull()
  })

  test("a term has a short code for a narrow column", () => {
    expect(textureCode("silty clay loam")).toBe("SICL")
    expect(textureCode("mucky silty clay loam")).toBe("MK-SICL")
    expect(textureCode("mucky peat")).toBe("MPT")
    expect(textureCode("muck")).toBe("MUCK")
  })
})

describe("the form's own codes", () => {
  const printed = async () => (await pdfText(new Uint8Array(readFileSync(new URL("./regions/ncne/soil-page.pdf", import.meta.url))))).map((d) => d.text)

  test("the redox types and locations are the ones the form's footnotes name", async () => {
    const text = await printed()
    const typeNote = text.find((t) => t.startsWith("Type: C="))
    const locationNote = text.find((t) => t.startsWith("Location: PL="))
    expect(typeNote).toBe(`Type: ${REDOX_TYPES.map((t) => `${t.code}=${t.name}`).join(", ")}.`)
    expect(locationNote).toBe(`Location: ${REDOX_LOCATIONS.map((l) => `${l.code}=${l.name}`).join(", ")}.`)
  })

  test("the restrictive layer kinds are the Field Book's twenty", () => {
    expect(RESTRICTION_KINDS).toHaveLength(20)
    expect(new Set(RESTRICTION_KINDS).size).toBe(20)
    expect(RESTRICTION_KINDS).toContain("fragipan")
    expect(RESTRICTION_KINDS).toContain("lithic bedrock")
  })
})

describe("a color typed in by hand", () => {
  test("a Chip of the soil book is accepted with its name", () => {
    expect(checkColor("10YR 4/2")).toMatchObject({ kind: "chip", notation: "10YR 4/2", name: "dark grayish brown" })
    expect(checkColor("10yr 4.0/2.0")).toMatchObject({ kind: "chip", notation: "10YR 4/2" })
    expect(checkColor("N 2.5/")).toMatchObject({ kind: "chip", name: "black" })
    expect(checkColor("5GY 5/1")).toMatchObject({ kind: "chip" })
  })

  test("a notation the book does not print is accepted as exact, with a note, and prints as typed", () => {
    for (const typed of ["7.5YR 4.5/3", "10YR 4/2.5", "7.5YR 4/10"]) {
      const check = checkColor(typed)
      expect(check, typed).toMatchObject({ kind: "exact", notation: typed.toUpperCase() })
      expect("note" in check && check.note).toContain("not a Chip in the soil book")
    }
  })

  test("what is not a Munsell color is refused in plain words", () => {
    expect(checkColor("brown")).toEqual({ kind: "bad", problem: "type a soil-book color such as 10YR 4/2." })
    for (const typed of ["10YR 11/2", "10YR 4/40", "10YR 0/0", "N 15/", "12YR 4/2"]) {
      const check = checkColor(typed)
      expect(check.kind, typed).toBe("bad")
      expect("problem" in check && check.problem, typed).toContain("outside the Munsell system")
    }
    expect(checkColor("Gley1 3/10Y")).toMatchObject({ kind: "bad", problem: expect.stringContaining("gley color by its hue") })
  })

  test("numbers are written the way the book writes them", () => {
    expect(notationOf("10yr 4.0/2.0")).toBe("10YR 4/2")
    expect(notationOf("2.50Y 5/3")).toBe("2.5Y 5/3")
    expect(notationOf("n 2.50")).toBe("N 2.5/")
  })
})
