// One sampling point: its own header lines and pair, its Layers from the surface down, the form's
// warnings, page 1 and the Soil page, and the PDF of its form.
import * as React from "react"
import { ChevronLeft } from "lucide-react"
import { Confirm } from "@/components/Confirm"
import { FormExport, slug } from "@/components/FormExport"
import { LayerForm } from "@/components/LayerForm"
import { PagePreview } from "@/components/PagePreview"
import { PointDetails, type PointDetailsChange } from "@/components/PointDetails"
import { Button } from "@/components/ui/button"
import { formFor } from "@/delineation/formFor"
import { pairOf, topToBottom, withPoint, type Layer, type Project, type SamplingPoint } from "@/delineation/model"
import { page1Placements } from "@/delineation/page1"
import { regionOf } from "@/delineation/regions"
import { pageAssets } from "@/delineation/regions/assets"
import { soilPlacements } from "@/delineation/soilPage"

interface Props {
  project: Project
  point: SamplingPoint
  /** Each rejects when the Log could not be written. */
  change: (projectId: string, change: (project: Project) => Project) => Promise<unknown>
  onBack: () => void
}

function LayerCard({ layer, onEdit, onDelete }: { layer: Layer; onEdit: () => void; onDelete: () => Promise<unknown> }) {
  const [confirming, setConfirming] = React.useState(false)
  return (
    <li data-testid="layer" className="grid min-w-0 gap-2 rounded-lg border border-border bg-card p-3">
      <p className="font-heading text-lg font-bold">
        {layer.top}-{layer.bottom} in
      </p>
      <p className="min-w-0 text-sm [overflow-wrap:anywhere]">
        Matrix {layer.matrix ? `${layer.matrix.notation}, ${layer.matrix.percent}%` : "not set"}
        {layer.redox.map((c, i) => (
          <span key={i}>
            <br />
            Redox {c.notation}, {c.percent}%
          </span>
        ))}
        {layer.remarks && (
          <>
            <br />
            {layer.remarks}
          </>
        )}
      </p>
      {confirming ? (
        <Confirm verb="Delete" what={`the ${layer.top}-${layer.bottom} in layer`} onYes={() => void onDelete()} onNo={() => setConfirming(false)} />
      ) : (
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1 text-base" onClick={onEdit}>
            Edit layer
          </Button>
          <Button variant="outline" className="h-11 flex-1 text-base" onClick={() => setConfirming(true)}>
            Delete layer
          </Button>
        </div>
      )}
    </li>
  )
}

/** The point's own header lines in a sentence or two, so they can be seen without opening the form. */
function DetailsSummary({ project, point }: { project: Project; point: SamplingPoint }) {
  const pair = pairOf(project, point)
  const location = [point.lat && `Lat ${point.lat}`, point.long && `Long ${point.long}`, point.datum && point.datum].filter(Boolean)
  return (
    <div data-testid="point-details" className="grid gap-1 text-sm">
      <p>{location.length > 0 ? location.join(", ") : "No latitude or longitude yet."}</p>
      <p>
        {pair
          ? `${pair.role === "wetland" ? "Wetland" : "Upland"} point, paired with the ${pair.role === "wetland" ? "upland" : "wetland"} point ${pair.other.name}.`
          : "Not paired with another sampling point."}
      </p>
    </div>
  )
}

export function PointView({ project, point, change, onBack }: Props) {
  // "new" while adding a Layer, a Layer's id while editing it.
  const [editing, setEditing] = React.useState<string | null>(null)
  const [editingDetails, setEditingDetails] = React.useState(false)
  const form = React.useMemo(() => formFor(project, point), [project, point])
  const layers = topToBottom(point.layers)
  const { page1, soil } = regionOf(project.region)
  const assets = pageAssets[project.region]
  const page1Drawn = React.useMemo(() => page1Placements(project, form), [project, form])
  const soilDrawn = React.useMemo(() => soilPlacements(project, form), [project, form])

  // The pair is kept on this point; a pair another point recorded with this one is replaced by it.
  const saveDetails = async ({ lat, long, datum, pair }: PointDetailsChange) => {
    await change(project.id, (p) => ({
      ...p,
      points: p.points.map((pt) =>
        pt.id === point.id ? { ...pt, lat, long, datum, pair: pair ?? undefined } : pt.pair?.with === point.id ? { ...pt, pair: undefined } : pt,
      ),
    }))
    setEditingDetails(false)
  }

  const inPoint = (fn: (layers: Layer[]) => Layer[]) => (p: Project) => withPoint(p, point.id, (pt) => ({ ...pt, layers: fn(pt.layers) }))
  const saveLayer = async (layer: Layer) => {
    await change(project.id, inPoint((all) => (all.some((l) => l.id === layer.id) ? all.map((l) => (l.id === layer.id ? layer : l)) : [...all, layer])))
    setEditing(null)
  }
  const editedLayer = layers.find((l) => l.id === editing)

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <Button variant="ghost" className="h-11 justify-start px-1 text-base" onClick={onBack}>
        <ChevronLeft /> {project.name}
      </Button>
      <h3 className="min-w-0 font-heading text-xl font-bold [overflow-wrap:anywhere]">Sampling point {point.name}</h3>

      {editingDetails ? (
        <PointDetails project={project} point={point} onSave={saveDetails} onCancel={() => setEditingDetails(false)} />
      ) : (
        <div className="grid gap-2 rounded-lg border border-border bg-card p-3">
          <DetailsSummary project={project} point={point} />
          <Button variant="outline" className="h-11 text-base" onClick={() => setEditingDetails(true)}>
            Edit location and pair
          </Button>
        </div>
      )}

      {form.warnings.length > 0 && (
        <ul data-testid="form-warnings" className="grid gap-1 rounded-md border-2 border-foreground p-3 text-sm">
          {form.warnings.map((w, i) => (
            <li key={i}>{w.text}</li>
          ))}
        </ul>
      )}

      {layers.length === 0 && editing === null && <p className="text-base">No layers yet. Add the top layer of the profile.</p>}
      <ul className="grid gap-3">
        {layers.map((layer) =>
          editing === layer.id ? (
            <li key={layer.id}>
              <LayerForm layer={layer} onSave={saveLayer} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <LayerCard
              key={layer.id}
              layer={layer}
              onEdit={() => setEditing(layer.id)}
              onDelete={() => change(project.id, inPoint((all) => all.filter((l) => l.id !== layer.id)))}
            />
          ),
        )}
      </ul>
      {editing === "new" ? (
        <LayerForm onSave={saveLayer} onCancel={() => setEditing(null)} />
      ) : (
        !editedLayer && (
          <Button size="lg" className="h-12 text-base" onClick={() => setEditing("new")}>
            Add layer
          </Button>
        )
      )}

      <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Page 1, ENG Form 6116-8</h4>
      <PagePreview size={page1.size} image={assets.page1.image} placements={page1Drawn} label={`Page 1 for ${point.name}`} testId="page1-preview" />
      <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Soil page, ENG Form 6116-8</h4>
      <PagePreview size={soil.size} image={assets.soil.image} placements={soilDrawn} label={`Soil page for ${point.name}`} testId="soil-preview" />
      <FormExport
        project={project}
        points={[point]}
        label="Download PDF"
        filename={`wetland-form-${slug(project.name)}-${slug(point.name)}`}
        title={`${project.name}, ${point.name}`}
      />
    </div>
  )
}
