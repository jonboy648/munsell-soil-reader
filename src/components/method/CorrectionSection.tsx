// Which correction the app uses and why, and what the Card check threshold means and does not
// mean. The numbers are from docs/correction-comparison.md (ticket #4), measured on 160 simulated
// Photos, and from the open follow-up (issue #28) that found where the check is too kind or too
// strict. This page says both, because it is the page that says how far to trust a Reading.
import { CARD_CHECK_GOOD } from "@/engine"
import { Section, Sub, Table } from "./parts"

export function CorrectionSection() {
  return (
    <Section id="correction" title="Which correction, and why">
      <p>
        The app straightens the camera's tone curve along the Card's gray patches, then fits a 3x3
        color matrix. (A Page of your book uses the same curves and a matrix held near one gain per
        channel, for a reason given under the Card.) Five corrections were compared on 160 simulated Photos (8 soils, 5 lights, 4
        strengths of phone tone curve), each scored on how close it brought the soil to its true
        color. The soil is never part of the fit, so it is an honest test of the correction.
      </p>
      <Table
        head={["Correction", "Soil off by (CIEDE2000, average)", "Within one Chip"]}
        rows={[
          ["3x3 matrix alone", "3.00", "144 of 160"],
          ["Root-polynomial", "3.26", "145 of 160"],
          ["Straighten the tone curve with straight lines, then 3x3", "0.65", "159 of 160"],
          ["Straighten the tone curve with a smooth curve, then 3x3 (used)", "0.55", "159 of 160"],
          ["Straighten the tone curve, then root-polynomial", "0.63", "158 of 160"],
        ]}
      />
      <p>
        Phones brighten shadows and squeeze highlights. A matrix alone cannot undo that, so its error
        grows with the strength of the curve. Straightening the curve first keeps the error near 0.6
        however strong the curve is. Root-polynomial correction, a published method that adds
        nonlinear terms to the matrix, was no better than the plain matrix, and no better after the
        curve was straightened, so the app does not use it.
      </p>
      <p>
        "Within one Chip" means the same Chip or a Neighbouring chip: one step away in value, in
        chroma, or on the next Page.
      </p>
      <p>
        <b>This is the best case.</b> The camera in these tests is simulated, and it has exactly the
        kind of error that straightening undoes. A real phone adds local tone mapping, HDR,
        sharpening, compression and lens shading, which a curve cannot undo, so real Readings will
        be worse than 0.55. The first real check is a Photo of a real Page; the 20-soil test comes
        after it.
      </p>

      <Sub>What the Card check means</Sub>
      <p>
        The Card check is the average CIEDE2000 distance between each Card patch and its corrected
        color, when that patch was left out of the fit. Leaving it out is the point: a fit that is
        too flexible can match the patches it was given and still be wrong about anything else,
        including your soil.
      </p>
      <p>
        <b>The line is {CARD_CHECK_GOOD}, and it is provisional.</b> It was set on a simulated
        ColorChecker with clean gray patches, from 840 simulated Photos, from fine to broken:
      </p>
      <ul className="grid list-disc gap-1 pl-5">
        <li>Photos with a well-formed Card scored 1.04 or less.</li>
        <li>
          Photos that break the fit scored higher: corners in the wrong order 24 to 56, a shadow
          over half the Card 3.8 to 15, glare on a patch 6 to 22, and one or two dirty patches 0.9
          to 16. The low end of that last range is below the line.
        </li>
      </ul>
      <p>
        {CARD_CHECK_GOOD} sits above the worst good Card in that test and below most broken ones. It
        will be set again on real Photos (the Photo of a real Page, and a follow-up check of the
        Card check itself).
      </p>

      <Sub>What passing does not tell you</Sub>
      <ul className="grid list-disc gap-1 pl-5">
        <li>
          <b>A pass is not a promise that the Reading is within one Chip.</b> A gray patch with a
          film of soil on it scored 1.79 to 1.98 in a simulation while the Reading was more than one
          Chip off, and a tinted black patch scored 1.6 while dark soils read two to five Chips
          off. A dirty or tinted gray patch can pass.
        </li>
        <li>
          <b>A failure is not proof the Reading is wrong.</b> A Card can fail and still give a good
          Reading, so the app shows the uncorrected Reading and says why, instead of hiding it.
        </li>
        <li>
          <b>On a real camera the line may be too strict.</b> A simulation of a real sensor (Nikon
          D5100 sensitivities) scored good Photos from 1.3 to 3.2, so 14 of 24 of them would fail
          at {CARD_CHECK_GOOD}. A caution band between good and failed is planned for this (issue
          #28).
        </li>
      </ul>
    </Section>
  )
}
