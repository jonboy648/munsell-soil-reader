// Visual product guide. Screens are actual app captures; review responses are never sent by this page.
import * as React from "react"
import { ArrowRight, Check, ExternalLink, FileText, HardDrive, Smartphone } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { hrefOf } from "@/lib/route"
import { cn } from "@/lib/utils"
import { GuidedReview } from "./guide/GuidedReview"
import { APP_SOURCE, GUIDE_BUILD, GUIDE_DATE, PROGRESS, WORKFLOW } from "./guide/walkthrough"

export function ProjectNavigation({ page }: { page: "reader" | "guide" }) {
  return (
    <nav aria-label="App pages" className="flex gap-1 overflow-x-auto pb-3">
      {([["reader", "Soil reader"], ["guide", "About & progress"]] as const).map(([id, label]) => (
        <a key={id} href={hrefOf(id)} aria-current={page === id ? "page" : undefined} className={cn(
          "flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          page === id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}>{label}</a>
      ))}
    </nav>
  )
}

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: "start" })
const imageOf = (name: string) => "/guide/" + name + ".jpg"

function Walkthrough() {
  const [at, setAt] = React.useState(0)
  const step = WORKFLOW[at]
  return (
    <section id="workflow" aria-labelledby="workflow-title" className="scroll-mt-24">
      <div className="mb-6 max-w-2xl">
        <h2 id="workflow-title" className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">One record, from the field to the form.</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Choose a step to see what you enter, what the app does, and what reaches the document. These are actual app captures, not proposed screens.</p>
      </div>
      <ol aria-label="Choose a workflow step" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WORKFLOW.map((item, i) => <li key={item.title}><button type="button" aria-pressed={at === i} aria-controls="walkthrough-panel" onClick={() => setAt(i)} className={cn(
          "flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          at === i ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
        )}><span className="font-mono text-xs opacity-60" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>{item.title}</button></li>)}
      </ol>
      <div id="walkthrough-panel" className="mt-4 grid overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col p-5 sm:p-8">
          <p className="text-xs text-muted-foreground">Step {at + 1} of {WORKFLOW.length}</p>
          <h3 aria-live="polite" className="mt-3 font-heading text-2xl font-bold tracking-tight sm:text-3xl">{step.heading}</h3>
          <dl className="mt-6 grid gap-5">{[["You enter", step.input], ["The app does", step.app], ["On the document", step.form]].map(([label, description]) => <div key={label}><dt className="text-sm font-semibold">{label}</dt><dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</dd></div>)}</dl>
          <p className="mt-6 border-l-2 border-foreground pl-4 text-sm leading-relaxed">{step.boundary}</p>
          <div className="mt-auto flex justify-between gap-3 pt-6"><Button type="button" variant="outline" disabled={at === 0} onClick={() => setAt((i) => i - 1)} className="min-h-11">Previous step</Button><Button type="button" disabled={at === WORKFLOW.length - 1} onClick={() => setAt((i) => i + 1)} className="min-h-11">Next step<ArrowRight aria-hidden="true" /></Button></div>
        </div>
        <figure className="min-w-0 border-t border-border bg-muted/50 p-3 sm:p-5 lg:border-t-0 lg:border-l">
          <a href={imageOf(step.image)} target="_blank" rel="noopener noreferrer" aria-label={"Open full capture: " + step.title} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <img key={step.image} src={imageOf(step.image)} alt={step.alt} width={860} height={1056} loading="lazy" className="max-h-[34rem] w-full rounded-lg border border-border bg-background object-contain" />
          </a>
          <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">App capture from source {APP_SOURCE}, October 20, 2026. Tap for the full screen. The vegetation worksheets are included in this release.</figcaption>
        </figure>
      </div>
    </section>
  )
}

