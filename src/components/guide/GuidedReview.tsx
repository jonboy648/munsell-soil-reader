import * as React from "react"
import { ArrowLeft, ArrowRight, Check, Clipboard, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Confirm } from "@/components/Confirm"
import { cn } from "@/lib/utils"
import { APP_SOURCE, GUIDE_BUILD, GUIDE_DATE } from "./walkthrough"

interface Question { id: string; title: string; help: string; options: readonly string[] }
const QUESTIONS: readonly Question[] = [
  { id: "workflow", title: "Does this follow the way you work?", help: "Think about the order of observations and moving between sampling points.", options: ["Yes, it matches", "Mostly, with changes", "No, the flow needs work", "Not tried yet"] },
  { id: "missing", title: "Can you record the information you need?", help: "Look at the project, layers, plants and water observations. Name any missing field below.", options: ["The fields I need are there", "Some information is missing", "I am not sure yet", "Not tried yet"] },
  { id: "usability", title: "How does it feel on your field device?", help: "Try a photo, a Reading, a saved layer, and reopening the point.", options: ["Easy to use", "Usable, but gets in the way", "Hard to use", "Not tried yet"] },
  { id: "documents", title: "Does the PDF match what you entered?", help: "Compare recorded values, printed fields and unconfirmed choices. This is not a soil-accuracy certification.", options: ["The fields match", "I found differences", "I could not complete or export it", "Not tried yet"] },
  { id: "priority", title: "What should we improve first?", help: "Pick the change that would help most. Use the comment for another priority or specifics.", options: ["Photos and Readings", "Soil layers", "Plants and calculations", "Hydrology and indicators", "Forms and export", "Offline use and installation", "Something else", "No priority yet"] },
]
const DECISIONS = ["Ready for field trial", "Changes needed", "Questions first", "Not reviewed yet"] as const
const STORAGE_KEY = "munsell-soil-reader:guide-review:v2"
interface Draft { reviewer: string; device: string; answers: Record<string, string>; comments: Record<string, string> }
const emptyDraft = (): Draft => ({ reviewer: "", device: "", answers: {}, comments: {} })
const text = (value: unknown, limit: number): string => typeof value === "string" ? value.slice(0, limit) : ""

function readDraft(): Draft {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
    if (!saved || typeof saved !== "object") return emptyDraft()
    return {
      reviewer: text(saved.reviewer, 100), device: text(saved.device, 200),
      answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, q.options.includes(saved.answers?.[q.id]) ? saved.answers[q.id] : ""])),
      comments: Object.fromEntries(QUESTIONS.map((q) => [q.id, text(saved.comments?.[q.id], 1500)])),
    }
  } catch { return emptyDraft() }
}

