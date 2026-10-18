// Projects: one wetland delineation each, with its sampling points, and each point's layers and
// Soil page. Kept in the Log on the device. The flat Sample list is a separate screen.
import * as React from "react"
import { ChevronLeft } from "lucide-react"
import { Confirm } from "@/components/Confirm"
import { PointView } from "@/components/PointView"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { newPoint, newProject, withPoint, type Project, type SamplingPoint } from "@/delineation/model"
import { REGIONS, regionOf, type RegionId } from "@/delineation/regions"
import { useProjects } from "@/lib/useProjects"

type Change = (id: string, change: (project: Project) => Project) => Promise<unknown>

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const WRITE_PROBLEM = "The Log could not be written on this device. Try again."

/** A name with a Rename button that turns it into a field. `onSave` rejects when the write fails. */
function NameRow({ label, name, onSave }: { label: string; name: string; onSave: (name: string) => Promise<unknown> }) {
  const [draft, setDraft] = React.useState<string | null>(null)
  const [problem, setProblem] = React.useState<string | null>(null)
  if (draft === null) {
    return (
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h3 className="min-w-0 font-heading text-lg font-bold [overflow-wrap:anywhere]">{name}</h3>
        <Button variant="outline" className="h-11 shrink-0 text-base" onClick={() => setDraft(name)}>
          Rename
        </Button>
      </div>
    )
  }
  const save = async () => {
    if (draft.trim() === "") return setProblem(`Give the ${label.toLowerCase()} a name.`)
    try {
      await onSave(draft.trim())
      setDraft(null)
    } catch {
      setProblem(WRITE_PROBLEM)
    }
  }
  return (
    <div className="grid gap-2">
      <Label htmlFor="rename">Rename {label.toLowerCase()}</Label>
      <Input id="rename" className="h-11 text-base" value={draft} onChange={(e) => setDraft(e.target.value)} />
      {problem && <p role="alert" className="text-sm font-medium">{problem}</p>}
      <div className="flex gap-2">
        <Button variant="outline" className="h-11 flex-1 text-base" onClick={() => { setDraft(null); setProblem(null) }}>
          Cancel
        </Button>
        <Button className="h-11 flex-1 text-base" onClick={() => void save()}>
          Save name
        </Button>
      </div>
    </div>
  )
}

/** A name field and a button that adds what it names. */
function AddRow({ label, button, children, onAdd }: { label: string; button: string; children?: React.ReactNode; onAdd: (name: string) => Promise<unknown> }) {
  const [name, setName] = React.useState("")
  const [problem, setProblem] = React.useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() === "") return setProblem(`Give the ${label.toLowerCase()} a name.`)
    try {
      await onAdd(name)
      setName("")
      setProblem(null)
    } catch {
      setProblem(WRITE_PROBLEM)
    }
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`new-${label.replace(" ", "-")}`}>{label} name</Label>
        <Input id={`new-${label.replace(" ", "-")}`} className="h-11 text-base" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {children}
      {problem && <p role="alert" className="text-sm font-medium">{problem}</p>}
      <Button type="submit" className="h-12 text-base">{button}</Button>
    </form>
  )
}

function PointRow({ project, point, change, onOpen }: { project: Project; point: SamplingPoint; change: Change; onOpen: () => void }) {
  const [confirming, setConfirming] = React.useState(false)
  return (
    <li data-testid="point" className="grid min-w-0 gap-2 rounded-lg border border-border bg-card p-3">
      <NameRow label="Sampling point" name={point.name} onSave={(name) => change(project.id, (p) => withPoint(p, point.id, (pt) => ({ ...pt, name })))} />
      <p className="text-sm text-muted-foreground">{plural(point.layers.length, "layer")}</p>
      {confirming ? (
        <Confirm
          verb="Delete"
          what={`sampling point ${point.name} and its ${plural(point.layers.length, "layer")}`}
          onYes={() => void change(project.id, (p) => ({ ...p, points: p.points.filter((pt) => pt.id !== point.id) }))}
          onNo={() => setConfirming(false)}
        />
      ) : (
        <div className="flex gap-2">
          <Button className="h-11 flex-1 text-base" onClick={onOpen}>Open point</Button>
          <Button variant="outline" className="h-11 flex-1 text-base" onClick={() => setConfirming(true)}>Delete point</Button>
        </div>
      )}
    </li>
  )
}

const SELECT =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

/** The project's LRR, and its MLRA where the region's indicators name some in that LRR. Decides which indicators apply. */
function SubregionPicker({ project, change }: { project: Project; change: Change }) {
  const { subregions } = regionOf(project.region)
  const sub = project.subregion
  const lrr = subregions.find((l) => l.id === sub?.lrr)
  const [problem, setProblem] = React.useState<string | null>(null)
  const set = async (subregion: Project["subregion"]) => {
    try {
      await change(project.id, ({ subregion: _old, ...p }) => (subregion ? { ...p, subregion } : p))
      setProblem(null)
    } catch {
      setProblem(WRITE_PROBLEM)
    }
  }
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-3" data-testid="subregion">
      <p className="text-sm text-muted-foreground">
        The subregion decides which hydric soil indicators apply: an indicator limited to other subregions is not suggested.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="project-lrr">Subregion (LRR)</Label>
        <select id="project-lrr" className={SELECT} value={sub?.lrr ?? ""} onChange={(e) => void set(e.target.value ? { lrr: e.target.value } : undefined)}>
          <option value="">Not picked</option>
          {subregions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      {lrr && lrr.mlras.length > 0 && (
        <div className="grid gap-1.5">
          <Label htmlFor="project-mlra">MLRA</Label>
          <select id="project-mlra" className={SELECT} value={sub?.mlra ?? ""} onChange={(e) => void set({ lrr: lrr.id, ...(e.target.value ? { mlra: e.target.value } : {}) })}>
            <option value="">Not picked</option>
            {lrr.mlras.map((m) => (
              <option key={m} value={m}>
                MLRA {m}
              </option>
            ))}
            <option value="other">Another MLRA</option>
          </select>
        </div>
      )}
      {problem && <p role="alert" className="text-sm font-medium">{problem}</p>}
    </div>
  )
}

