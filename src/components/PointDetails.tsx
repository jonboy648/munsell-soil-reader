// A Sampling point's own header lines: its latitude, longitude and datum, its Soil Map Unit Name and
// NWI classification (which a look-up by location can fill), and whether it is the wetland or upland
// half of a pair with another point of the Project.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group-1"
import { pairOf, type Pair, type PairRole, type Project, type SamplingPoint } from "@/delineation/model"

/** What the form saves: the point's lines, and its pair as this point records it (null for none). */
export interface PointDetailsChange {
  lat: string
  long: string
  datum: string
  /** Blank means the project's header line is used. */
  soilMapUnit: string
  nwi: string
  pair: Pair | null
}

interface Props {
  project: Project
  point: SamplingPoint
  /** Rejects when the Log could not be written. */
  onSave: (change: PointDetailsChange) => Promise<unknown>
  onCancel: () => void
}

const INPUT = "h-11 text-base"
const SELECT =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

export function PointDetails({ project, point, onSave, onCancel }: Props) {
  const current = pairOf(project, point)
  const [lat, setLat] = React.useState(point.lat)
  const [long, setLong] = React.useState(point.long)
  const [datum, setDatum] = React.useState(point.datum)
  const [soilMapUnit, setSoilMapUnit] = React.useState(point.soilMapUnit ?? "")
  const [nwi, setNwi] = React.useState(point.nwi ?? "")
  const [partner, setPartner] = React.useState(current?.other.id ?? "")
  const [role, setRole] = React.useState<PairRole>(current?.role ?? "wetland")
  const [problem, setProblem] = React.useState<string | null>(null)
  const others = project.points.filter((p) => p.id !== point.id)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProblem(null)
    try {
      await onSave({ lat, long, datum, soilMapUnit, nwi, pair: partner ? { with: partner, role } : null })
    } catch {
      setProblem("The Log could not be written on this device. Try again.")
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="point-lat">Lat</Label>
          <Input id="point-lat" className={INPUT} inputMode="decimal" autoComplete="off" value={lat} onChange={(e) => setLat(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="point-long">Long</Label>
          {/* Text, not decimal: the iPhone's decimal keypad has no minus key, and a west longitude is negative. */}
          <Input id="point-long" className={INPUT} inputMode="text" autoComplete="off" autoCapitalize="off" value={long} onChange={(e) => setLong(e.target.value)} />
        </div>
        <p className="col-span-2 text-xs text-muted-foreground">West longitudes are negative, like -93.6.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="point-datum">Datum</Label>
        <Input id="point-datum" className={INPUT} placeholder="WGS84" autoComplete="off" value={datum} onChange={(e) => setDatum(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="point-soilmapunit">Soil Map Unit Name</Label>
        <Input
          id="point-soilmapunit"
          className={INPUT}
          placeholder={project.header.soilMapUnit}
          autoComplete="off"
          value={soilMapUnit}
          onChange={(e) => setSoilMapUnit(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="point-nwi">NWI classification</Label>
        <Input id="point-nwi" className={INPUT} placeholder={project.header.nwi} autoComplete="off" value={nwi} onChange={(e) => setNwi(e.target.value)} />
        <p className="text-xs text-muted-foreground">Left blank, these two print the project header's lines. A look-up by location fills them; what you type stays.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="point-pair">Paired with</Label>
        <select id="point-pair" value={partner} onChange={(e) => setPartner(e.target.value)} className={SELECT} disabled={others.length === 0}>
          <option value="">{others.length === 0 ? "No other sampling point yet" : "No pair"}</option>
          {others.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {partner && (
        <div className="grid gap-1.5">
          <span className="text-sm leading-none font-medium">{point.name} is the</span>
          <ToggleGroup type="single" variant="outline" size="lg" aria-label="This point is the" value={role} onValueChange={(v) => v && setRole(v as PairRole)} className="w-fit">
            <ToggleGroupItem value="wetland" className="text-base">Wetland point</ToggleGroupItem>
            <ToggleGroupItem value="upland" className="text-base">Upland point</ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}
      {problem && (
        <p role="alert" className="min-w-0 rounded-md border-2 border-foreground p-3 text-sm font-medium [overflow-wrap:anywhere]">
          {problem}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-12 flex-1 text-base" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="h-12 flex-1 text-base">
          Save details
        </Button>
      </div>
    </form>
  )
}
