// The Soil page on screen, and as a PDF. The preview draws the official page's image and the same
// list of placed values the PDF is made from, so what is shown is what the PDF holds.
import * as React from "react"
import { Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Form } from "@/delineation/formFor"
import type { Project, SamplingPoint } from "@/delineation/model"
import { soilPagePdf } from "@/delineation/pdf"
import { regionOf } from "@/delineation/regions"
import { soilPageAssets } from "@/delineation/regions/assets"
import { soilPlacements } from "@/delineation/soilPage"
import { canShareFile, downloadBlob, shareFile } from "@/lib/download"

interface Props {
  project: Project
  point: SamplingPoint
  form: Form
}

const slug = (text: string) => text.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"

export function SoilPagePreview({ project, point, form }: Props) {
  const { size } = regionOf(project.region).soil
  const assets = soilPageAssets[project.region]
  const placements = React.useMemo(() => soilPlacements(project, form), [project, form])
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const filename = `soil-page-${slug(project.name)}-${slug(point.name)}.pdf`

  const make = async (then: (blob: Blob) => Promise<void> | void) => {
    setBusy(true)
    setProblem(null)
    try {
      const blank = await (await fetch(assets.pdf)).arrayBuffer()
      const bytes = await soilPagePdf(blank, project, point, form)
      await then(new Blob([bytes.slice().buffer], { type: "application/pdf" }))
    } catch {
      setProblem("The PDF could not be made on this device. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Soil page" className="grid gap-3">
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="img"
        aria-label={`Soil page for ${point.name}`}
        data-testid="soil-preview"
        className="w-full rounded-md border border-border bg-white"
      >
        <image href={assets.image} width={size.width} height={size.height} />
        {placements.map((p) => (
          <text
            key={p.id}
            data-testid="preview-text"
            data-field={p.id}
            x={p.x}
            y={p.baseline}
            fontSize={p.size}
            fontFamily="Helvetica, Arial, sans-serif"
            fill="#000"
          >
            {p.text}
          </text>
        ))}
      </svg>
      <div className="flex gap-2">
        <Button className="h-12 flex-1 text-base" disabled={busy} onClick={() => make((blob) => downloadBlob(blob, filename))}>
          <Download /> {busy ? "Making the PDF..." : "Download PDF"}
        </Button>
        {canShareFile("application/pdf") && (
          <Button
            variant="outline"
            className="h-12 flex-1 text-base"
            disabled={busy}
            onClick={() => make((blob) => shareFile(blob, filename, `${project.name}, ${point.name}`))}
          >
            <Share2 /> Share PDF
          </Button>
        )}
      </div>
      {problem && (
        <p role="alert" className="rounded-md border-2 border-foreground p-3 text-sm font-medium">
          {problem}
        </p>
      )}
    </section>
  )
}
