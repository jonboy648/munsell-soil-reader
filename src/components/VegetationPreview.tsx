// The Vegetation pages on screen, and as a PDF. The preview draws each official page's image and the
// same list of placed values the PDF is made from, so what is shown is what the PDF holds.
import * as React from "react"
import { Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Form } from "@/delineation/formFor"
import type { Project, SamplingPoint } from "@/delineation/model"
import { regionOf } from "@/delineation/regions"
import { vegetationPageAssets } from "@/delineation/regions/assets"
import type { Placement } from "@/delineation/soilPage"
import { vegetationPlacements } from "@/delineation/vegetation/vegetationPage"
import { canShareFile, downloadBlob, shareFile } from "@/lib/download"

interface Props {
  project: Project
  point: SamplingPoint
  form: Form
}

const slug = (text: string) => text.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"

function Page({ title, image, size, placements, testId }: { title: string; image: string; size: { width: number; height: number }; placements: Placement[]; testId: string }) {
  return (
    <svg viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label={title} data-testid={testId} className="w-full rounded-md border border-border bg-white">
      <image href={image} width={size.width} height={size.height} />
      {placements.map((p) => (
        <text key={p.id} data-testid="veg-preview-text" data-field={p.id} x={p.x} y={p.baseline} fontSize={p.size} fontFamily="Helvetica, Arial, sans-serif" fill="#000">
          {p.text}
        </text>
      ))}
    </svg>
  )
}

export function VegetationPreview({ project, point, form }: Props) {
  const { size } = regionOf(project.region).vegetation
  const assets = vegetationPageAssets[project.region]
  const placements = React.useMemo(() => vegetationPlacements(project, form), [project, form])
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const filename = `vegetation-page-${slug(project.name)}-${slug(point.name)}.pdf`

  const make = async (then: (blob: Blob) => Promise<void> | void) => {
    setBusy(true)
    setProblem(null)
    try {
      const [vegetation, continued, { vegetationPdf }] = await Promise.all([
        fetch(assets.vegetation.pdf).then((r) => r.arrayBuffer()),
        fetch(assets.continued.pdf).then((r) => r.arrayBuffer()),
        import("@/delineation/vegetation/vegetationPdf"),
      ])
      const bytes = await vegetationPdf({ vegetation, continued }, project, point, form)
      await then(new Blob([bytes.slice().buffer], { type: "application/pdf" }))
    } catch {
      setProblem("The PDF could not be made on this device. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Vegetation page" className="grid gap-3">
      <Page title={`Vegetation page for ${point.name}`} image={assets.vegetation.image} size={size} placements={placements.vegetation} testId="vegetation-preview" />
      {placements.continued && (
        <Page title={`Vegetation Continued page for ${point.name}`} image={assets.continued.image} size={size} placements={placements.continued} testId="vegetation-continued-preview" />
      )}
      <div className="flex gap-2">
        <Button className="h-12 flex-1 text-base" disabled={busy} onClick={() => make((blob) => downloadBlob(blob, filename))}>
          <Download /> {busy ? "Making the PDF..." : "Download vegetation PDF"}
        </Button>
        {canShareFile("application/pdf") && (
          <Button variant="outline" className="h-12 flex-1 text-base" disabled={busy} onClick={() => make((blob) => shareFile(blob, filename, `${project.name}, ${point.name}, vegetation`))}>
            <Share2 /> Share vegetation PDF
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
