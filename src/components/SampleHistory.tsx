import * as React from "react"
import { ProjectNavigation } from "./ProjectGuide"
import { ReadingFeedback } from "./ReadingFeedback"
import { ReadingBookPage } from "./ReadingBookPage"
import { CardCheckBadge } from "./CardCheckBadge"
import { QualityWarnings } from "./QualityWarnings"
import { listSamples, watchLog } from "@/lib/logStore"
import { listProjects } from "@/lib/projectStore"
import { listReviewedReadings, watchFeedback } from "@/lib/readingFeedback"
import { sampleHistory, type HistoryGroup } from "@/lib/sampleHistory"
import { shownReading } from "@/lib/verdict"

export function SampleHistory() {
  const [groups, setGroups] = React.useState<HistoryGroup[]>([])
  const [selected, setSelected] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [problem, setProblem] = React.useState("")
  const [feedbackProblem, setFeedbackProblem] = React.useState("")
  React.useEffect(() => {
    let active = true
    let generation = 0
    const refresh = async () => {
      const request = ++generation
      try {
        const [projects, samples, reviews] = await Promise.allSettled([listProjects(), listSamples(), listReviewedReadings()])
        if (projects.status === "rejected" || samples.status === "rejected") throw new Error("Log unavailable")
        if (active && request === generation) {
          setGroups(sampleHistory(projects.value, samples.value, reviews.status === "fulfilled" ? reviews.value : []))
          setProblem("")
          setFeedbackProblem(reviews.status === "rejected" ? "Feedback history is unavailable. Your original readings are still shown." : "")
        }
      } catch { if (active && request === generation) setProblem("History could not be read on this device. Reload to try again; no readings were changed.") }
      finally { if (active && request === generation) setLoading(false) }
    }
    void refresh()
    const stopLog = watchLog(() => void refresh())
    const stopFeedback = watchFeedback(() => void refresh())
    return () => { active = false; stopLog(); stopFeedback() }
  }, [])
  const group = groups.find((g) => g.id === selected) ?? groups[0]
  return <div className="mx-auto min-h-svh max-w-5xl px-4 pb-12 sm:px-6">
    <header className="border-b border-border pt-6"><p className="mb-4 font-heading text-lg font-bold">Munsell Soil Reader</p><ProjectNavigation page="history" /></header>
    <main className="py-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Field records</p>
      <h1 className="mt-2 font-heading text-3xl font-bold">Sample History</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Revisit saved readings and leave quick feedback. Measurements stay as recorded. History and feedback live only in this browser on this device; they are not sent to Spark.</p>
      {feedbackProblem && <p role="alert" className="mt-4 text-sm">{feedbackProblem}</p>}
      {loading ? <p role="status" className="mt-6">Loading saved readings…</p> : problem ? <p role="alert" className="mt-6">{problem}</p> : groups.length === 0 ? <div className="mt-6 rounded-xl border border-border p-6"><h2 className="font-semibold">No saved samples yet</h2><p className="mt-2 text-sm">Save a reading to the Log, assign one to a project layer, or leave quick feedback after a measurement. It will appear here.</p><a href="#" className="mt-4 inline-block underline">Take a reading</a></div> : <>
        <label className="mt-6 block text-sm font-semibold">Sample point or Log sample
          <select value={group?.id ?? ""} onChange={(e) => setSelected(e.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base">{groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select>
        </label>
        {group && <section aria-label={group.label} className="mt-6">
          <h2 className="font-heading text-xl font-bold">{group.label}</h2>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{group.detail}</p>
          <p className="mt-2 text-sm">{group.readings.length} saved photo {group.readings.length === 1 ? "reading" : "readings"} · newest first</p>
          {group.readings.length === 0 && <div className="mt-6"><p>No photo readings saved for this point yet.</p><p className="text-sm text-muted-foreground">Typed layer colors remain in Projects.</p></div>}
          <div className="mt-4 grid gap-4">{group.readings.map(({ key, saved, context }, i) => {
            const { main, verdict } = shownReading(saved.reading, saved.cardCheck)
            const at = saved.measuredAt ?? saved.savedAt
            return <article aria-label={`Reading ${i + 1}: ${main.chip.notation}`} key={`${group.id}:${key}`} className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p>{context}</p><p className="text-muted-foreground">{saved.measuredAt ? "Measured" : "Saved"}{" "}<time dateTime={new Date(at).toISOString()}>{new Date(at).toLocaleString()}</time></p></div>
              <div className="my-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-2xl font-semibold">{main.chip.notation}</p><p>{main.chip.name}</p><ReadingBookPage chip={main.chip} /></div><CardCheckBadge verdict={verdict} cardCheck={saved.cardCheck} /></div>
              <p className="text-sm text-muted-foreground">Calculated estimate: <span className="font-mono">{main.exact}</span> — not a printed chip. Use the matched soil-book chip above for the form, after checking it.</p>
              <p className="mt-2 text-sm">Raw: <span className="font-mono">{saved.reading.raw.chip.notation}</span>{saved.reading.corrected && <> · Corrected: <span className="font-mono">{saved.reading.corrected.chip.notation}</span>{verdict === "failed" ? " (not trusted)" : ""}</>}</p>
              <QualityWarnings warnings={saved.quality} />
              <div className="mt-4"><ReadingFeedback reading={saved} /></div>
            </article>
          })}</div>
        </section>}
      </>}
    </main>
  </div>
}
