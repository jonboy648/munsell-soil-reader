// Measurement mode's results: the shots taken so far, the mean of each swatch across them, and
// the batch file to download. The numbers are CIELAB under D50.
import { Download, X } from "lucide-react"
import { BATCH_METHOD_CAMERA, batchRows, formatBatchCsv, swatchSlot, type MeasureSummary } from "@/engine"
import { CardCheckBadge } from "@/components/CardCheckBadge"
import { Button } from "@/components/ui/button"
import type { Shot } from "@/lib/measureSession"

const fmt = (n: number, places = 1) => n.toFixed(places)

/** Today's date as the batch file writes it: YYYY-MM-DD, local time. */
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Hands the browser a file to save. */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

interface Props {
  shots: Shot[]
  summary: MeasureSummary
  onDrop: (index: number) => void
}

export function MeasureResults({ shots, summary, onDrop }: Props) {
  const date = today()
  const exportCsv = () => download(`batch-${date}.csv`, formatBatchCsv(batchRows(summary, date)))

  return (
    <section aria-label="Measured shots" className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Shots ({shots.length})
      </h2>
      {shots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None yet. Mark the ColorChecker and the swatches on a Photo, then tap Add shot.
        </p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2" data-testid="shot-list">
          {shots.map((shot, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-sm">
              <span className="font-mono font-semibold">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {shot.name}, {shot.swatches.length} swatches
              </span>
              <CardCheckBadge verdict={shot.cardCheck.verdict} cardCheck={shot.cardCheck} />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove shot ${i + 1}`}
                onClick={() => onDrop(i)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {summary.excluded.length > 0 && (
        <p className="rounded-sm border border-foreground/40 border-l-4 border-l-foreground py-2 pr-3 pl-3 text-sm" data-testid="excluded">
          <b className="font-semibold">Left out of the means:</b>{" "}
          {summary.excluded.map((e) => `shot ${e.shot} (Card check ${shots[e.shot - 1].cardCheck.verdict}, ${fmt(e.meanDE)})`).join("; ")}.
        </p>
      )}

      {summary.swatches.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm" data-testid="summary">
            <caption className="sr-only">Mean CIELAB (D50) of each swatch across the shots used</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1 pr-2 font-medium">Swatch</th>
                <th scope="col" className="py-1 pr-2 font-medium">Slot</th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">L</th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">a</th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">b</th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">sd L, a, b</th>
                <th scope="col" className="py-1 text-right font-medium">n</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {summary.swatches.map(({ id, lab, sd, n }) => (
                <tr key={id} className="border-t border-border" data-swatch={id}>
                  <th scope="row" className="py-1.5 pr-2 text-left font-medium">{id}</th>
                  <td className="py-1.5 pr-2">{swatchSlot(id)}</td>
                  {lab.map((v, c) => (
                    <td key={c} className="py-1.5 pr-2 text-right">{fmt(v)}</td>
                  ))}
                  <td className="py-1.5 pr-2 text-right text-muted-foreground">
                    {sd ? sd.map((v) => fmt(v, 2)).join(" ") : "-"}
                  </td>
                  <td className="py-1.5 text-right">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button size="lg" className="h-11" disabled={summary.swatches.length === 0} onClick={exportCsv} data-testid="export-csv">
        <Download /> Export batch CSV
      </Button>
      <p className="text-xs text-muted-foreground">
        One row per frame slot, CIELAB under D50, method "{BATCH_METHOD_CAMERA}". Name the file for its
        print batch before the frame card reads it.
      </p>
    </section>
  )
}