function JfExample() {
  return (
    <section id="jf1" aria-labelledby="jf1-title" className="scroll-mt-24 border-y border-border py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 id="jf1-title" className="font-heading text-3xl font-bold tracking-tight">Follow JF-1 through the paperwork.</h2><span className="rounded-full border border-foreground px-3 py-1.5 text-xs font-semibold">Worked example / published test record</span></div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <p className="text-sm leading-relaxed text-muted-foreground">JF-1 is the app's published test record, transcribed from a field sheet. The practice photo is separate: no private site photos or coordinates are shown here.</p>
          <div className="rounded-xl border border-border bg-card p-5"><h3 className="font-semibold">The color is entered once.</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">A matrix color such as <strong className="font-mono text-foreground">10YR 2/1</strong> belongs to its layer. The same saved notation fills that layer's profile row on the Soil page. Depth, percentage and texture are recorded separately; a photo does not supply them.</p></div>
          <div className="rounded-xl border border-border bg-card p-5"><h3 className="font-semibold">The plant entries drive the worksheet.</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Total herb cover is <strong className="text-foreground">85%</strong>. Fall panicgrass, <i>Panicum dichotomiflorum</i>, has 50% cover and is the only dominant. The Dominance Test is <strong className="text-foreground">1 of 1 = 100%</strong>.</p><p className="mt-3 text-sm leading-relaxed text-muted-foreground">The index worksheet still calculates <strong className="text-foreground">217 / 85 = 2.55</strong>, but the prevalence test is not needed for this decision because dominance already passes. A suggested Yes still needs your confirmation.</p></div>
          <p className="text-xs leading-relaxed text-muted-foreground">The named, unlisted stiff greenthread counts as UPL. Genus-only plants count in the index when the region's species share a status, under the recorded project decision. Marking a plant "Not identified" changes what counts.</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-5"><h3 className="font-semibold">JF-1 Prevalence Index worksheet</h3><p className="mt-1 text-xs text-muted-foreground">Calculated from the published JF-1 test record, not a new field observation.</p></div>
          <table className="w-full text-left text-sm"><caption className="sr-only">JF-1 cover multiplied by wetland indicator weight, totals and prevalence index.</caption>
            <thead className="bg-muted/60"><tr>{["Status", "Cover", "Weight", "Product"].map((label) => <th key={label} scope="col" className="px-3 py-3 font-semibold sm:px-5">{label}</th>)}</tr></thead>
            <tbody>{[["OBL", "0", "1", "0"], ["FACW", "53", "2", "106"], ["FAC", "18", "3", "54"], ["FACU", "13", "4", "52"], ["UPL", "1", "5", "5"]].map(([status, cover, weight, product]) => <tr key={status} className="border-t border-border"><th scope="row" className="px-3 py-3 font-medium sm:px-5">{status}</th><td className="px-3 py-3 font-mono sm:px-5">{cover}</td><td className="px-3 py-3 font-mono sm:px-5">{weight}</td><td className="px-3 py-3 font-mono sm:px-5">{product}</td></tr>)}</tbody>
            <tfoot className="border-t-2 border-foreground"><tr><th scope="row" className="px-3 py-4 sm:px-5">Totals</th><td className="px-3 py-4 font-mono font-bold sm:px-5">85 (A)</td><td /><td className="px-3 py-4 font-mono font-bold sm:px-5">217 (B)</td></tr></tfoot>
          </table>
          <div className="flex items-center justify-between border-t border-border bg-muted/60 px-5 py-5"><p className="text-sm">Prevalence Index <span className="text-muted-foreground">B / A</span></p><strong className="font-heading text-4xl font-bold">2.55</strong></div>
          <a href={imageOf("form")} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-between gap-2 px-5 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">See the actual rendered form<ExternalLink className="size-4" aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  )
}

export function ProjectGuide() {
  React.useEffect(() => { window.scrollTo({ top: 0 }) }, [])
  return (
    <div className="mx-auto min-h-svh w-full max-w-6xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6" data-testid="project-guide">
      <header className="border-b border-border pt-[max(1.25rem,env(safe-area-inset-top))]"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="font-heading text-lg font-bold tracking-tight">Munsell Soil Reader</p><span className="text-xs text-muted-foreground">Field guide & build review</span></div><ProjectNavigation page="guide" /></header>
      <main className="grid gap-12 py-8 sm:gap-16 sm:py-12">
        <section aria-labelledby="guide-title" className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div><h1 id="guide-title" className="max-w-2xl font-heading text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">Your fieldwork.<br />One connected record.</h1><p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">Turn soil Readings and field observations into reviewed wetland delineation paperwork, without retyping the same colors or doing every worksheet by hand.</p><p className="mt-4 max-w-xl text-sm leading-relaxed">The soil reader is the instrument. The official form is the output. Your observations and professional judgment stay in charge.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Button type="button" onClick={() => jump("workflow")} className="min-h-12">See how it works<ArrowRight aria-hidden="true" /></Button><Button type="button" variant="outline" onClick={() => jump("review")} className="min-h-12">Give your review</Button></div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">{[["jf1", "JF-1 example"], ["progress", "What's ready"], ["field-use", "Phone, offline & storage"]].map(([id, label]) => <button type="button" key={id} onClick={() => jump(id)} className="min-h-9 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">{label}</button>)}</div>
          </div>
          <figure className="rounded-2xl border border-border bg-muted/50 p-4 sm:p-6"><a href={imageOf("form")} target="_blank" rel="noopener noreferrer" aria-label="Open the full JF-1 Vegetation form capture" className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><img src={imageOf("form")} alt="Actual official NCNE Vegetation form populated with the JF-1 worksheet." width={860} height={1113} className="max-h-96 w-full rounded-md border border-border bg-white object-contain" /></a><figcaption className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><FileText className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Actual app output, captured from source {APP_SOURCE}. Unconfirmed conclusions are deliberately blank. Tap for the full page.</figcaption></figure>
        </section>
        <Walkthrough />
        <JfExample />
        <section id="field-use" aria-labelledby="field-use-title" className="scroll-mt-24">
          <h2 id="field-use-title" className="font-heading text-3xl font-bold tracking-tight">Built for the phone. Honest about its limits.</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            <article className="border-t-2 border-foreground pt-4"><Smartphone aria-hidden="true" className="size-5" /><h3 className="mt-3 font-semibold">Browser or home screen</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">It is the same installable web app, not a second native app. Use your browser's Install or Add to Home Screen option where available. No account or cloud sync is required.</p></article>
            <article className="border-t-2 border-foreground pt-4"><Check aria-hidden="true" className="size-5" /><h3 className="mt-3 font-semibold">Prepare before losing signal</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Visit online first and wait for "Ready to work offline." Core Readings, saved field entry and on-device PDFs work from cached files. Browser reliability work and real-phone acceptance remain below. Future online lookups are separate.</p></article>
            <article className="border-t-2 border-foreground pt-4"><HardDrive aria-hidden="true" className="size-5" /><h3 className="mt-3 font-semibold">Local does not mean backed up</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">The Log and review draft live in this browser on this device. Clearing site data can erase them. Retain downloaded PDFs and CSVs; those are not a demonstrated full editable-project backup.</p></article>
          </div>
          <div id="frame" className="mt-7 grid gap-4 rounded-xl border border-border bg-card p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_14rem]"><div><h3 className="font-heading text-xl font-bold">The frame model already exists.</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Prototype 1 has a soil window, gray and soil-color patches, and four corner markers. The app implements its geometry and marker detection. A real print batch needs measured patch colors before it can provide corrected Readings; an unmeasured batch is refused. Intended filament colors are not measurements.</p></div><p className="border-l-2 border-foreground pl-4 text-sm leading-relaxed"><strong>Still required:</strong><br />Measure a real batch, then validate it against real soils. The demonstration frame uses simulated reference colors.</p></div>
        </section>
        <section id="progress" aria-labelledby="progress-title" className="scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="progress-title" className="font-heading text-3xl font-bold tracking-tight">What's ready. What's not.</h2><p className="text-xs text-muted-foreground">Snapshot: <time dateTime={GUIDE_DATE}>October 21, 2026</time></p></div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">This release includes the vegetation worksheets shown above. Unreleased work and field-validation requirements are separated below; development records may change after this snapshot.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">{PROGRESS.map((group, i) => <article key={group.title} className="rounded-xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center gap-3"><span aria-hidden="true" className={cn("size-2.5 rounded-full", i === 0 ? "bg-foreground" : i === 1 ? "border-2 border-foreground" : "border border-muted-foreground")} /><h3 className="font-heading text-xl font-bold">{group.title}</h3></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{group.description}</p><ul className="mt-5 grid gap-4">{group.items.map((item) => <li key={item.title}>{"href" in item ? <a href={"https://github.com/jonboy648/munsell-soil-reader/" + item.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-2 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">{item.title}<ExternalLink className="size-3.5" aria-hidden="true" /></a> : <h4 className="text-sm font-semibold">{item.title}</h4>}<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.text}</p></li>)}</ul></article>)}</div>
        </section>
        <GuidedReview />
        <footer className="grid gap-4 border-t border-border pt-5 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto]"><div><p className="font-semibold text-foreground">Your observations. Your confirmed form.</p><p className="mt-2 break-all">Guide build: {GUIDE_BUILD} / screen-capture source: {APP_SOURCE}</p><p className="mt-1 leading-relaxed">The guide does not certify soil accuracy or decide a wetland boundary. Review export identifies the build and page you reviewed.</p></div><a href={hrefOf("reader")} className={buttonVariants({ variant: "outline", className: "min-h-11 self-start" })}>Open the soil reader<ArrowRight aria-hidden="true" /></a></footer>
      </main>
    </div>
  )
}
