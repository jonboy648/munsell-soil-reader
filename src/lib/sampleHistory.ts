import type { Project } from "@/delineation/model"
import type { Sample, SavedReading } from "./log"
import { depthText } from "./log"
import type { ReviewedReading } from "./readingFeedback"

export interface HistoryGroup {
  id: string
  label: string
  detail: string
  readings: { key: string; saved: SavedReading; context: string }[]
}

/** A read-only index of saved measurements; typed layer colors are not invented camera readings. */
export function sampleHistory(projects: Project[], samples: Sample[], reviews: ReviewedReading[]): HistoryGroup[] {
  const groups: HistoryGroup[] = projects.flatMap((project) => project.points.map((point) => ({
    id: `point:${project.id}:${point.id}`,
    label: `${project.name} / ${point.name}`,
    detail: project.header.date ? `Project sampling date: ${project.header.date}` : "Project sampling date not recorded",
    readings: point.layers.flatMap((layer) => [
      ...(layer.matrix?.reading ? [{ key: `${layer.id}:matrix:${layer.matrix.reading.id}`, saved: layer.matrix.reading, context: `${layer.top}–${layer.bottom} in · Matrix · ${layer.matrix.percent}%` }] : []),
      ...layer.redox.flatMap((color) => color.reading ? [{ key: color.reading.id, saved: color.reading, context: `${layer.top}–${layer.bottom} in · Redox · ${color.percent}%` }] : []),
    ]),
  })))
  groups.push(...samples.map((sample) => ({
    id: `sample:${sample.id}`, label: `Log / ${sample.name}`,
    detail: [depthText(sample), sample.condition, sample.notes].filter(Boolean).join(" · "),
    readings: sample.readings.map((saved) => ({ key: saved.id, saved, context: "Saved to Log" })),
  })))
  const linked = new Set(groups.flatMap((group) => group.readings.map(({ saved }) => saved.id)))
  const unassigned = reviews.filter(({ id }) => !linked.has(id))
  if (unassigned.length) groups.push({ id: "feedback-only", label: "Readings with feedback / Not linked to a saved point", detail: "Snapshots kept with feedback, including readings no longer in the Log. Photos are not saved.", readings: unassigned.map(({ reading }) => ({ key: reading.id, saved: reading, context: "Feedback snapshot" })) })
  return groups.map((group) => {
    // One physical Reading can be assigned in more than one place. Show its feedback once,
    // retaining all layer contexts and a stable identity when other assignments are removed.
    const unique = new Map<string, { saved: SavedReading; contexts: Set<string> }>()
    for (const { saved, context } of group.readings) {
      const previous = unique.get(saved.id)
      if (previous) previous.contexts.add(context)
      else unique.set(saved.id, { saved, contexts: new Set([context]) })
    }
    const readings = [...unique].map(([key, { saved, contexts }]) => ({ key, saved, context: [...contexts].join("; ") }))
    return { ...group, readings: readings.sort((a, b) => (b.saved.measuredAt ?? b.saved.savedAt) - (a.saved.measuredAt ?? a.saved.savedAt)) }
  })
}