export function GuidedReview() {
  const [draft, setDraft] = React.useState<Draft>(readDraft)
  const [step, setStep] = React.useState(0)
  // A draft never preselects approval: the reviewer must deliberately decide on every visit.
  const [decision, setDecision] = React.useState("")
  const [saved, setSaved] = React.useState<boolean | null>(null)
  const [notice, setNotice] = React.useState("")
  const [clearing, setClearing] = React.useState(false)
  const prepared = React.useRef<HTMLTextAreaElement>(null)
  const question = QUESTIONS[step]
  const answered = QUESTIONS.filter((q) => draft.answers[q.id]).length

  React.useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); setSaved(true) }
    catch { setSaved(false) }
  }, [draft])

  const pageUrl = new URL(typeof window === "undefined" ? "https://soil.joncackler.com/#guide" : window.location.href)
  pageUrl.hash = "guide"
  const review = [
    "Munsell Soil Reader - guided review", `Build: ${GUIDE_BUILD}`, `Screen-capture source: ${APP_SOURCE} (capture provenance; guide build above identifies this review)`,
    `Guide snapshot: ${GUIDE_DATE}`, `Page: ${pageUrl.href}`, `Reviewer: ${draft.reviewer.trim() || "Not supplied"}`,
    `Device / browser: ${draft.device.trim() || "Not supplied"}`, "",
    ...QUESTIONS.flatMap((q) => [q.title, `Answer: ${draft.answers[q.id] || "Not answered"}`, `Comment: ${draft.comments[q.id]?.trim() || "None"}`, ""]),
    `Decision: ${decision || "Not selected"}`, "This is not a regulatory determination or certification of soil accuracy.",
  ].join("\n")

  const change = (kind: "answers" | "comments", id: string, value: string) => {
    setDraft((old) => ({ ...old, [kind]: { ...old[kind], [id]: value } })); setNotice("")
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(review); setNotice("Copied. Paste it into your invitation's message thread and send it there. Nothing was sent by this page.") }
    catch { prepared.current?.focus(); prepared.current?.select(); setNotice("Automatic copying is unavailable. Copy the selected review below, or download the text file.") }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([review], { type: "text/plain;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url; link.download = `${GUIDE_BUILD}-feedback.txt`
    document.body.append(link); link.click(); link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice("Review prepared as a text download. Attach or paste it into your invitation's message thread; downloading does not send it.")
  }

  return (
    <section id="review" aria-labelledby="review-title" className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border p-5 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 id="review-title" className="font-heading text-3xl font-bold tracking-tight">Your field review</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Five short questions, then your decision. Try what you can; choose "Not tried yet" for the rest.</p></div><span className="rounded-full border border-border px-3 py-1.5 text-xs">{answered} of {QUESTIONS.length} answered</span></div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">{saved === false ? "This browser cannot save the draft. Keep this tab open until you copy or download it." : "Draft answers stay on this device. Your final decision is not saved or preselected."} Nothing is sent from this page. Do not include client details, passwords or precise site locations.</p></div>
      <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Review questions" className="flex gap-1 overflow-x-auto border-b border-border p-3 md:flex-col md:border-r md:border-b-0">{[...QUESTIONS.map((q) => q.title), "Review & decision"].map((label, i) => <button key={label} type="button" onClick={() => { setStep(i); setNotice("") }} aria-current={step === i ? "step" : undefined} className={cn("flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:shrink", step === i ? "bg-foreground text-background" : "hover:bg-muted")}><span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs" aria-hidden="true">{i < QUESTIONS.length && draft.answers[QUESTIONS[i].id] ? <Check className="size-3.5" /> : i + 1}</span><span>{i < QUESTIONS.length ? ["Workflow", "Missing information", "Field usability", "Documents", "Priority"][i] : label}</span></button>)}</nav>
        <div className="min-w-0 p-5 sm:p-8">{question ? <div key={question.id} className="grid gap-5">
          <fieldset className="min-w-0"><legend className="font-heading text-xl font-bold sm:text-2xl">{question.title}</legend><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{question.help}</p><div className="mt-5 grid gap-2 sm:grid-cols-2">{question.options.map((option, i) => <label key={option} className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring", draft.answers[question.id] === option ? "border-foreground bg-muted font-semibold" : "border-border hover:bg-muted/60")}><input type="radio" name={`review-${question.id}`} id={`review-${question.id}-${i}`} checked={draft.answers[question.id] === option} onChange={() => change("answers", question.id, option)} className="size-4 shrink-0 accent-[var(--foreground)]" /><span>{option}</span></label>)}</div></fieldset>
          <label className="grid gap-2 text-sm font-semibold">Anything to add?<span className="font-normal text-muted-foreground">Optional. A specific example is most useful.</span><textarea rows={3} maxLength={1500} value={draft.comments[question.id] ?? ""} onChange={(e) => change("comments", question.id, e.target.value)} className="w-full resize-y rounded-lg border border-input bg-background p-3 font-normal leading-relaxed focus-visible:outline-2 focus-visible:outline-ring" /></label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"><Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((i) => i - 1)} className="min-h-11"><ArrowLeft aria-hidden="true" />Back</Button><div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" onClick={() => setStep((i) => i + 1)} className="min-h-11">Skip for now</Button><Button type="button" disabled={!draft.answers[question.id]} onClick={() => setStep((i) => i + 1)} className="min-h-11">{step === QUESTIONS.length - 1 ? "Review my answers" : "Continue"}<ArrowRight aria-hidden="true" /></Button></div></div>
        </div> : <div className="grid gap-6">
          <div><h3 className="font-heading text-2xl font-bold">Check your answers. Make your call.</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">A field-trial decision is not approval of a regulatory conclusion, proof of color accuracy, or permission to publish.</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Name or initials<span className="text-xs font-normal text-muted-foreground">Optional</span><input maxLength={100} autoComplete="off" value={draft.reviewer} onChange={(e) => setDraft((d) => ({ ...d, reviewer: e.target.value }))} className="h-11 min-w-0 rounded-lg border border-input bg-background px-3 font-normal focus-visible:outline-2 focus-visible:outline-ring" /></label><label className="grid gap-2 text-sm font-semibold">Device and browser<span className="text-xs font-normal text-muted-foreground">For example: iPhone, Safari</span><input maxLength={200} autoComplete="off" value={draft.device} onChange={(e) => setDraft((d) => ({ ...d, device: e.target.value }))} className="h-11 min-w-0 rounded-lg border border-input bg-background px-3 font-normal focus-visible:outline-2 focus-visible:outline-ring" /></label></div>
          <dl className="divide-y divide-border border-y border-border">{QUESTIONS.map((q, i) => <div key={q.id} className="py-3"><dt className="text-sm font-semibold">{q.title}</dt><dd className="mt-1 text-sm text-muted-foreground">{draft.answers[q.id] || "Not answered"}{draft.comments[q.id] && <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{draft.comments[q.id]}</p>}<button type="button" onClick={() => setStep(i)} className="mt-1 min-h-9 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">Edit answer</button></dd></div>)}</dl>
          <fieldset><legend className="font-heading text-xl font-bold">Your decision</legend><p className="mt-1 text-sm text-muted-foreground">Choose deliberately. Nothing is selected for you.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{DECISIONS.map((option) => <label key={option} className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring", decision === option ? "border-foreground bg-muted font-semibold" : "border-border")}><input type="radio" name="review-decision" checked={decision === option} onChange={() => { setDecision(option); setNotice("") }} className="size-4 accent-[var(--foreground)]" />{option}</label>)}</div></fieldset>
          <label className="grid gap-2 text-sm font-semibold">Your complete review<textarea ref={prepared} aria-label="Your complete review" readOnly value={review} rows={10} className="w-full resize-y rounded-lg border border-input bg-background p-3 font-mono text-xs font-normal leading-relaxed focus-visible:outline-2 focus-visible:outline-ring" /></label>
          <div className="flex flex-wrap gap-2"><Button type="button" disabled={!decision} onClick={() => void copy()} className="min-h-11"><Clipboard aria-hidden="true" />Copy review to send</Button><Button type="button" variant="outline" disabled={!decision} onClick={download} className="min-h-11"><Download aria-hidden="true" />Download review (.txt)</Button></div>
          {notice && <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm leading-relaxed">{notice}</p>}<p className="text-sm leading-relaxed text-muted-foreground">Paste or attach the review in the message thread that sent the invitation. That agreed conversation routes replies to Spark. This page has no messaging connection; copying and downloading do not send anything.</p>
        </div>}<div className="mt-6 border-t border-border pt-4">{clearing ? <Confirm verb="Remove" what="this review draft" onYes={() => { setDraft(emptyDraft()); setDecision(""); setStep(0); setNotice(""); setClearing(false) }} onNo={() => setClearing(false)} /> : <button type="button" onClick={() => setClearing(true)} className="min-h-11 text-xs text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">Clear this review draft</button>}</div></div>
      </div>
    </section>
  )
}
