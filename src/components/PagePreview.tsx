// A page of the form on screen: the official page's image with the same list of placed values the PDF
// is made from drawn over it, so what is shown is what the PDF holds.
import type { Placement } from "@/delineation/soilPage"

interface Props {
  /** The page's size in points, which is the coordinate system of the placements. */
  size: { width: number; height: number }
  image: string
  placements: readonly Placement[]
  label: string
  testId: string
}

export function PagePreview({ size, image, placements, label, testId }: Props) {
  return (
    <svg
      viewBox={`0 0 ${size.width} ${size.height}`}
      role="img"
      aria-label={label}
      data-testid={testId}
      className="w-full rounded-md border border-border bg-white"
    >
      <image href={image} width={size.width} height={size.height} />
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
  )
}
