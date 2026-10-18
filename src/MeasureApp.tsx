// Measurement mode, at /?measure: a maker tool that measures the swatches of a filament lot
// against a ColorChecker and writes the batch file the frame card reads. It is not part of the
// main flow; App.tsx never loads it unless the address asks for it.
import * as React from "react"
import { Plus } from "lucide-react"
import {
  SWATCH_IDS,
  measureShot,
  summarizeShots,
  swatchRadius,
  swatchSlot,
  type Corners,
  type XY,
} from "@/engine"
import { measureExamples, type ExamplePhoto } from "@/engine/simulate"
import { BottomBar } from "@/components/BottomBar"
import { CardCheckBadge } from "@/components/CardCheckBadge"
import { CardPanel } from "@/components/CardPanel"
import { ExamplePicker } from "@/components/ExamplePicker"
import { MeasureResults } from "@/components/MeasureResults"
import { PhotoView } from "@/components/PhotoView"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"
import { initialMeasure, measureReducer } from "@/lib/measureSession"
import { examplePhoto, filePhoto } from "@/lib/photo"
import { CORNER_COUNT, canUndo, stepOf } from "@/lib/session"

const fmt = (n: number) => n.toFixed(1)

const METHOD = [
  "Each shot is corrected against the ColorChecker with the same correction and Card check as the main reader. Each swatch is read from the corrected Photo, and the shots whose Card check is good are averaged. A shot whose Card check is not good is left out and listed.",
  "Numbers are CIELAB under D50, the scale the ColorChecker's published values use. The spread is the sample standard deviation of each channel across the shots, in the same units.",
  "A camera has three broad channels where a spectrophotometer measures the whole spectrum, so two materials that match for the camera can differ for the eye. This metamerism leaves roughly 1 to 2 dE00 (CIEDE2000) of systematic error, which taking more shots does not average away. That is why the first lot's swatch card is also sent to a measurement service once (the decision on issue #50): if the camera is within about 1 dE00 of it, the camera method stands for later lots; if not, a spectrophotometer is bought.",
  "Shoot in soft daylight, from different places, with nothing clipped or in shadow. A swatch lighter than the ColorChecker's white or darker than its black is read past what the Card can vouch for, and the Card check does not see that: in simulated Photos a swatch as light as the white read up to 5 dE00 out under a strong camera color shift.",
]

