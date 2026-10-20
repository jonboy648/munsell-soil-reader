import * as React from "react"
import { readPhoto, type XY } from "@/engine"
import type { ExamplePhoto } from "@/engine/simulate"
import { AssignSheet } from "@/components/AssignSheet"
import { BottomBar } from "@/components/BottomBar"
import { CardPanel } from "@/components/CardPanel"
import { ExamplePicker } from "@/components/ExamplePicker"
import { InstallHint } from "@/components/InstallHint"
import { LogPanel } from "@/components/LogPanel"
import { MethodPage } from "@/components/method/MethodPage"
import { ProjectGuide, ProjectNavigation } from "@/components/ProjectGuide"
import { PhotoView } from "@/components/PhotoView"
import { ReadingsPanel } from "@/components/ReadingsPanel"
import { SpotsPanel } from "@/components/SpotsPanel"
import { StepIndicator } from "@/components/StepIndicator"
import { ThemeToggle } from "@/components/ThemeToggle"
import { buttonVariants } from "@/components/ui/button"
import { UpdateNotice } from "@/components/UpdateNotice"
import { lookupBatch } from "@/lib/batches"
import { examplePhoto, filePhoto } from "@/lib/photo"
import { hrefOf, markOpenedHere, usePage } from "@/lib/route"
import { useServiceWorker } from "@/lib/serviceWorker"
import {
  CORNER_COUNT,
  canUndo,
  cardOf,
  frameDetailOf,
  initialSession,
  sessionReducer,
  stepOf,
} from "@/lib/session"
import type { CardInfo } from "@/lib/verdict"

