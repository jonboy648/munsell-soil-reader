// On a Sampling point: take its latitude and longitude from the phone, and look the position up in
// the NRCS soil survey and the NWI map. Everything here waits for a tap, and nothing at all happens
// (no position read, no request) while the project's location setting is off.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { describeLookups, lookUp, withLookups, type LookupKey, type Lookups } from "@/delineation/lookup"
import { LookupError, typedPosition, written, type Position } from "@/delineation/lookup/position"
import { withPoint, type Project, type SamplingPoint } from "@/delineation/model"
import { devicePosition } from "@/lib/devicePosition"

type Change = (id: string, change: (project: Project) => Project) => Promise<unknown>

export function LocationLookup({ project, point, change }: { project: Project; point: SamplingPoint; change: Change }) {
  const [busy, setBusy] = React.useState(false)
  const [notes, setNotes] = React.useState<string[]>([])
  if (!project.location) {
    return (
      <p data-testid="location-off" className="text-sm text-muted-foreground">
        Location is off for this project. Turn it on in the project to fill the position and look up the soil map unit and the NWI class.
      </p>
    )
  }

  const typed = typedPosition(point.lat, point.long)
  const write = (changeToPoint: (pt: SamplingPoint) => SamplingPoint) => change(project.id, (p) => withPoint(p, point.id, changeToPoint))

  /** `fromDevice` reads the phone's position first; otherwise the position already on the point is looked up. */
  const run = async (fromDevice: boolean) => {
    setBusy(true)
    setNotes([])
    try {
      let where: Position | null = typed
      if (fromDevice) {
        where = await devicePosition()
        // The position is kept at once, so a slow or missing signal does not lose it.
        await write((pt) => ({ ...pt, lat: written(where!.lat), long: written(where!.long), datum: "WGS84" }))
      }
      if (!where) return
      // Without a signal the services cannot be asked; the fields stay as they are, to type.
      let lookups: Lookups | null = null
      if (navigator.onLine !== false) lookups = await lookUp(where)
      const answers = lookups
      let kept: LookupKey[] = []
      if (answers) {
        await write((pt) => {
          const result = withLookups(pt, answers)
          kept = result.kept
          return result.point
        })
      }
      setNotes(describeLookups(lookups, kept))
    } catch (error) {
      setNotes([error instanceof LookupError ? error.message : "The Log could not be written on this device. Try again."])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <Button className="h-11 flex-1 text-base" disabled={busy} onClick={() => void run(true)}>
          {busy ? "Looking up..." : "Use my location"}
        </Button>
        {typed && (
          <Button variant="outline" className="h-11 flex-1 text-base" disabled={busy} onClick={() => void run(false)}>
            Look up this position
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Sends this position to NRCS Soil Data Access and the US Fish and Wildlife Service wetlands map. Nothing else leaves the phone.
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
