// Assign a Spot's Reading to a layer of a sampling point, as its matrix color or as a redox color.
// The layer then holds the Chip's notation and the Reading it came from; the form prints the notation.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Card, ReadPhotoResult } from "@/engine"
import { percentProblem, topToBottom, withPoint, type LayerColor } from "@/delineation/model"
import type { SavedReading } from "@/lib/log"
import { useBackClosesSheet } from "@/lib/sheetHistory"
import { useProjects } from "@/lib/useProjects"
import { shownReading } from "@/lib/verdict"

interface Props {
  /** The Spot whose Reading is assigned. Null when the sheet is closed. */
  index: number | null
  result: ReadPhotoResult | null
  card: Card | null
  readings: SavedReading[]
  onClose: () => void
}

const SELECT =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

function AssignForm({ index, result, saved, onClose }: { index: number; result: ReadPhotoResult; saved: SavedReading; onClose: () => void }) {
  const { projects, change } = useProjects()
  const [projectId, setProjectId] = React.useState("")
  const [pointId, setPointId] = React.useState("")
  const [layerId, setLayerId] = React.useState("")
  const [role, setRole] = React.useState<"matrix" | "redox">("matrix")
  const [percent, setPercent] = React.useState("100")
  const [problem, setProblem] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)

  const project = projects.find((p) => p.id === projectId) ?? projects[0]
  const point = project?.points.find((p) => p.id === pointId) ?? project?.points[0]
  const layers = point ? topToBottom(point.layers) : []
  const layer = layers.find((l) => l.id === layerId) ?? layers[0]
  const { verdict, main } = shownReading(result.readings[index], result.cardCheck)

  const assign = async () => {
    if (!project || !point || !layer) return
    const value = Number(percent)
    const bad = percentProblem(value)
    if (bad) return setProblem(bad)
    setProblem(null)
    const color: LayerColor = { notation: main.chip.notation, percent: value, reading: { ...saved, savedAt: Date.now() } }
    try {
      await change(project.id, (p) =>
        withPoint(p, point.id, (pt) => ({
          ...pt,
          layers: pt.layers.map((l) => (l.id !== layer.id ? l : role === "matrix" ? { ...l, matrix: color } : { ...l, redox: [...l.redox, color] })),
        })),
      )
      setDone(`${main.chip.notation} is now the ${role} color of ${point.name}, ${layer.top}-${layer.bottom} in, at ${value}%.`)
    } catch {
      setProblem("The Log could not be written on this device. Try again.")
    }
  }

  if (done) {
    return (
      <div className="grid gap-4 px-4 pb-6">
        <p role="status" className="text-base font-medium">{done}</p>
        <Button size="lg" className="h-12 text-base" onClick={onClose}>
          Done
        </Button>
      </div>
    )
  }
  if (!layer) {
    return (
      <div className="grid gap-4 px-4 pb-6">
        <p className="text-base">There is no layer to assign it to yet. In Projects, create a project, add a sampling point and add a layer.</p>
        <Button variant="outline" size="lg" className="h-12 text-base" onClick={onClose}>
          Close
        </Button>
      </div>
    )
  }
  return (
    <div className="grid gap-4 overflow-y-auto px-4 pb-6">
      <p className="font-mono text-3xl font-semibold tracking-tight" data-testid="assign-notation">
        {main.chip.notation}
      </p>
      {verdict !== "good" && (
        <p className="text-sm font-medium">This is not a corrected color: the Card check was not good, or there was no Card.</p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="assign-project">Project</Label>
        <select id="assign-project" className={SELECT} value={project.id} onChange={(e) => { setProjectId(e.target.value); setPointId(""); setLayerId("") }}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="assign-point">Sampling point</Label>
        <select id="assign-point" className={SELECT} value={point?.id ?? ""} onChange={(e) => { setPointId(e.target.value); setLayerId("") }}>
          {project.points.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="assign-layer">Layer</Label>
        <select id="assign-layer" className={SELECT} value={layer.id} onChange={(e) => setLayerId(e.target.value)}>
          {layers.map((l) => (
            <option key={l.id} value={l.id}>{l.top}-{l.bottom} in</option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <span id="assign-role" className="text-sm leading-none font-medium">As</span>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={2}
          className="w-full"
          aria-labelledby="assign-role"
          value={role}
          onValueChange={(value) => value && setRole(value as "matrix" | "redox")}
        >
          {(["matrix", "redox"] as const).map((r) => (
            <ToggleGroupItem key={r} value={r} className="h-11 flex-1 text-base capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              {r}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="assign-percent">Percent of the layer</Label>
        <Input id="assign-percent" className="h-11 text-base" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} />
      </div>
      {problem && <p role="alert" className="rounded-md border-2 border-foreground p-3 text-sm font-medium">{problem}</p>}
      <Button size="lg" className="h-12 text-base" onClick={() => void assign()}>
        Assign to layer
      </Button>
      <Button variant="outline" size="lg" className="h-12 text-base" onClick={onClose}>
        Cancel
      </Button>
    </div>
  )
}

export function AssignSheet({ index, result, card, readings, onClose }: Props) {
  const open = index !== null && !!result && !!card
  const setOpen = React.useCallback((next: boolean) => { if (!next) onClose() }, [onClose])
  useBackClosesSheet(open, setOpen)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="max-h-[92svh] rounded-t-xl pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>Assign to a layer</SheetTitle>
          <SheetDescription>Spot {index === null ? "" : index + 1}: use this Reading as a color of a layer in a sampling point.</SheetDescription>
        </SheetHeader>
        {index !== null && result && card && readings[index] && <AssignForm index={index} result={result} saved={readings[index]} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  )
}
