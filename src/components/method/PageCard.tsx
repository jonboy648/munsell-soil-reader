// A Page of the soil book as the Card: how it is used, how dirty Chips are handled, and what has
// and has not been checked. The numbers come from the engine's own constants and Page model, and
// the real-Page findings from the pull request that added the Page Card (#52). Every limit in
// this part is provisional until real Photos are run (issue #15).
import {
  CARD_CHECK_GOOD,
  DIRTY_FACTOR,
  DIRTY_FLOOR,
  MAX_LADDER_LEFT_OUT,
  MAX_LEFT_OUT,
  PAGE_HUES,
  PAGE_UNEVEN_STOPS,
  pageModel,
} from "@/engine"
import { Sub } from "./parts"

/** The largest pairwise CIEDE2000 between the wood behind the holes on the four real Pages, corrected (pinned in realPages.test.ts). */
const PAGE_WOOD_SPREAD = "4.3"

/** The four Chips to tap on a Page, as the app names them. */
const tapsOf = (hue: (typeof PAGE_HUES)[number]) =>
  pageModel(hue)
    .taps.map((tap) => `${tap.chip.value}/${tap.chip.chroma}`)
    .join(", ")

export function PageCard() {
  return (
    <>
      <Sub>How a Page is used</Sub>
      <ul className="grid list-disc gap-2 pl-5" data-testid="page-card">
        <li>
          <b>Pick the Page closest to the soil.</b> Six Pages that hold one hue work as a Card:{" "}
          {PAGE_HUES.join(", ")}. The Gley, 10Y-5GY and White Pages mix hues across the grid, and
          the 10R Page has not been checked against a real book, so none of them can be the Card
          yet. Their Chips can still be a Reading's answer.
        </li>
        <li>
          <b>Tap four named Chips.</b> The app shows which: on the 10YR Page {tapsOf("10YR")}, on
          the 7.5YR Page {tapsOf("7.5YR")}. A Page is a regular grid, so from those four the app
          finds every other Chip, even when the Page is tilted.
        </li>
        <li>
          <b>The soil is in a hole.</b> Holes are punched in the Page, and the soil shows through
          one. Tap the soil in a hole. The app cuts the circle it reads to fit inside the hole, so
          no Chip or paper is read with the soil.
        </li>
        <li>
          <b>Each Chip is read in its solid middle,</b> clear of the holes, and compared with the
          color its notation says it is. The /1 column, the grayest Chips down the Page, is the
          Page's gray ladder, used to straighten the camera's tone curve the way the
          ColorChecker's gray row is.
        </li>
        <li>
          <b>A better Page.</b> When the Card check is good and the Reading's nearest Chip is not
          printed on the Page you used, the app names the Page it belongs on, because the
          correction is strongest near the Page's own hue.
        </li>
      </ul>

      <Sub>Which correction a Page uses</Sub>
      <div className="grid gap-2" data-testid="page-correction">
        <p>
          A Page uses the same curves as the ColorChecker, but not its full 3x3 matrix. The
          ColorChecker's patches cover the color space, so they say how the camera mixes the red,
          green and blue channels. A Page's Chips all have one hue: they differ in lightness and
          strength, not in hue, so they lie along one line of color space and say nothing about the
          hue direction. A matrix left free there pulls every color that is not on the Page toward the
          Page's hue.
        </p>
        <p>
          <b>The check that showed it:</b> the same wood, in the same light, seen through the holes of
          four Pages (10YR, 7.5YR, 2.5Y and 5Y). Raw, it comes out within 2.4 CIEDE2000 across the
          four Photos. Corrected with the full matrix, it came out 11.8 apart, and read as 2.5Y on the
          2.5Y Page and 5Y on the 5Y Page, so the better-Page hint never fired. The Page's matrix is now
          held near one gain per channel (a ridge on the matrix's off-diagonal terms), and the wood is{" "}
          {PAGE_WOOD_SPREAD} apart, as close as the wood's own grain lets four Photos be.
        </p>
        <p>
          <b>The price:</b> a Page's own Card check is higher, because the matrix has less freedom to
          fit the Page's own Chips (10YR 2.12 to 2.79). That is the part of the old check that came
          from the pull. The strength was not chosen by the Card check, which can only see the Page's
          own hue and would pick the weakest; it is the weakest that brings the wood to the noise floor.
          The comparison of the candidates is in docs/correction-comparison.md.
        </p>
      </div>

      <Sub>Dirty Chips are left out</Sub>
      <p>
        A Page that has been handled for years has smudged Chips. A few of them must not drag the
        whole correction, so the app leaves them out of the fit and names them next to the Card
        check, with a cross on each in the Photo.
      </p>
      <ul className="grid list-disc gap-2 pl-5">
        <li>
          A Chip is judged by how badly the fit, made without it, misses it. It is left out when
          that miss is over {DIRTY_FLOOR} (CIEDE2000) and over {DIRTY_FACTOR} times the usual miss
          of the other Chips off the gray column, worst first.
        </li>
        <li>
          A gray step cannot be judged that way, because the curves are drawn through it. It is
          judged by the Chips beside it in its row and the rows around it: it is dirty when the
          curves drawn without it agree with them much better.
        </li>
        <li>
          At most {MAX_LEFT_OUT} Chips are left out, and at most {MAX_LADDER_LEFT_OUT} of them gray
          steps. A Page that is dirty all over is not a Card.
        </li>
        <li>
          <b>The row guard.</b> If two or more Chips in one value row have to be left out, the Card
          check fails, whatever its average says. Either that row's gray Chip is dirty by too
          little to catch, or those Chips are beyond what the gray column can describe, and
          leaving them out must not make the check look better than it is.
        </li>
      </ul>

      <Sub>What has been checked, and what has not</Sub>
      <p>
        <b>The Page Card has no accuracy figure yet.</b> It has been tried on simulated Pages, and on
        four real Pages from the maintainer's book (10YR, 7.5YR, 2.5Y and 5Y) with the corners
        tapped by eye, as a sanity check only. The four Photos are kept as test fixtures, so what
        is said below is pinned by tests. A Photo of a real Page (issue #15) is its first real
        test, and the 20-soil test is the bar.
      </p>
      <ul className="grid list-disc gap-2 pl-5">
        <li>
          On all four real Pages every read circle landed inside its Chip, none touching a hole.
        </li>
        <li>
          <b>10YR:</b> the Page has two smudged Chips, 8/1 and 7/1. Left in, the Card check was
          7.56. The fit now leaves out 8/1, 7/1 and 3/6, and the check is 2.79.
        </li>
        <li>
          <b>7.5YR fails the Card check,</b> and honestly. It leaves out 3/3, 2.5/2 and 2.5/3, two of
          them in the 2.5/ row, so the row guard fails it. They are not dirt: the Page's darkest
          browns are darker and stronger than the gray column reaches, so the fit has to guess past
          the end of it. Its check is 2.98.
        </li>
        <li>
          After leaving Chips out, 2.5Y read 2.84 and 5Y read 1.83. With the good line at{" "}
          {CARD_CHECK_GOOD}, 10YR (2.79) and 2.5Y show caution (the corrected Reading with the
          uncorrected one beside it), 5Y shows good, and only 7.5YR fails, on its row guard.
        </li>
        <li>
          <b>What is not caught.</b> A mild film (2 to 5%) on both dark gray steps makes the app
          leave out their clean neighbours instead, and the Card check passes with the dark soils 3
          to 4 CIEDE2000 off. And when the dark gray steps are left out, the ladder no longer reaches
          the darkest soils, which the check cannot see, because it measures only the Chips that
          were kept.
        </li>
        <li>
          Light on a Page is checked on its white paper between the columns, with a limit of{" "}
          {PAGE_UNEVEN_STOPS} stops (a Page is big in the Photo, so the light falls off across it:
          the four real Pages read 0.11 to 0.33).
        </li>
      </ul>
    </>
  )
}
