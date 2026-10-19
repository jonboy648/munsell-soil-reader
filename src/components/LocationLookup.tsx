// On a Sampling point: take its latitude and longitude from the phone, and look the position up in
// the NRCS soil survey and the NWI map. Everything here waits for a tap, nothing at all happens
// (no position read, no request) while the project's location setting is off, and turning the
// setting off, or leaving the point, stops a look-up that is under way.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { describeLookups, lookUp, withLookups, withoutStaleLookups, type LookupKey, type Lookups } from "@/delineation/lookup"
import { LookupError, typedPosition, written, type Position } from "@/delineation/lookup/position"
import { withPoint, type Project, type SamplingPoint } from "@/delineation/model"
import { devicePosition } from "@/lib/devicePosition"

type Change = (id: string, change: (project: Project) => Project) => Promise<unknown>

interface Props {
  project: Project
  point: SamplingPoint
  change: Change
  /** Told when a look-up starts and when it ends, so the screen can hold still meanwhile. */
  onBusy?: (busy: boolean) => void
}

export function LocationLookup({ project, point, change, onBusy }: Props) {
  const [busy, setBusy] = React.useState(false)
  const [notes, setNotes] = React.useState<string[]>([])
  const running = React.useRef<AbortController | null>(null)
  // Switching location off, or leaving the point, ends the look-up: no request goes out after it, and nothing is written.
  React.useEffect(() => {
    if (!project.location) running.current?.abort()
  }, [project.location])
  React.useEffect(() => () => running.current?.abort(), [])

  if (!project.location) {
    return (
      <p data-testid="location-off" className="text-sm text-muted-foreground">
        Location is off for this project. Turn it on in the project to fill the position and look up the soil map unit and the NWI class.
      </p>
    )
  }

  const typed = typedPosition(point.lat, point.long)

  /** Writes into the point, but only while the project still has location on. False when it no longer does. */
  const write = async (work: (pt: SamplingPoint) => SamplingPoint): Promise<boolean> => {
    let wrote = false
    await change(project.id, (p) => {
      if (!p.location) return p
      wrote = true
      return withPoint(p, point.id, work)
    })
    return wrote
  }

  /** `fromDevice` reads the phone's position first; otherwise the position already on the point is looked up. */
  const run = async (fromDevice: boolean) => {
    const stop = new AbortController()
    running.current = stop
    setBusy(true)
    onBusy?.(true)
    setNotes([])
    try {
      let where: Position | null = typed && "position" in typed ? typed.position : null
      let cleared: LookupKey[] = []
      if (fromDevice) {
        const here = await devicePosition()
        if (stop.signal.aborted) return
        where = here
        // The position is kept at once, so a slow signal does not lose it. Values an earlier look-up wrote belong to the old place.
        const wrote = await write((pt) => {
          const stale = withoutStaleLookups({ ...pt, lat: written(here.lat), long: written(here.long), datum: "WGS84" })
          cleared = stale.cleared
          return stale.point
        })
        if (!wrote) return
      }
      if (!where || stop.signal.aborted) return
      // Without a signal the services cannot be asked; the fields stay as they are, to type.
      let lookups: Lookups | null = null
      if (navigator.onLine !== false) lookups = await lookUp(where, { signal: stop.signal })
      if (stop.signal.aborted) return
      let kept: LookupKey[] = []
      const answers = lookups
      if (answers) {
        const wrote = await write((pt) => {
          const applied = withLookups(pt, answers)
          kept = applied.kept
          cleared = [...new Set([...cleared, ...applied.cleared])]
          return applied.point
        })
        if (!wrote) return
      }
      setNotes(describeLookups(lookups, { kept, cleared }))
    } catch (error) {
      setNotes([error instanceof LookupError ? error.message : "The Log could not be written on this device. Try again."])
    } finally {
      if (running.current === stop) running.current = null
      setBusy(false)
      onBusy?.(false)
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Button className="h-11 flex-1 text-base" disabled={busy} onClick={() => void run(true)}>
          {busy ? "Looking up..." : "Use my location"}
        </Button>
        {typed && "position" in typed && (
          <Button variant="outline" className="h-11 flex-1 text-base" disabled={busy} onClick={() => void run(false)}>
            Look up this position
          </Button>
        )}
      </div>
      {typed && "problem" in typed && (
        <p data-testid="position-problem" className="text-sm font-medium">
          {typed.problem}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        With a signal, sends this position to NRCS Soil Data Access and the US Fish and Wildlife Service wetlands map. Nothing else leaves the phone.
      </p>
      {notes.length > 0 && (
        <ul data-testid="location-note" role="status" className="grid gap-1 text-sm">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
