import * as React from "react"
import { readPhoto, type XY } from "@/engine"
import type { ExamplePhoto } from "@/engine/simulate"
import { BottomBar } from "@/components/BottomBar"
import { CardPanel } from "@/components/CardPanel"
import { ExamplePicker } from "@/components/ExamplePicker"
import { InstallHint } from "@/components/InstallHint"
import { LogPanel } from "@/components/LogPanel"
import { PhotoView } from "@/components/PhotoView"
import { ReadingsPanel } from "@/components/ReadingsPanel"
import { SpotsPanel } from "@/components/SpotsPanel"
import { StepIndicator } from "@/components/StepIndicator"
import { ThemeToggle } from "@/components/ThemeToggle"
import { UpdateNotice } from "@/components/UpdateNotice"
import { examplePhoto, filePhoto } from "@/lib/photo"
import {
  CORNER_COUNT,
  canUndo,
  cardOf,
  initialSession,
  sessionReducer,
  stepOf,
} from "@/lib/session"

export function App() {
  const [session, dispatch] = React.useReducer(sessionReducer, initialSession)
  const [problem, setProblem] = React.useState<string | null>(null)
  const step = stepOf(session)

  // One engine call per change of Photo, Card or Spots.
  const { photo, noCard, corners, spots } = session
  const result = React.useMemo(() => {
    const card = cardOf({ photo, noCard, corners, spots })
    return photo && card && spots.length > 0
      ? readPhoto({ pixels: photo.pixels, card, spots })
      : null
  }, [photo, noCard, corners, spots])

  // A new Photo is picked from controls below it; bring the Photo back into view.
  React.useEffect(() => {
    if (session.photo) window.scrollTo({ top: 0 })
  }, [session.photo])

  const pickExample = (example: ExamplePhoto) => {
    setProblem(null)
    dispatch({ type: "load", photo: examplePhoto(example), noCard: example.scene.card === false })
  }
  const pickFile = async (file: File) => {
    try {
      const photo = await filePhoto(file)
      setProblem(null)
      dispatch({ type: "load", photo })
    } catch {
      setProblem("That file didn't open as a Photo. Try a JPEG or PNG.")
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-xl flex-col">
      <header className="relative px-4 pt-[env(safe-area-inset-top)]">
        <h1 className="py-3 font-heading text-xl font-extrabold tracking-tight [font-stretch:110%]">
          Munsell Soil Reader
        </h1>
        <UpdateNotice hasPhoto={session.photo !== null} />
      </header>

      <main className="flex flex-1 flex-col gap-4 pb-44">
        <div className="px-4">
          <StepIndicator
            step={step}
            cornersTapped={session.corners.length}
            cornerCount={CORNER_COUNT}
            noCard={session.noCard}
            spotCount={session.spots.length}
          />
        </div>

        <PhotoView
          pixels={session.photo?.pixels ?? null}
          corners={session.corners}
          spots={session.spots}
          onTap={(point: XY) => dispatch({ type: "tap", point })}
        />

        <div className="grid gap-3 px-4">
          {problem && (
            <p role="alert" className="rounded-md border-2 border-foreground p-3 text-sm font-medium">
              {problem}
            </p>
          )}
          {session.photo ? (
            <>
              <p className="text-sm text-muted-foreground" data-testid="photo-name">
                {session.photo.name}
              </p>
              <CardPanel tapped={session.corners.length} noCard={session.noCard} />
              {step === "spots" && <SpotsPanel spotCount={session.spots.length} />}
            </>
          ) : (
            <p className="text-base">Take or choose a Photo with the Card beside the soil.</p>
          )}
          <LogPanel result={result} card={cardOf(session)} />
          <ExamplePicker activeId={session.photo?.exampleId} onPick={pickExample} />
        </div>

        {/* At the bottom of the page, where a thumb reaches it. */}
        <footer className="px-2">
          <InstallHint />
          <ThemeToggle />
        </footer>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-xl">
        <ReadingsPanel result={result} />
        <BottomBar
          onFile={pickFile}
          onUndo={() => dispatch({ type: "undo" })}
          onNoCard={() => dispatch({ type: "noCard" })}
          onRestart={() => dispatch({ type: "restart" })}
          canUndo={canUndo(session)}
          hasPhoto={session.photo !== null}
          noCard={session.noCard}
        />
      </div>
    </div>
  )
}

export default App
