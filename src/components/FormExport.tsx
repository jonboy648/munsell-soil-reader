// The buttons that make the form's PDF on the device and hand it over: a download, and the share
// sheet where the phone has one. One PDF holds the forms of the Sampling points it is given.
import * as React from "react"
import { Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Project, SamplingPoint } from "@/delineation/model"
import { formsPdf } from "@/delineation/pdf"
import { page1Assets, privacyPageAssets, soilPageAssets } from "@/delineation/regions/assets"
import { canShareFile, downloadBlob, shareFile } from "@/lib/download"

interface Props {
  project: Project
  points: readonly SamplingPoint[]
  /** The words on the download button, and in the share button after "Share". */
  label: string
  /** The file name, without the extension. */
  filename: string
  title: string
}

export const slug = (text: string) => text.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "untitled"

export function FormExport({ project, points, label, filename, title }: Props) {
  const [busy, setBusy] = React.useState(false)
  const [problem, setProblem] = React.useState<string | null>(null)
  const urls = [page1Assets, soilPageAssets, privacyPageAssets].map((assets) => assets[project.region].pdf)

  const make = async (then: (blob: Blob) => Promise<void> | void) => {
    setBusy(true)
    setProblem(null)
    try {
      const [page1, soil, privacy] = await Promise.all(
        urls.map(async (url) => (await fetch(url)).arrayBuffer()),
      )
      const bytes = await formsPdf({ page1, soil, privacy }, project, points)
      await then(new Blob([bytes.slice().buffer], { type: "application/pdf" }))
    } catch {
      setProblem("The PDF could not be made on this device. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        <Button className="h-12 flex-1 text-base" disabled={busy || points.length === 0} onClick={() => make((blob) => downloadBlob(blob, `${filename}.pdf`))}>
          <Download /> {busy ? "Making the PDF..." : label}
        </Button>
        {canShareFile("application/pdf") && (
          <Button
            variant="outline"
            className="h-12 flex-1 text-base"
            disabled={busy || points.length === 0}
            onClick={() => make((blob) => shareFile(blob, `${filename}.pdf`, title))}
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
    </div>
  )
}
