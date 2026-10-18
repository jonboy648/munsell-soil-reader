// One sampling point: its Layers from the surface down, the form's warnings, and the Soil page.
import * as React from "react"
import { ChevronLeft } from "lucide-react"
import { Confirm } from "@/components/Confirm"
import { HydrologyForm } from "@/components/HydrologyForm"
import { LayerForm } from "@/components/LayerForm"
import { PagePreview } from "@/components/PagePreview"
import { RestrictiveForm } from "@/components/RestrictiveForm"
import { Button } from "@/components/ui/button"
import { formFor } from "@/delineation/formFor"
import { topToBottom, withPoint, type Layer, type Project, type SamplingPoint } from "@/delineation/model"

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

export function PointView({ project, point, change, onBack }: Props) {
  // "new" while adding a Layer, a Layer's id while editing it.
  const [editing, setEditing] = React.useState<string | null>(null)
  const form = React.useMemo(() => formFor(project, point), [project, point])
  const layers = topToBottom(point.layers)

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

      <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Soil page, ENG Form 6116-8</h4>
      <PagePreview page="soil" project={project} point={point} form={form} />

      <HydrologyForm key={`hydrology-${point.id}`} project={project} point={point} change={change} />
      <PagePreview page="page1" project={project} point={point} form={form} />
    </div>
  )
}