export default function MeasureApp() {
  const [state, dispatch] = React.useReducer(measureReducer, initialMeasure)
  const [problem, setProblem] = React.useState<string | null>(null)
  const { session, labels, next, shots } = state
  const step = stepOf(session)
  const examples = React.useMemo(measureExamples, [])
  const summary = React.useMemo(() => summarizeShots(shots), [shots])

  // The shot being taken, measured as it goes, so a failed Card check shows before it is added.
  const { photo, corners, spots } = session
  const live = React.useMemo(
    () =>
      photo && corners.length === CORNER_COUNT && spots.length > 0
        ? measureShot(photo.pixels, corners as Corners, spots.map((at, i) => ({ id: labels[i], at })))
        : null,
    [photo, corners, spots, labels],
  )
  const radiusOf = React.useCallback((spot: XY) => swatchRadius(corners as Corners, spot), [corners])

  React.useEffect(() => {
    if (photo) window.scrollTo({ top: 0 })
  }, [photo])

  const pickExample = (example: ExamplePhoto) => {
    setProblem(null)
    dispatch({ type: "load", photo: examplePhoto(example) })
  }
  const pickFile = async (file: File) => {
    try {
      const loaded = await filePhoto(file)
      setProblem(null)
      dispatch({ type: "load", photo: loaded })
    } catch {
      setProblem("That file didn't open as a Photo. Try a JPEG or PNG.")
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-xl flex-col">
      <header className="px-4 pt-[env(safe-area-inset-top)]">
        <h1 className="pt-3 font-heading text-xl font-extrabold tracking-tight [font-stretch:110%]">
          Measurement mode
        </h1>
        <p className="pb-3 text-sm text-muted-foreground">
          A maker tool: measures a filament lot's swatches against a ColorChecker.{" "}
          <a href="/" className="underline underline-offset-4">Back to the reader</a>
        </p>
      </header>

      <main className="flex flex-1 flex-col gap-4 pb-44">
        <PhotoView
          pixels={photo?.pixels ?? null}
          corners={corners}
          spots={spots}
          spotLabels={labels.map((id) => String(Number(id.slice("swatch_".length))))}
          radiusOf={radiusOf}
          onTap={(point: XY) => dispatch({ type: "tap", point })}
        />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4">
          {problem && (
            <p role="alert" className="rounded-md border-2 border-foreground p-3 text-sm font-medium">
              {problem}
            </p>
          )}
          {!photo && (
            <p className="text-base" data-testid="measure-prompt">
              Take or choose a Photo of the swatch card beside the ColorChecker, or practice with an example.
            </p>
          )}
          {photo && <p className="text-sm text-muted-foreground" data-testid="photo-name">{photo.name}</p>}
          {photo && step === "corners" && <CardPanel tapped={corners.length} noCard={false} />}
          {photo && step === "spots" && (
            <div className="grid gap-3">
              <p className="text-base" data-testid="swatch-prompt">
                Tap{" "}
                <b className="font-semibold underline decoration-2 underline-offset-4">{next}</b>{" "}
                <span className="text-muted-foreground">(frame slot {swatchSlot(next)})</span>.{" "}
                <span className="font-mono text-sm text-muted-foreground">{labels.length}/{SWATCH_IDS.length}</span>
              </p>
              <label className="grid gap-1 text-sm text-muted-foreground">
                Swatch to tap
                <select
                  value={next}
                  onChange={(e) => dispatch({ type: "pick", id: e.target.value })}
                  data-testid="swatch-label"
                  className="h-11 rounded-md border border-input bg-background px-2 text-base text-foreground"
                >
                  {SWATCH_IDS.map((id) => (
                    <option key={id} value={id}>
                      {id} ({swatchSlot(id)}){labels.includes(id) ? " - placed" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {live && (
                <div className="grid gap-2" data-testid="shot-readings">
                  <CardCheckBadge verdict={live.cardCheck.ok ? "good" : "failed"} cardCheck={live.cardCheck} className="w-fit" />
                  {!live.cardCheck.ok && (
                    <p className="text-sm">
                      This shot's Card check failed, so it will be listed but not averaged. Check the corner
                      order, glare and shade on the Card, then Start over or take the Photo again.
                    </p>
                  )}
                  <p className="font-mono text-xs break-words text-muted-foreground">
                    {live.swatches.map((s) => `${s.id.slice("swatch_".length)}: ${s.lab.map(fmt).join(" ")}`).join("  |  ")}
                  </p>
                </div>
              )}
              <Button
                size="lg"
                className="h-11"
                disabled={spots.length === 0}
                onClick={() => dispatch({ type: "addShot" })}
                data-testid="add-shot"
              >
                <Plus /> Add shot
              </Button>
            </div>
          )}
          <ExamplePicker activeId={photo?.exampleId} onPick={pickExample} examples={examples} />

          <MeasureResults shots={shots} summary={summary} onDrop={(index) => dispatch({ type: "dropShot", index })} />

          <details className="rounded-lg border border-border bg-card p-3 text-sm" data-testid="method">
            <summary className="cursor-pointer font-semibold">How this is measured</summary>
            <div className="mt-2 grid gap-2 text-muted-foreground">
              {METHOD.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </details>
        </div>

        <footer className="px-2">
          <ThemeToggle />
        </footer>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-xl">
        <BottomBar
          onFile={pickFile}
          onUndo={() => dispatch({ type: "undo" })}
          onRestart={() => dispatch({ type: "restart" })}
          canUndo={canUndo(session)}
          hasPhoto={photo !== null}
          noCard={false}
        />
      </div>
    </div>
  )
}
