// The Vegetation page's entry: for each stratum its plot size and plants, a plant typed by common name,
// scientific name or abbreviation and resolved against the project's regional plant list, with its cover,
// and the page's remarks. A plant is never put on the page by a guess: one exact match resolves, anything
// else is candidates to pick from, and a name not on the list is recorded as UPL with a note.
import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { vegetationOf, type Project, type SamplingPoint } from "@/delineation/model"
import { coverProblem, isUnlisted, plantEntryOf, plantNote, type PlantEntry, type Vegetation } from "@/delineation/vegetation/entry"
import { loadPlantList } from "@/delineation/vegetation/loadPlantList"
import { pickPlant, resolvePlant, type Plant, type PlantList, type Resolution } from "@/delineation/vegetation/plantList"
import { STRATA, STRATUM_DEFINITION, STRATUM_LABEL, SUGGESTED_PLOT, type Stratum } from "@/delineation/vegetation/strata"
import { cn } from "@/lib/utils"

interface Props {
  project: Project
  point: SamplingPoint
  /** Changes the point's vegetation. Rejects when the Log could not be written. */
  onChange: (change: (vegetation: Vegetation) => Vegetation) => Promise<unknown>
}

const INPUT = "h-11 text-base"
const WRITE_PROBLEM = "The Log could not be written on this device. Try again."

const written = (n: number) => String(Math.round(n * 100) / 100)

/** The plant list of the project's region, loaded the first time it is needed. */
function usePlantList(project: Project) {
  const [list, setList] = React.useState<PlantList | null>(null)
  const [problem, setProblem] = React.useState<string | null>(null)
  React.useEffect(() => {
    let current = true
    loadPlantList(project.region).then(
      (loaded) => current && setList(loaded),
      () => current && setProblem("The plant list did not load. Reload the page and try again."),
    )
    return () => {
      current = false
    }
  }, [project.region])
  return { list, problem }
}

const nameOf = (p: Plant) => (p.common ? `${p.name} (${p.common})` : p.name)

