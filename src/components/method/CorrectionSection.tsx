// Which correction the app uses and why, and what the Card check threshold means. The numbers
// are from docs/correction-comparison.md (ticket #4), measured on 160 simulated Photos.
import { CARD_CHECK_GOOD } from "@/engine"
import { Section, Sub, Table } from "./parts"

export function CorrectionSection() {
  return (
    <Section id="correction" title="Which correction, and why">
      <p>
        The app straightens the camera's tone curve along the Card's gray patches, then fits a 3x3
        color matrix. Three corrections were tried on 160 simulated Photos (8 soils, 5 lights, 4
        strengths of phone tone curve), and each was scored on how close it brought the soil to its
        true color.
      </p>
      <Table
        head={["Correction", "Soil off by (CIEDE2000, average)", "Within one Chip"]}
        rows={[
          ["3x3 matrix alone", "3.00", "144 of 160"],
          ["Root-polynomial", "3.26", "145 of 160"],
          ["Straighten the tone curve, then 3x3 (used)", "0.55", "159 of 160"],
        ]}
      />
      <p>
        Phones brighten shadows and squeeze highlights. A matrix alone cannot undo that, so its error
        grows with the strength of the curve. Straightening the curve first keeps the error near 0.6
        however strong the curve is. Root-polynomial correction, a published method that adds
        nonlinear terms to the matrix, was no better than the plain matrix, so the app does not use
        it.
      </p>
      <p>
        "Within one Chip" means the same Chip or a Neighbouring chip: one step away in value, in
        chroma, or on the next Page.
      </p>
      <p>
        <b>This is the best case.</b> The simulated camera has exactly the kind of error that
        straightening undoes. A real phone adds local tone mapping, HDR, sharpening, compression and
        lens shading, which a curve cannot undo, so real Readings will be worse than 0.55. The
        first real check is a Photo of a real Page; the 20-soil test comes after it.
      </p>

      <Sub>What the Card check means</Sub>
      <p>
        The Card check is the average CIEDE2000 distance between each Card patch and its corrected
        color, when that patch was left out of the fit. Leaving it out is the point: a fit that is
        too flexible can match the patches it was given and still be wrong about anything else,
        including your soil.
      </p>
      <p>
        The line is {CARD_CHECK_GOOD}. It was set from 840 simulated Photos, from fine to broken:
      </p>
      <ul className="grid list-disc gap-1 pl-5">
        <li>Photos with a well-formed Card scored 1.04 or less.</li>
        <li>
          Photos that break the fit scored far higher: corners in the wrong order 24 to 56, a shadow
          over half the Card 3.8 to 15, glare on a patch 6 to 22.
        </li>
        <li>Every Reading more than one Chip off scored 3.7 or more.</li>
      </ul>
      <p>
        {CARD_CHECK_GOOD} sits in the middle of that gap: about twice the worst good Card and about
        half the lowest Card that spoiled a Reading. A failed check is a warning, not a verdict: a
        Card can fail and still give a good Reading, so the app shows the uncorrected Reading and
        says why instead of hiding it.
      </p>
    </Section>
  )
}