function ProjectView({ project, change, onOpen, onBack }: { project: Project; change: Change; onOpen: (pointId: string) => void; onBack: () => void }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <Button variant="ghost" className="h-11 justify-start px-1 text-base" onClick={onBack}>
        <ChevronLeft /> All projects
      </Button>
      <NameRow label="Project" name={project.name} onSave={(name) => change(project.id, (p) => ({ ...p, name }))} />
      <p className="text-sm text-muted-foreground">{regionOf(project.region).name}</p>
      <SubregionPicker project={project} change={change} />
      {project.points.length === 0 && <p className="text-base">No sampling points yet.</p>}
      <ul className="grid gap-3">
        {project.points.map((point) => (
          <PointRow key={point.id} project={project} point={point} change={change} onOpen={() => onOpen(point.id)} />
        ))}
      </ul>
      <AddRow
        label="Sampling point"
        button="Add sampling point"
        onAdd={(name) => change(project.id, (p) => ({ ...p, points: [...p.points, newPoint(name)] }))}
      />
    </div>
  )
}

function ProjectList({ projects, add, change, remove, onOpen }: {
  projects: Project[]
  add: (project: Project) => Promise<unknown>
  change: Change
  remove: (id: string) => Promise<unknown>
  onOpen: (id: string) => void
}) {
  const [region, setRegion] = React.useState<RegionId>(REGIONS[0].id)
  const [confirming, setConfirming] = React.useState<string | null>(null)
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      {projects.length === 0 && <p className="text-base">No projects yet. A project is one wetland delineation.</p>}
      <ul className="grid gap-3">
        {projects.map((project) => (
          <li key={project.id} data-testid="project" className="grid min-w-0 gap-2 rounded-lg border border-border bg-card p-3">
            <NameRow label="Project" name={project.name} onSave={(name) => change(project.id, (p) => ({ ...p, name }))} />
            <p className="text-sm text-muted-foreground">
              {regionOf(project.region).name}, {plural(project.points.length, "sampling point")}
            </p>
            {confirming === project.id ? (
              <Confirm
                verb="Delete"
                what={`project ${project.name} with its ${plural(project.points.length, "sampling point")}`}
                onYes={() => void remove(project.id)}
                onNo={() => setConfirming(null)}
              />
            ) : (
              <div className="flex gap-2">
                <Button className="h-11 flex-1 text-base" onClick={() => onOpen(project.id)}>Open project</Button>
                <Button variant="outline" className="h-11 flex-1 text-base" onClick={() => setConfirming(project.id)}>Delete project</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <AddRow label="Project" button="Create project" onAdd={(name) => add(newProject(name, region))}>
        <div className="grid gap-1.5">
          <Label htmlFor="new-project-region">Region</Label>
          <select
            id="new-project-region"
            value={region}
            onChange={(e) => setRegion(e.target.value as RegionId)}
            className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id}: {r.name}
              </option>
            ))}
          </select>
        </div>
      </AddRow>
    </div>
  )
}

function ProjectsBrowser() {
  const { projects, problem, add, change, remove } = useProjects()
  const [view, setView] = React.useState<{ projectId?: string; pointId?: string }>({})
  const project = projects.find((p) => p.id === view.projectId)
  const point = project?.points.find((p) => p.id === view.pointId)
  return (
    <>
      {problem && <p role="alert" className="rounded-md border-2 border-foreground p-3 text-sm font-medium">{problem}</p>}
      {project && point ? (
        <PointView project={project} point={point} change={change} onBack={() => setView({ projectId: project.id })} />
      ) : project ? (
        <ProjectView project={project} change={change} onOpen={(pointId) => setView({ projectId: project.id, pointId })} onBack={() => setView({})} />
      ) : (
        <ProjectList projects={projects} add={add} change={change} remove={remove} onOpen={(projectId) => setView({ projectId })} />
      )}
    </>
  )
}

export function ProjectsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 rounded-t-xl data-[side=bottom]:h-[96svh]">
        <SheetHeader className="pr-14">
          <SheetTitle>Projects</SheetTitle>
          <SheetDescription>
            A project is one wetland delineation. Its sampling points hold the layers of each soil profile, which fill the
            Soil page of the form. They live only on this device, like the Log.
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-4 overflow-y-auto px-4 pb-4">
          <ProjectsBrowser />
        </div>
        <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" size="lg" className="h-12 w-full text-base" onClick={() => onOpenChange(false)}>
            Close Projects
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