/** What the typed name came to, in words, and the candidates to pick from. */
function Resolved({ resolution, onPick }: { resolution: Resolution; onPick: (plant: Plant) => void }) {
  switch (resolution.kind) {
    case "empty":
      return <p className="text-sm text-muted-foreground">Type a common name, a scientific name or an abbreviation such as RCG.</p>
    case "resolved":
      return (
        <div className="grid gap-1 text-sm">
          <p>
            <b className="font-semibold">{resolution.plant.name}</b> <span className="font-mono">{resolution.status.status ?? resolution.status.listed}</span>
            {resolution.plant.common && <span className="text-muted-foreground"> {resolution.plant.common}</span>}
          </p>
          {resolution.status.note && <p className="text-muted-foreground">{resolution.status.note}</p>}
        </div>
      )
    case "genus":
      return (
        <p className="text-sm">
          <b className="font-semibold">{resolution.genus} spp.</b> <span className="font-mono">{resolution.status.status}</span>
          <span className="text-muted-foreground"> All {resolution.plants.length} {resolution.genus} plants on the list have this status, so it is recorded as the genus. Type a species for a dominant.</span>
        </p>
      )
    case "candidates":
      return (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Which plant?</p>
          <ul className="grid gap-1.5">
            {resolution.candidates.map((plant) => (
              <li key={plant.name}>
                <Button variant="outline" className="h-auto min-h-11 w-full justify-start py-2 text-left text-sm whitespace-normal" onClick={() => onPick(plant)}>
                  {nameOf(plant)}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )
    case "unlisted":
    case "unknown":
      return (
        <div className="grid gap-1 text-sm">
          <p>
            <b className="font-semibold">{resolution.name}</b> <span className="font-mono">UPL</span>
          </p>
          <p className="text-muted-foreground">{resolution.note}</p>
        </div>
      )
  }
}

/**
 * A text field that keeps what is typed in the page and writes it to the Log as it goes, so the caret
 * never waits on the database. Writes are ordered, so the last one is what is kept.
 */
function DraftField({ stored, onWrite, render }: { stored: string; onWrite: (value: string) => void; render: (props: { value: string; onChange: (value: string) => void }) => React.ReactNode }) {
  const [draft, setDraft] = React.useState(stored)
  return render({
    value: draft,
    onChange: (value) => {
      setDraft(value)
      onWrite(value)
    },
  })
}

/**
 * One plant's row: its name, status, cover and why. A plant not on the list can be marked not identified,
 * which leaves it out of the prevalence index.
 */
function PlantRow({ plant, onDelete, onIdentified }: { plant: PlantEntry; onDelete: () => Promise<unknown>; onIdentified: (identified: boolean) => Promise<unknown> }) {
  const note = plantNote(plant)
  const notIdentified = plant.identified === "none"
  return (
    <li data-testid="plant" className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-md border border-border p-2">
      <div className="grid min-w-0 gap-1 text-sm">
        <p className="[overflow-wrap:anywhere]">
          <b className="font-semibold">{plant.name}</b>{" "}
          <span className="font-mono">{plant.status ?? plant.listed}</span>{" "}
          <span className="font-mono">{written(plant.cover)}%</span>
        </p>
        {note && <p data-testid="plant-note" className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{note}</p>}
        {isUnlisted(plant) && (
          <button
            type="button"
            aria-pressed={notIdentified}
            onClick={() => void onIdentified(notIdentified)}
            className={cn(
              "min-h-11 justify-self-start rounded-lg border px-3 text-sm font-medium",
              notIdentified ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground",
            )}
          >
            Not identified
          </button>
        )}
      </div>
      <Button variant="outline" size="icon-lg" className="size-11" aria-label={`Remove ${plant.name}`} onClick={() => void onDelete()}>
        <X />
      </Button>
    </li>
  )
}

export function VegetationEntry({ project, point, onChange }: Props) {
  const vegetation = vegetationOf(point)
  const { list, problem: listProblem } = usePlantList(project)
  const [stratum, setStratum] = React.useState<Stratum>("herb")
  const [typed, setTyped] = React.useState("")
  const [cover, setCover] = React.useState("")
  const [picked, setPicked] = React.useState<Plant | null>(null)
  const [problem, setProblem] = React.useState<string | null>(null)

  const resolution: Resolution | null = React.useMemo(
    () => (list ? (picked ? pickPlant(list, picked) : resolvePlant(list, typed)) : null),
    [list, typed, picked],
  )

  const guard = async (work: () => Promise<unknown>) => {
    try {
      await work()
      setProblem(null)
    } catch {
      setProblem(WRITE_PROBLEM)
    }
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(cover)
    const wrong = coverProblem(amount)
    if (!resolution) return
    if (resolution.kind === "empty") return setProblem("Type the plant's name.")
    if (resolution.kind === "candidates") return setProblem("Pick which plant it is, from the list above.")
    if (wrong) return setProblem(wrong)
    const entry = plantEntryOf(resolution, crypto.randomUUID(), stratum, picked ? picked.name : typed, amount)
    if (!entry) return
    // The fields clear at once, so the next plant can be typed while this one is written. If the
    // write fails, what was typed comes back, unless something new has been typed since.
    const [wasTyped, wasCover, wasPicked] = [typed, cover, picked]
    setTyped("")
    setCover("")
    setPicked(null)
    onChange((v) => ({ ...v, plants: [...v.plants, entry] })).then(
      () => setProblem(null),
      () => {
        setProblem(WRITE_PROBLEM)
        setTyped((now) => (now === "" ? wasTyped : now))
        setCover((now) => (now === "" ? wasCover : now))
        setPicked((now) => now ?? wasPicked)
      },
    )
  }

  const inStratum = (s: Stratum) => vegetation.plants.filter((p) => p.stratum === s)

  return (
    <section aria-label="Vegetation" className="grid min-w-0 gap-4">
      <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Vegetation, ENG Form 6116-8</h4>

      {STRATA.map((s) => {
        const plants = inStratum(s)
        const total = plants.reduce((sum, p) => sum + p.cover, 0)
        return (
          <div key={s} data-testid={`stratum-${s}`} className="grid min-w-0 gap-2 rounded-lg border border-border bg-card p-3">
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <h5 className="font-heading text-base font-bold">{STRATUM_LABEL[s]}</h5>
              {plants.length > 0 && <span className="font-mono text-sm" data-testid={`total-${s}`}>Total {written(total)}%</span>}
            </div>
            <p className="text-xs text-muted-foreground">{STRATUM_DEFINITION[s]}</p>
            <div className="grid gap-1.5">
              <Label htmlFor={`plot-${s}`} className="text-sm">Plot size</Label>
              <DraftField
                stored={vegetation.plotSizes[s] ?? ""}
                onWrite={(value) => void guard(() => onChange((v) => ({ ...v, plotSizes: { ...v.plotSizes, [s]: value === "" ? undefined : value } })))}
                render={({ value, onChange: set }) => (
                  <Input id={`plot-${s}`} className={INPUT} placeholder={SUGGESTED_PLOT[s]} value={value} onChange={(e) => set(e.target.value)} />
                )}
              />
            </div>
            {plants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No plants.</p>
            ) : (
              <ul className="grid gap-1.5">
                {plants.map((plant) => (
                  <PlantRow
                    key={plant.id}
                    plant={plant}
                    onDelete={() => guard(() => onChange((v) => ({ ...v, plants: v.plants.filter((p) => p.id !== plant.id) })))}
                    onIdentified={(identified) =>
                      guard(() =>
                        onChange((v) => ({
                          ...v,
                          plants: v.plants.map((p) => (p.id === plant.id ? { ...p, unlisted: true, identified: identified ? "species" : "none" } : p)),
                        })),
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        )
      })}

      <form onSubmit={add} noValidate className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-3" aria-label="Add a plant">
        <h5 className="font-heading text-base font-bold">Add a plant</h5>
        <div role="group" aria-label="Stratum" className="grid grid-cols-2 gap-1.5">
          {STRATA.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={stratum === s}
              onClick={() => setStratum(s)}
              className={cn(
                "min-h-11 rounded-lg border px-2 text-sm font-medium",
                stratum === s ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground",
              )}
            >
              {STRATUM_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="plant-name">Plant name</Label>
            <Input
              id="plant-name"
              className={INPUT}
              placeholder="fall panicgrass, RCG, Phalaris arundinacea"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value)
                setPicked(null)
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="plant-cover">Cover %</Label>
            <Input id="plant-cover" className={INPUT} inputMode="decimal" value={cover} onChange={(e) => setCover(e.target.value)} />
          </div>
        </div>
        <div data-testid="plant-resolution" data-kind={resolution?.kind ?? "loading"} role="status" className="min-w-0 [overflow-wrap:anywhere]">
          {listProblem ? <p className="text-sm font-medium">{listProblem}</p> : resolution ? <Resolved resolution={resolution} onPick={setPicked} /> : <p className="text-sm text-muted-foreground">Loading the plant list.</p>}
        </div>
        {problem && (
          <p role="alert" className="min-w-0 rounded-md border-2 border-foreground p-3 text-sm font-medium [overflow-wrap:anywhere]">
            {problem}
          </p>
        )}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={!list}>
          Add plant
        </Button>
      </form>

      <div className="grid gap-1.5">
        <Label htmlFor="veg-remarks">Vegetation remarks (bare ground, photo numbers)</Label>
        <DraftField
          stored={vegetation.remarks}
          onWrite={(value) => void guard(() => onChange((v) => ({ ...v, remarks: value })))}
          render={({ value, onChange: set }) => <Textarea id="veg-remarks" className="min-h-24 text-base" value={value} onChange={(e) => set(e.target.value)} />}
        />
      </div>
    </section>
  )
}
