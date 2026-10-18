// The accuracy and method page: how a Reading is made, what each warning means, which correction
// and why, the limits, what the app decides, what leaves the phone, the 20-soil test results and
// the credits. All text is in the app, so it reads the same with no network.
import * as React from "react"
import { ArrowLeft } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { closePage, hrefOf } from "@/lib/route"
import { CardsSection } from "./CardsSection"
import { CorrectionSection } from "./CorrectionSection"
import { Credits } from "./Credits"
import { DecidesSection } from "./DecidesSection"
import { LeavesPhoneSection } from "./LeavesPhoneSection"
import { LimitsSection } from "./LimitsSection"
import { MeasuringSection } from "./MeasuringSection"
import { PhotoWarnings } from "./PhotoWarnings"
import { ReadingSteps } from "./ReadingSteps"
import { ResultsSection } from "./ResultsSection"
import { cn } from "@/lib/utils"

const CONTENTS: { id: string; label: string }[] = [
  { id: "steps", label: "How a Reading is made" },
  { id: "warnings", label: "Photo warnings" },
  { id: "correction", label: "Which correction, and why" },
  { id: "cards", label: "ColorChecker or a Page" },
  { id: "measuring", label: "Measuring the frame's colors" },
  { id: "limits", label: "Limits" },
  { id: "decides", label: "What the app decides" },
  { id: "privacy", label: "What leaves your phone" },
  { id: "results", label: "20-soil test results" },
  { id: "credits", label: "Credits and licenses" },
]

function BackLink({ className }: { className?: string }) {
  return (
    <a
      href={hrefOf("reader")}
      onClick={(event) => {
        event.preventDefault()
        closePage()
      }}
      data-testid="back-to-reader"
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11", className)}
    >
      <ArrowLeft />
      Back to the Photo
    </a>
  )
}

export function MethodPage() {
  // The page was opened from a link lower down the reader; start at the top.
  React.useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <div className="mx-auto flex min-h-svh max-w-xl flex-col" data-testid="method-page">
      <header className="grid gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4">
        <BackLink className="w-fit" />
        <h1 className="font-heading text-2xl font-extrabold tracking-tight [font-stretch:110%]">
          Accuracy and method
        </h1>
        <p>
          How the Munsell Soil Reader turns a Photo into a Chip, how far to trust it, and what it is
          built on. Everything on this page is in the app, so it opens with no signal.
        </p>
        <nav aria-label="On this page" className="grid gap-1">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            On this page
          </p>
          <ul className="flex flex-wrap gap-2">
            {CONTENTS.map(({ id, label }) => (
              <li key={id}>
                <button
                  type="button"
                  className="min-h-11 rounded-full border border-border bg-card px-3 text-sm active:bg-muted"
                  onClick={() =>
                    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="flex flex-1 flex-col text-base leading-relaxed">
        <ReadingSteps />
        <PhotoWarnings />
        <CorrectionSection />
        <CardsSection />
        <MeasuringSection />
        <LimitsSection />
        <DecidesSection />
        <LeavesPhoneSection />
        <ResultsSection />
        <Credits />
      </main>

      <footer className="border-t border-border px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <BackLink />
      </footer>
    </div>
  )
}