export function App() {
  const page = usePage()
  // Followed here, above the page switch: a first visit that opens on the method page still
  // installs the service worker, and its notices are not lost on the way between pages.
  const serviceWorker = useServiceWorker()
  const [session, dispatch] = React.useReducer(sessionReducer, initialSession)
  const [problem, setProblem] = React.useState<string | null>(null)
  // The Spot whose Reading is being assigned to a layer, while the assign sheet is open.
  const [assigning, setAssigning] = React.useState<number | null>(null)
  const step = stepOf(session)

  // One engine call per change of Photo, Card or Spots.
  const { photo, noCard, cardKind, hue, corners, spots, frame } = session
  const result = React.useMemo(() => {
    const card = cardOf({ photo, noCard, cardKind, hue, corners, spots, frame })
    return photo && card && spots.length > 0
      ? readPhoto({ pixels: photo.pixels, card, spots })
      : null
  }, [photo, noCard, cardKind, hue, corners, spots, frame])

  // The frame is the Card: look for it in the Photo. The finder (and js-aruco2) is loaded only
  // now, so users who never choose the frame never download it.
  React.useEffect(() => {
    if (cardKind !== "frame" || !photo) return
    let current = true
    import("@/engine/frame").then(
      ({ findCard }) => {
        if (!current) return
        let outline = null
        try {
          outline = findCard(photo.pixels)
        } catch {
          // A Photo the finder cannot read has no frame in it, as far as the user can tell.
        }
        dispatch({ type: "frameFound", outline })
      },
      () => current && dispatch({ type: "frameFound", outline: null, failed: true }),
    )
    return () => {
      current = false
    }
  }, [cardKind, photo])

  const frameDrawing = React.useMemo(
    () => (cardKind === "frame" ? { outline: frame.outline, confirmed: frame.confirmed } : undefined),
    [cardKind, frame.outline, frame.confirmed],
  )
  // The button that confirms the outline is below the Photo, so the page may have scrolled to it
  // (on a phone it nearly always has); the next thing to do is tap the soil in the Photo.
  const confirmOutline = () => {
    dispatch({ type: "frameConfirm" })
    window.scrollTo({ top: 0 })
  }
  const onBatchCode = (code: string) => {
    dispatch({ type: "batchCode", code })
    if (code.trim() !== "") void lookupBatch(code).then((answer) => dispatch({ type: "batchResult", code, result: answer }))
  }
  const spotRadii = React.useMemo(() => result?.readings.map((r) => r.radius), [result])
  const cardInfo: CardInfo =
    cardKind === "frame" && !noCard ? { kind: "frame" } : cardKind === "page" && hue ? { kind: "page", hue } : { kind: "colorchecker" }

  // A new Photo is picked from controls below it; bring the Photo back into view.
  React.useEffect(() => {
    if (session.photo) window.scrollTo({ top: 0 })
  }, [session.photo])

  const pickExample = (example: ExamplePhoto) => {
    setProblem(null)
    dispatch({
      type: "load",
      photo: examplePhoto(example),
      noCard: example.scene.card === false && !example.scene.frame,
      cardKind: example.scene.frame ? "frame" : example.scene.page ? "page" : "colorchecker",
    })
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

  if (page === "method") return <MethodPage />
  if (page === "guide") return <ProjectGuide />

  return (
    <div className="reader-workspace mx-auto flex min-h-svh flex-col">
      <header className="reader-header relative pt-[env(safe-area-inset-top)]">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 py-5">
        <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl [font-stretch:110%]">
          Munsell Soil Reader
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Photo readings and field records</p>
        </div>
        <p className="text-xs text-muted-foreground">Photos stay on this device</p>
        </div>
        <UpdateNotice hasPhoto={session.photo !== null} status={serviceWorker} />
      </header>
      <div className="px-4 pt-3">
        <ProjectNavigation page="reader" />
      </div>

      <main className="reader-layout flex-1">
        <section className="reader-photo min-w-0" aria-label="Photo workspace">
        <div className="mb-4">
          <StepIndicator
            step={step}
            cornersTapped={session.corners.length}
            cornerCount={CORNER_COUNT}
            noCard={session.noCard}
            cardKind={cardKind}
            frameDetail={frameDetailOf(frame)}
            spotCount={session.spots.length}
          />
        </div>

        <PhotoView
          pixels={session.photo?.pixels ?? null}
          corners={session.corners}
          spots={session.spots}
          spotRadii={spotRadii}
          cardKind={cardKind}
          hue={hue}
          leftOut={result?.cardCheck?.leftOut}
          frame={frameDrawing}
          onTap={(point: XY) => dispatch({ type: "tap", point })}
        />
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Keep the Card and soil in the same light. Use the neutral surround to compare colors.</p>
        </section>

        <aside className="reader-tools min-w-0" aria-label="Reading setup and field records">
          <section className="reader-tool-section" aria-label="Reading setup">
          <h2 className="font-heading text-lg font-bold">{session.photo ? "Set up this reading" : "Start with a photo"}</h2>
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
              <CardPanel
                tapped={session.corners.length}
                noCard={session.noCard}
                cardKind={cardKind}
                hue={hue}
                onCardKind={(kind) => dispatch({ type: "cardKind", cardKind: kind })}
                onHue={(h) => dispatch({ type: "hue", hue: h })}
                frame={frame}
                onBatchCode={onBatchCode}
                onConfirmOutline={confirmOutline}
              />
              {step === "spots" && <SpotsPanel spotCount={session.spots.length} inWindow={cardKind === "frame" && !noCard} />}
            </>
          ) : (
            <p className="text-base">Take or choose a Photo with the Card beside the soil.</p>
          )}
          </section>
          <div className="reader-tool-section">
          <LogPanel result={result} card={cardOf(session)} spots={session.spots} />
          </div>
          <div className="reader-tool-section">
          <ExamplePicker activeId={session.photo?.exampleId} onPick={pickExample} />
          </div>
        </aside>

        {/* At the bottom of the page, where a thumb reaches it. */}
        <footer className="reader-footer flex flex-wrap items-center gap-1">
          <InstallHint />
          <a
            href={hrefOf("method")}
            onClick={markOpenedHere}
            data-testid="method-link"
            className={buttonVariants({ variant: "ghost", size: "lg", className: "h-11" })}
          >
            Accuracy, method and credits
          </a>
          <ThemeToggle />
        </footer>
      </main>

      <div className="reader-dock fixed inset-x-0 bottom-0 z-10 mx-auto">
        <ReadingsPanel result={result} card={cardInfo} onAssign={setAssigning} />
        <AssignSheet index={assigning} result={result} card={cardOf(session)} onClose={() => setAssigning(null)} />
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
