// Looking a position up in the two public services, one answer for each, none of which can stop the
// other: a service that is down or does not answer is "unavailable", and the user types that field.
import type { SamplingPoint } from "../model"
import { parseNwi, nwiUrl } from "./nwi"
import type { Position } from "./position"
import { parseSda, sdaBody, SDA_URL } from "./sda"

export type Outcome =
  | { state: "found"; value: string; /** The same answer in words, for the note beside the field. */ detail?: string }
  | { state: "none" }
  | { state: "unavailable" }

export interface Lookups {
  soilMapUnit: Outcome
  nwi: Outcome
}

/** How long a service gets to answer before the field is left for the user to type. */
const WAIT_MS = 10_000

async function json(doFetch: typeof fetch, url: string, init?: RequestInit): Promise<unknown> {
  const response = await doFetch(url, { ...init, signal: AbortSignal.timeout(WAIT_MS) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  return text.trim() === "" ? null : JSON.parse(text)
}

const unavailable = (): Outcome => ({ state: "unavailable" })

async function soilMapUnit(where: Position, doFetch: typeof fetch): Promise<Outcome> {
  try {
    const name = parseSda(await json(doFetch, SDA_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: sdaBody(where) }))
    return name ? { state: "found", value: name } : { state: "none" }
  } catch {
    return unavailable()
  }
}

async function nwi(where: Position, doFetch: typeof fetch): Promise<Outcome> {
  try {
    const hit = parseNwi(await json(doFetch, nwiUrl(where)))
    return hit ? { state: "found", value: hit.code, detail: hit.type } : { state: "none" }
  } catch {
    return unavailable()
  }
}

/** Asks both services about the position. Sends it nowhere else. */
export async function lookUp(where: Position, doFetch: typeof fetch = (...args) => fetch(...args)): Promise<Lookups> {
  const [soil, wetland] = await Promise.all([soilMapUnit(where, doFetch), nwi(where, doFetch)])
  return { soilMapUnit: soil, nwi: wetland }
}

/** What to tell the user about a look-up, in plain words. `null` is a look-up that was not tried because there is no signal. */
export function describeLookups(lookups: Lookups | null, kept: readonly LookupKey[] = []): string[] {
  if (lookups === null || (lookups.soilMapUnit.state === "unavailable" && lookups.nwi.state === "unavailable")) {
    return ["Lookup unavailable: the services could not be reached. Type the soil map unit and the NWI class yourself, or look them up when you have a signal."]
  }
  const notes: string[] = []
  const found: string[] = []
  const lines: [LookupKey, string, Outcome][] = [
    ["soilMapUnit", "soil map unit", lookups.soilMapUnit],
    ["nwi", "NWI class", lookups.nwi],
  ]
  for (const [key, what, outcome] of lines) {
    if (outcome.state === "found") (kept.includes(key) ? notes : found).push(kept.includes(key) ? `Kept what you typed for the ${what}.` : what)
    if (outcome.state === "none") notes.push(what === "NWI class" ? "No NWI wetland is mapped at this position." : "No soil map unit is mapped at this position.")
    if (outcome.state === "unavailable") notes.push(`Lookup unavailable for the ${what}: type it, or try again.`)
  }
  if (found.length > 0) notes.unshift(`Filled in the ${found.join(" and the ")} from this position. Edit ${found.length === 1 ? "it" : "them"} if ${found.length === 1 ? "it is" : "they are"} wrong.`)
  return notes
}

export type LookupKey = "soilMapUnit" | "nwi"

/**
 * The point with a look-up's answers written in, and which found answers were left out because the
 * user's own value is there. What the user typed stays: a value is replaced only while it is blank or
 * is still exactly what the last look-up wrote.
 */
export function withLookups(point: SamplingPoint, lookups: Lookups): { point: SamplingPoint; kept: LookupKey[] } {
  const out: SamplingPoint = { ...point }
  const lookedUp = { ...point.lookedUp }
  const kept: LookupKey[] = []
  for (const key of ["soilMapUnit", "nwi"] as const) {
    const outcome = lookups[key]
    if (outcome.state !== "found") continue
    const current = (point[key] ?? "").trim()
    if (current !== "" && current !== point.lookedUp?.[key]) kept.push(key)
    else out[key] = lookedUp[key] = outcome.value
  }
  return { point: { ...out, lookedUp }, kept }
}
