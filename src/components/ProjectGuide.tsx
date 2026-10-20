// Bundled product guide and review worksheet. Feedback leaves only when the user copies and sends it.
import * as React from "react"
import { ArrowRight, Check, Clipboard, FileText } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { hrefOf } from "@/lib/route"
import { cn } from "@/lib/utils"

const GUIDE_DATE = "2026-10-20"

export function ProjectNavigation({ page }: { page: "reader" | "guide" }) {
  return (
    <nav aria-label="App pages" className="flex gap-1 overflow-x-auto pb-3">
      {([
        ["reader", "Soil reader"],
        ["guide", "About & progress"],
      ] as const).map(([id, label]) => (
        <a
          key={id}
          href={hrefOf(id)}
          aria-current={page === id ? "page" : undefined}
          className={cn(
            "flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            page === id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}

const STEPS = [
  ["Set up the field record", "Create a project and sampling point. Enter the shared project details once, then record the conditions at each point."],
  ["Photograph and read the soil", "Place the reference Card beside the soil in the same light. Tap the main soil color and any mottles to get Munsell readings and a Card check."],
  ["Put readings into layers", "Assign each reading to a layer as its matrix or redox color. Add depths in inches, percentages, texture and redox details."],
  ["Record plants and water", "Enter plants and their cover by stratum, plus hydrology indicators and water depths. Complete the observations a photo cannot supply."],
  ["Review the evidence", "Review indicator suggestions and their reasons. Confirm the choices that belong on the form; professional judgment stays with the person doing the fieldwork."],
  ["Preview and export the forms", "Use the saved sampling-point record to fill the official USACE form. Check the preview, then download or share the PDF from the device."],
] as const

const NEXT = [
  ["Vegetation calculations", "Dominance, prevalence index and vegetation suggestions are in review.", 74, "pull"],
  ["Location lookups", "Optional lookups for header information are in review.", 75, "pull"],
  ["Offline reliability", "Browser reliability fixes are in review.", 68, "pull"],
  ["Complete determination", "Finish the combined conclusions and the full sampling-point-to-form workflow.", 37, "issues"],
  ["Excel and Midwest forms", "Add the official Excel output and the Midwest regional package.", 40, "issues"],
  ["Plant photo identification", "Add an optional online identification service with a choice of candidates.", 43, "issues"],
] as const

function ReviewWorksheet() {
  const [decision, setDecision] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [message, setMessage] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState("")
  const output = React.useRef<HTMLTextAreaElement>(null)

  const prepare = async () => {
    const url = new URL(window.location.href)
    url.hash = "guide"
    const text = [
      "Munsell Soil Reader review",
      `Page: ${url.href}`,
      `Guide revision: ${GUIDE_DATE}`,
      `Decision: ${decision}`,
      `Feedback: ${notes.trim() || "No additional notes."}`,
    ].join("\n")
    setFeedback(text)
    try {
      await navigator.clipboard.writeText(text)
      setMessage("Review copied. Paste it into the existing message conversation and send it there.")
    } catch {
      setMessage("Automatic copying is unavailable. Select the prepared review below, copy it, and send it in the existing message conversation.")
    }
  }

  return (
    <section id="review" aria-labelledby="review-title" className="scroll-mt-6 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Field review</p>
      <h2 id="review-title" className="mt-2 font-heading text-2xl font-bold">Tell us what works. Flag what gets in the way.</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Try a sampling point from photo to PDF. Check the colors, layer details and printed fields against the sheet you would fill by hand.
        Tell us what matched, what needs changing and which device you used.
      </p>
      <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        {["Can you get a useful reading from your photo?", "Does assigning it to a layer avoid retyping the color?", "Do saved records reopen correctly?", "Does the PDF match the observations you entered?"].map((question) => (
          <li key={question} className="flex items-start gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{question}</li>
        ))}
      </ul>
      <div className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold">
          Your decision
          <select value={decision} onChange={(e) => { setDecision(e.target.value); setFeedback(""); setMessage(null) }} className="min-h-11 w-full rounded-lg border border-input bg-background px-3 font-normal focus-visible:outline-2 focus-visible:outline-ring">
            <option value="">Choose a decision</option>
            <option>Ready for a field trial</option>
            <option>Changes needed before a field trial</option>
            <option>I have questions</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Notes, device and changes requested
          <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setFeedback(""); setMessage(null) }} rows={4} maxLength={4000} placeholder="For example: On my iPhone, the layer color reached the form correctly, but..." className="w-full resize-y rounded-lg border border-input bg-background p-3 font-normal leading-relaxed focus-visible:outline-2 focus-visible:outline-ring" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={!decision} onClick={() => void prepare()} className="min-h-11"><Clipboard aria-hidden="true" />Copy review to send</Button>
          <p className="text-xs text-muted-foreground">Nothing is submitted or sent from this page.</p>
        </div>
        {message && <p role="status" className="text-sm leading-relaxed">{message}</p>}
        {feedback && <label className="grid gap-2 text-sm font-semibold">Prepared review<textarea ref={output} readOnly value={feedback} rows={7} onFocus={() => output.current?.select()} className="w-full resize-y rounded-lg border border-input bg-background p-3 font-mono text-xs leading-relaxed focus-visible:outline-2 focus-visible:outline-ring" /></label>}
        <p className="text-xs leading-relaxed text-muted-foreground">For an invited review, reply in the same message thread that sent you the build link. Your feedback can then reach the person making the changes. A field-trial decision does not certify soil accuracy or make a wetland determination.</p>
      </div>
    </section>
  )
}

export function ProjectGuide() {
  React.useEffect(() => { window.scrollTo({ top: 0 }) }, [])

  return (
    <div className="mx-auto min-h-svh w-full max-w-5xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6" data-testid="project-guide">
      <header className="border-b border-border pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="mb-4 font-heading text-lg font-bold tracking-tight">Munsell Soil Reader</p>
        <ProjectNavigation page="guide" />
      </header>
      <main className="grid gap-10 py-8 sm:gap-14 sm:py-12">
        <section aria-labelledby="guide-title" className="grid items-end gap-6 md:grid-cols-[minmax(0,1fr)_15rem]">
          <div>
            <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">From fieldwork to the form</p>
            <h1 id="guide-title" className="mt-3 max-w-2xl font-heading text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">Read the soil.<br />Carry it onto the paperwork.</h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">A field tool for wetland delineation: photograph soil, record the sampling point, review the evidence and fill the official USACE forms from the same saved record.</p>
          </div>
          <div className="grid gap-3 border-l-2 border-foreground pl-4 text-sm leading-relaxed">
            <p>One sampling point.<br /><strong>One connected field record.</strong></p>
            <p className="text-muted-foreground">Use it in your browser or install it to your phone's home screen. The core field tools work offline after setup.</p>
          </div>
        </section>

        <section aria-labelledby="workflow-title">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h2 id="workflow-title" className="font-heading text-2xl font-bold">How the work flows</h2><span className="font-mono text-xs text-muted-foreground">PROJECT / SAMPLING POINT / LAYER</span></div>
          <ol className="grid border-t border-border sm:grid-cols-2">
            {STEPS.map(([title, text], i) => <li key={title} className="flex gap-4 border-b border-border py-5 sm:pr-6"><span className="font-mono text-sm text-muted-foreground" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><div><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></div></li>)}
          </ol>
          <p className="mt-4 text-sm leading-relaxed"><strong>What the photo supplies:</strong> soil-color readings. You still record depths, texture, plant cover and water observations, and confirm the conclusions that go on the form.</p>
        </section>

        <section id="frame" aria-labelledby="frame-title" className="grid gap-5 rounded-2xl border border-border bg-card p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_15rem]">
          <div>
            <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">The printable frame</p>
            <h2 id="frame-title" className="mt-2 font-heading text-2xl font-bold">The model is already designed.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">The frame is a reference Card of its own: a window for the soil, gray and soil-color patches, and a marker at each corner. It is designed to replace the book or ColorChecker in the field. The app already uses the prototype's layout to find its markers and place its reference patches in the photo.</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">The printable model and the app's frame support exist. Before a real frame can give corrected readings, its print batch needs measured patch colors. The app refuses an unmeasured batch rather than treating intended filament colors as measurements.</p>
          </div>
          <dl className="grid content-start gap-4 border-t border-border pt-4 text-sm md:border-t-0 md:border-l md:pt-0 md:pl-5">
            <div><dt className="font-semibold">Frame model</dt><dd className="mt-1 text-muted-foreground">Prototype 1 exists.</dd></div>
            <div><dt className="font-semibold">App support</dt><dd className="mt-1 text-muted-foreground">Marker detection and frame geometry are implemented.</dd></div>
            <div><dt className="font-semibold">Before field use</dt><dd className="mt-1 text-muted-foreground">Measure the batch's patch colors and complete the real-soil checks.</dd></div>
          </dl>
        </section>

        <section aria-labelledby="progress-title" className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Available in this version</p>
            <h2 id="progress-title" className="mt-2 font-heading text-2xl font-bold">The working foundation</h2>
            <ul className="mt-5 grid gap-3 text-sm leading-relaxed">
              {["Photo readings with reference-card correction and quality warnings.", "Projects, sampling points and soil layers saved on this device.", "Assign a reading to a layer as its matrix or redox color.", "Record vegetation and hydrology; review supported soil indicators.", "Preview and export Northcentral and Northeast USACE PDFs; export color readings as CSV."].map((text) => <li key={text} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>{text}</span></li>)}
            </ul>
            <p className="mt-5 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">Real-soil accuracy and a complete field-form comparison still need field acceptance. Saved browser data should be exported; clearing site storage can remove it.</p>
          </div>
          <div>
            <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Still being finished</p>
            <h2 className="mt-2 font-heading text-2xl font-bold">What comes next</h2>
            <ul className="mt-4 divide-y divide-border border-t border-border">
              {NEXT.map(([title, text, issue, surface]) => <li key={title} className="py-3"><a href={`https://github.com/jonboy648/munsell-soil-reader/${surface}/${issue}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-2 text-sm font-semibold underline decoration-border underline-offset-4 hover:decoration-foreground">{title}<ArrowRight className="size-3.5" aria-hidden="true" /></a><p className="text-sm leading-relaxed text-muted-foreground">{text}</p></li>)}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Progress reviewed <time dateTime={GUIDE_DATE}>October 20, 2026</time>. This is a dated snapshot; linked development records show later changes.</p>
          </div>
        </section>

        <ReviewWorksheet />

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5 text-sm">
          <p className="flex items-center gap-2 text-muted-foreground"><FileText className="size-4" aria-hidden="true" />Your observations. Your confirmed form.</p>
          <a href={hrefOf("reader")} className={buttonVariants({ variant: "outline", className: "min-h-11" })}>Open the soil reader<ArrowRight aria-hidden="true" /></a>
        </footer>
      </main>
    </div>
  )
}
