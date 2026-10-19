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

export interface Ask {
  /** For a test; the browser's own `fetch` otherwise. */
  fetch?: typeof fetch
  /** Aborting it cancels every request still under way. */
  signal?: AbortSignal
  /** Milliseconds a service gets. */
  wait?: number
}

/** One request that ends when the service answers, when `wait` runs out, or when `signal` aborts. */
async function json(url: string, ask: Ask, init?: RequestInit): Promise<unknown> {
  const { signal, wait = WAIT_MS, fetch: doFetch = (...args: Parameters<typeof fetch>) => fetch(...args) } = ask
  if (signal?.aborted) throw new Error("stopped")
  // One controller for both reasons to stop, so nothing newer than AbortController is needed.
  const request = new AbortController()
  const stop = () => request.abort()
  const timer = setTimeout(stop, wait)
  signal?.addEventListener("abort", stop, { once: true })
  try {
    const response = await doFetch(url, { ...init, signal: request.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    return text.trim() === "" ? null : JSON.parse(text)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener("abort", stop)
  }
}

const unavailable = (): Outcome => ({ state: "unavailable" })

async function soilMapUnit(where: Position, ask: Ask): Promise<Outcome> {
  try {
    const name = parseSda(await json(SDA_URL, ask, { method: "POST", headers: { "Content-Type": "application/json" }, body: sdaBody(where) }))
    return name ? { state: "found", value: name } : { state: "none" }
  } catch {
    return unavailable()
  }
}

async function nwi(where: Position, ask: Ask): Promise<Outcome> {
  try {
    const hit = parseNwi(await json(nwiUrl(where), ask))
    return hit ? { state: "found", value: hit.code, detail: hit.type } : { state: "none" }
  } catch {
    return unavailable()
  }
}

/** Asks both services about the position. Sends it nowhere else. */
export async function lookUp(where: Position, ask: Ask = {}): Promise<Lookups> {
  const [soil, wetland] = await Promise.all([soilMapUnit(where, ask), nwi(where, ask)])
  return { soilMapUnit: soil, nwi: wetland }
}

export type LookupKey = "soilMapUnit" | "nwi"
const KEYS: readonly LookupKey[] = ["soilMapUnit", "nwi"]
const WHAT: Record<LookupKey, string> = { soilMapUnit: "soil map unit", nwi: "NWI class" }

interface Notable {
  /** Found answers left out because the user's own value is there. */
  kept?: readonly LookupKey[]
  /** Values an earlier look-up wrote that were removed because the position changed. */
  cleared?: readonly LookupKey[]
}

/** What to tell the user about a look-up, in plain words. `null` is a look-up that was not tried because there is no signal. */
export function describeLookups(lookups: Lookups | null, { kept = [], cleared = [] }: Notable = {}): string[] {
  const notes: string[] = []
  if (lookups === null || (lookups.soilMapUnit.state === "unavailable" && lookups.nwi.state === "unavailable")) {
    notes.push("Lookup unavailable: the services could not be reached. Type the soil map unit and the NWI class yourself, or look them up when you have a signal.")
  } else {
    const filled: string[] = []
    for (const key of KEYS) {
      const outcome = lookups[key]
      if (outcome.state === "found") {
        if (kept.includes(key)) notes.push(`Kept what you typed for the ${WHAT[key]}.`)
        else filled.push(WHAT[key])
      }
      if (outcome.state === "none") notes.push(key === "nwi" ? "No NWI wetland is mapped at this position." : "No soil map unit is mapped at this position.")
      if (outcome.state === "unavailable") notes.push(`Lookup unavailable for the ${WHAT[key]}: type it, or try again.`)
    }
    if (filled.length > 0) {
      const one = filled.length === 1
      notes.unshift(`Filled in the ${filled.join(" and the ")} from this position. Edit ${one ? "it" : "them"} if ${one ? "it is" : "they are"} wrong.`)
    }
  }
  // A value an earlier look-up wrote belongs to the old position, so it goes unless this one wrote it again.
  for (const key of cleared) {
    if (lookups?.[key].state !== "found") notes.push(`Cleared the ${WHAT[key]} that came from the earlier position.`)
  }
  return notes
}

/** A point after something was written into it, and what was left alone or removed on the way. */
export interface Applied {
  point: SamplingPoint
  /** Found answers left out because the user's own value is there. */
  kept: LookupKey[]
  /** Values an earlier look-up wrote that were removed. */
  cleared: LookupKey[]
}

/** True while a line is still exactly what the last look-up wrote, so the user has not made it their own. */
const writtenByLookup = (point: SamplingPoint, key: LookupKey): boolean => {
  const current = (point[key] ?? "").trim()
  return current !== "" && current === point.lookedUp?.[key]
}

const without = (point: SamplingPoint, key: LookupKey): SamplingPoint => {
  const { [key]: _gone, ...rest } = point
  const { [key]: _mark, ...marks } = point.lookedUp ?? {}
  return { ...rest, lookedUp: marks }
}

/**
 * The point with a look-up's answers written in. What the user typed stays: a value is replaced only
 * while it is blank or is still exactly what the last look-up wrote. Where the position has no map
 * unit or no wetland, a value the last look-up wrote is removed, since it was for another place.
 */
export function withLookups(point: SamplingPoint, lookups: Lookups): Applied {
  let out = point
  const kept: LookupKey[] = []
  const cleared: LookupKey[] = []
  for (const key of KEYS) {
    const outcome = lookups[key]
    const current = (point[key] ?? "").trim()
    if (outcome.state === "found") {
      if (current !== "" && !writtenByLookup(point, key)) kept.push(key)
      else out = { ...out, [key]: outcome.value, lookedUp: { ...out.lookedUp, [key]: outcome.value } }
    } else if (outcome.state === "none" && writtenByLookup(point, key)) {
      out = without(out, key)
      cleared.push(key)
    }
  }
  return { point: out, kept, cleared }
}

/**
 * The point with the values an earlier look-up wrote removed, for the moment its position changes:
 * they describe the old place. What the user typed stays.
 */
export function withoutStaleLookups(point: SamplingPoint): Applied {
  const cleared = KEYS.filter((key) => writtenByLookup(point, key))
  return { point: cleared.reduce(without, point), kept: [], cleared }
}
