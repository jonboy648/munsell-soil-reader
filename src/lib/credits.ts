// What the app builds on, and where each license's full text is. The texts are not copied here:
// THIRD_PARTY_NOTICES.md and LICENSE are the one source, bundled into the app as text, so the
// method page can show them with no network.
import licenseRaw from "../../LICENSE?raw"
import noticesRaw from "../../THIRD_PARTY_NOTICES.md?raw"

// A checkout on Windows can turn line ends into CRLF; the parsing below reads LF.
const licenseFile = licenseRaw.replaceAll("\r\n", "\n")
const noticesFile = noticesRaw.replaceAll("\r\n", "\n")

export interface Credit {
  name: string
  /** The license, as its short name. */
  license: string
  /** Who made it. */
  by: string
  /** What the app uses it for, in plain words. */
  used: string
  /** Where it comes from, or its license on the web. */
  links: { label: string; href: string }[]
  /** The heading in THIRD_PARTY_NOTICES.md that holds the license text, when there is one. */
  notice?: string
  /** Use the LICENSE file at the repo root instead. */
  ownLicense?: boolean
}

export const CREDITS: Credit[] = [
  {
    name: "Munsell Soil Reader",
    license: "MIT",
    by: "Jon Cackler",
    used: "This app: the page you are reading, the reading engine and the tests.",
    links: [{ label: "Source", href: "https://github.com/jonboy648/munsell-soil-reader" }],
    ownLicense: true,
  },
  {
    name: "munsell.js",
    license: "MPL-2.0",
    by: "Hugo Sansaqua",
    used: "Converts a color to Munsell hue, value and chroma. Used unmodified, bundled into the app so it works offline.",
    links: [{ label: "Source", href: "https://github.com/privet-kitty/munsell.js" }],
    notice: "munsell.js (MPL-2.0)",
  },
  {
    name: "Soil-book Chip list",
    license: "CC0 1.0",
    by: "Thomas Perrin (tomax31/Munsell-Soil-Color-Chart-palette)",
    used: "The Chips a Reading can land on, with their color names. The notations and names only; each Chip's color is computed from its notation. Additions and corrections were checked against a physical soil book.",
    links: [
      { label: "Source", href: "https://github.com/tomax31/Munsell-Soil-Color-Chart-palette" },
      { label: "CC0 1.0 legal code", href: "https://creativecommons.org/publicdomain/zero/1.0/legalcode" },
    ],
  },
  {
    name: "X-Rite ColorChecker Classic reference values",
    license: "X-Rite's published data, carried in a BSD-3-Clause dataset",
    by: "X-Rite; the colour-science project",
    used: "The true colors of the ColorChecker's 24 patches (the \"after November 2014\" values), taken from colour-science's dataset.",
    links: [{ label: "colour-science", href: "https://github.com/colour-science/colour" }],
    notice: "Root-polynomial correction (BSD-3-Clause)",
  },
  {
    name: "colour-science root-polynomial correction",
    license: "BSD-3-Clause",
    by: "Colour Developers",
    used: "A TypeScript port of the method of Finlayson, MacKiewicz and Hurlbert (2015), used only in the tests to compare corrections. It is not in the built app.",
    links: [{ label: "colour-science", href: "https://github.com/colour-science/colour" }],
    notice: "Root-polynomial correction (BSD-3-Clause)",
  },
  {
    name: "js-aruco2",
    license: "MIT",
    by: "Damiano Falcioni, from js-aruco by Juan Mellado",
    used: "Reads the markers of the printed frame. The frame finder is built and tested but not switched on, so js-aruco2 is not in the app you are using.",
    links: [{ label: "Source", href: "https://github.com/damianofalcioni/js-aruco2" }],
    notice: "js-aruco2 (MIT)",
  },
]

/** The sections of THIRD_PARTY_NOTICES.md, by heading. */
function sections(): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of noticesFile.split(/^## /m).slice(1)) {
    const newline = part.indexOf("\n")
    out.set(part.slice(0, newline).trim(), part.slice(newline + 1))
  }
  return out
}

/** The first fenced block of a section: the license text, as shipped. */
function fencedText(body: string): string | null {
  const match = /```text\n([\s\S]*?)\n```/.exec(body)
  return match ? match[1] : null
}

/** The full license text for a credit, or null when the license is a link. */
export function licenseTextOf(credit: Credit): string | null {
  if (credit.ownLicense) return licenseFile.trim()
  if (!credit.notice) return null
  const body = sections().get(credit.notice)
  return body ? fencedText(body) : null
}

/** Rows of the table of other dependencies in THIRD_PARTY_NOTICES.md: package, license. */
export function otherDependencies(): { name: string; license: string }[] {
  const body = sections().get("Other dependencies") ?? ""
  return body
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.startsWith("| Package") && !line.startsWith("| ---"))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .map((cells) => ({ name: cells[1].replaceAll("`", ""), license: cells[2] }))
}
