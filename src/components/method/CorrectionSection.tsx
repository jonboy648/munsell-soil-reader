// Which correction the app uses and why, and what the Card check threshold means and does not
// mean. The numbers are from docs/correction-comparison.md (ticket #4), measured on 160 simulated
// Photos, and from the follow-up (issue #28) that found where the check is too kind or too
// strict and gave it a caution band. This page says both, because it is the page that says how far
// to trust a Reading.
import { CARD_CHECK_CAUTION, CARD_CHECK_GOOD } from "@/engine"
import { Section, Sub, Table } from "./parts"

export function CorrectionSection() {
  return (
    <Section id="correction" title="Which correction, and why">
      <p>
        The app straightens the camera's tone curve along the Card's gray patches, then fits a 3x3
        color matrix. Five corrections were compared on 160 simulated Photos (8 soils, 5 lights, 4
        strengths of phone tone curve), each scored on how close it brought the soil to its true
        color. The soil is never part of the fit, so it is an honest test of the correction.
      </p>
      <Table
        head={["Correction", "Soil off by (CIEDE2000, average)", "Within one Chip"]}
        rows={[
          ["3x3 matrix alone", "3.00", "125 of 160"],
          ["Root-polynomial", "3.26", "124 of 160"],
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
        including your soil. It has three answers.
      </p>
      <ul className="grid list-disc gap-1 pl-5">
        <li>
          <b>Good,</b> below {CARD_CHECK_GOOD}. The corrected Reading is the answer.
        </li>
        <li>
          <b>Caution,</b> from {CARD_CHECK_GOOD} up to {CARD_CHECK_CAUTION}, or when a gray step was
          left out as dirty. The corrected Reading is still the answer, the uncorrected one is shown
          beside it, and the words name uneven light or the dirty gray step, never the corner order.
          If the two differ by a Chip or more, wipe the Card or retake the Photo in even light.
        </li>
        <li>
          <b>Failed,</b> above {CARD_CHECK_CAUTION}, or when a row of a Page had to lose two Chips.
          The uncorrected Reading is shown, with a note.
        </li>
      </ul>
      <p>
        <b>
          The lines are {CARD_CHECK_GOOD} and {CARD_CHECK_CAUTION}, and they are provisional.
        </b>{" "}
        They were set on simulated Photos only, from fine to broken:
      </p>
      <ul className="grid list-disc gap-1 pl-5">
        <li>
          A clean ColorChecker from an ideal simulated camera scored 0.5 to 0.8, and up to 2.1 under
          a 20% light gradient.
        </li>
        <li>
          A clean one from a simulated real sensor (Nikon D5100 sensitivities, measured ColorChecker
          reflectances) scored 2.0 to 3.1, and up to 3.5 under a 20% gradient. Daylight is the best
          of them, tungsten the worst.
        </li>
        <li>
          Cards with damage that moved the Reading by more than a Chip (a dirty patch, a shadow
          over half the Card, glare on a patch, corners in the wrong order) scored 3.56 or more.
        </li>
      </ul>
      <p>
        {CARD_CHECK_CAUTION} sits in the narrow gap between the worst clean Card and the best broken
        one, and {CARD_CHECK_GOOD} is the score below which no simulated real-sensor Reading was
        more than a Chip off. Both will be set again on real Photos (the Photo of a real Page, and
        a Photo of a ColorChecker).
      </p>

      <Sub>What passing does not tell you</Sub>
      <ul className="grid list-disc gap-1 pl-5">
        <li>
          <b>A pass is not a promise that the Reading is within one Chip.</b> A gray patch with a
          film of soil on it, or a black patch gone gray, bends the curve of every channel while the
          average over 24 patches hardly moves. The app now judges the gray steps against the
          patches beside them and leaves a dirty one out, which it names. In 624 simulated Photos
          with one dirty gray step it did so in 174, and 46 Readings were still more than a Chip off,
          14 of them with the check good and 32 in caution.
        </li>
        <li>
          <b>A failure is not proof the Reading is wrong.</b> A Card can fail and still give a good
          Reading, so the app shows the uncorrected Reading and says why, instead of hiding it.
        </li>
        <li>
          <b>A real camera's clean Card is mostly caution.</b> The simulated real sensor scores 2.0
          to 3.1, so a clean Card shows caution there, not good. Of Jon's four real Pages, 10YR
          (2.13) and 2.5Y (2.20) show caution, 5Y (1.62) good, and 7.5YR fails on its row guard.
        </li>
      </ul>
    </Section>
  )
}
