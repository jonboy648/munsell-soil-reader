// Text on the form: what the PDF's Helvetica can print, how wide it comes out, and how to make it
// fit a column. Pure. The widths are the PDF library's own, kept in a table (helveticaWidths.ts), so
// the form engine, the preview and the PDF all agree on what fits.
import { HELVETICA_WIDTHS } from "./helveticaWidths"

/** The width of the text in points at this text size. Characters Helvetica cannot print count as nothing. */
export function widthOf(text: string, size: number): number {
  let thousandths = 0
  for (const ch of text) thousandths += HELVETICA_WIDTHS[ch] ?? 0
  return (thousandths * size) / 1000
}

// Common symbols outside the PDF font's WinAnsi characters, and what to print in their place.
const SYMBOLS: Record<string, string> = {
  "\u2264": "<=",
  "\u2265": ">=",
  "\u2260": "!=",
  "\u2248": "~",
  "\u223c": "~",
  "\u2192": "->",
  "\u2190": "<-",
  "\u2212": "-",
  "\u2011": "-",
  "\u2032": "'",
  "\u2033": '"',
}

/**
 * The text as the form can print it: one line, using only characters Helvetica has. Symbols that
 * are not there are spelled out (`<=`), letters with marks lose them, and anything else becomes `?`.
 * `replaced` says whether any character had to change.
 */
export function printable(text: string): { text: string; replaced: boolean } {
  let out = ""
  let replaced = false
  for (const ch of text.replace(/\s+/g, " ").trim()) {
    if (HELVETICA_WIDTHS[ch] !== undefined) {
      out += ch
      continue
    }
    replaced = true
    const base = ch.normalize("NFD").replace(/\p{M}/gu, "")
    out += SYMBOLS[ch] ?? ([...base].length > 0 && [...base].every((c) => HELVETICA_WIDTHS[c] !== undefined) ? base : "?")
  }
  return { text: out, replaced }
}

/** The text cut to fit, ending in "..." when something was cut. */
export function truncate(text: string, maxWidth: number, size: number): string {
  if (widthOf(text, size) <= maxWidth) return text
  const chars = [...text]
  while (chars.length > 0 && widthOf(`${chars.join("")}...`, size) > maxWidth) chars.pop()
  return `${chars.join("").trimEnd()}...`
}

/** The text in lines no wider than `maxWidth`, broken at spaces, or inside a word too long for a line. */
export function wrap(text: string, maxWidth: number, size: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(" ").filter(Boolean)) {
    const tried = line ? `${line} ${word}` : word
    if (widthOf(tried, size) <= maxWidth) {
      line = tried
      continue
    }
    if (line) lines.push(line)
    line = ""
    // A word wider than a line is broken where it runs out of room.
    let rest = word
    while (widthOf(rest, size) > maxWidth) {
      const chars = [...rest]
      let n = chars.length
      while (n > 1 && widthOf(chars.slice(0, n).join(""), size) > maxWidth) n--
      lines.push(chars.slice(0, n).join(""))
      rest = chars.slice(n).join("")
    }
    line = rest
  }
  if (line) lines.push(line)
  return lines
}

/** The text at the largest size, down to `min`, that fits; cut with "..." when even `min` does not. */
export function fit(text: string, maxWidth: number, size: number, min = 5): { text: string; size: number } {
  for (let s = size; s >= min; s -= 0.5) if (widthOf(text, s) <= maxWidth) return { text, size: s }
  return { text: truncate(text, maxWidth, min), size: min }
}
