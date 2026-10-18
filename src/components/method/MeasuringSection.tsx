// How the frame's reference colors are measured: for whoever prints the frames, not for a user
// reading soil. The text is shared with measurement mode itself.
import { MEASURE_METHOD } from "@/lib/measureMethod"
import { Section } from "./parts"

export function MeasuringSection() {
  return (
    <Section id="measuring" title="Measuring the frame's colors">
      <p>
        This part is for whoever prints the frames. A frame carries its own reference patches, and
        their true colors are measured once for each print batch. A maker tool, at the app's address
        followed by <code className="font-mono text-sm">?measure</code>, does the measuring from
        Photos of a swatch card beside a ColorChecker.
      </p>
      <div data-testid="measuring" className="grid gap-3">
        {MEASURE_METHOD.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </Section>
  )
}
