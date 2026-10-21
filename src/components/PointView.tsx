// One sampling point: its own header lines and pair, its Layers from the surface down, the form's
// warnings, the Soil page and page 1, and the PDF of its whole form.
import * as React from "react"
import { ChevronLeft } from "lucide-react"
import { Confirm } from "@/components/Confirm"
import { DeterminationPanel } from "@/components/DeterminationPanel"
import { FormExport, slug } from "@/components/FormExport"
import { HydrologyForm } from "@/components/HydrologyForm"
import { IndicatorsPanel } from "@/components/IndicatorsPanel"
import { LayerForm } from "@/components/LayerForm"
import { PagePreview } from "@/components/PagePreview"
import { PointDetails, type PointDetailsChange } from "@/components/PointDetails"
import { RestrictiveForm } from "@/components/RestrictiveForm"
import { VegetationEntry } from "@/components/VegetationEntry"
import { VegetationIndicators } from "@/components/VegetationIndicators"
import { VegetationPreview } from "@/components/VegetationPreview"
import { Button } from "@/components/ui/button"
import { formFor } from "@/delineation/formFor"
import { confirmConclusion, type Answer, type ConclusionId } from "@/delineation/determination"
import { pairOf, topToBottom, withPoint, withVegetation, type IndicatorChoice, type Layer, type Project, type SamplingPoint } from "@/delineation/model"
import type { Vegetation } from "@/delineation/vegetation/entry"

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
        Matrix {layer.matrix ? `${layer.matrix.notation}, ${layer.matrix.percent}%${layer.matrix.exact ? " (not a book Chip)" : ""}` : "not set"}
        {layer.texture && (
          <>
            <br />
            Texture {layer.texture}
          </>
        )}
        {layer.redox.map((c, i) => (
          <span key={i}>
            <br />
            Redox {c.notation}, {c.percent}%{[c.type, c.location].filter(Boolean).map((code) => `, ${code}`).join("")}
            {c.exact ? " (not a book Chip)" : ""}
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
  const changeVegetation = (fn: (vegetation: Vegetation) => Vegetation) =>
    change(project.id, (p) => withPoint(p, point.id, (pt) => withVegetation(pt, fn)))

  const onChoose = (id: string, choice: IndicatorChoice | null) =>
    change(project.id, (p) =>
      withPoint(p, point.id, (pt) => {
        const { [id]: _gone, ...rest } = pt.indicators ?? {}
        return { ...pt, indicators: choice ? { ...rest, [id]: choice } : rest }
      }),
    )
  const onAnswer = async (id: ConclusionId, answer: Answer | null, remark = "") => {
    // Explain invalid decisions before opening an IndexedDB transaction, whose abort would mask
    // the validation error. Recheck against the latest point inside the atomic write as well.
    confirmConclusion(point, form.determination, id, answer, remark)
    return change(project.id, (p) =>
      withPoint(p, point.id, (pt) => confirmConclusion(pt, formFor(p, pt).determination, id, answer, remark)),
    )
  }

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

      <RestrictiveForm key={`restrictive-${point.id}`} project={project} point={point} change={change} />

      <IndicatorsPanel project={project} point={point} form={form} onChoose={onChoose} onHydric={(answer) => onAnswer("soil", answer)} />

      <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Soil page, ENG Form 6116-8</h4>
      <PagePreview page="soil" project={project} point={point} form={form} />

      <HydrologyForm key={`hydrology-${point.id}`} project={project} point={point} change={change} onAnswer={(answer) => onAnswer("hydrology", answer)} />
      <PagePreview page="page1" project={project} point={point} form={form} />

      <VegetationEntry key={`vegetation-${point.id}`} project={project} point={point} onChange={changeVegetation} />
      <VegetationIndicators key={`vegetation-indicators-${point.id}`} point={point} form={form} onChange={changeVegetation} onAnswer={(answer) => onAnswer("vegetation", answer)} />
      <VegetationPreview project={project} point={point} form={form} />

      <DeterminationPanel key={`determination-${point.id}`} determination={form.determination} onAnswer={onAnswer} />

      <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">This sampling point's form</h4>
      <p className="text-sm text-muted-foreground">Page 1, the Vegetation page, the Soil page and the Privacy Act page in one file.</p>
      <FormExport
        project={project}
        points={[point]}
        label="Download form PDF"
        filename={`wetland-form-${slug(project.name)}-${slug(point.name)}`}
        title={`${project.name}, ${point.name}`}
      />
    </div>
  )
}
