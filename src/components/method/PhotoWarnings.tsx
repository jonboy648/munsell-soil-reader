// What each Photo warning means and the number that sets it off. The numbers are the engine's own
// constants (src/engine/quality.ts), and docs/quality-thresholds.md says how each was chosen.
import {
  BLOWN_CHANNELS,
  BLOWN_LEVEL,
  CLIP_SHARE,
  CRUSHED_LEVEL,
  FRAME_OFF_CARD_STOPS,
  FRAME_UNEVEN_STOPS,
  GLARE_SHARE,
  MIN_LIT_SAMPLES,
  MIN_SPACING_PX,
  NEAR_CLIP_LEVEL,
  WHITE_CLIPPED_LEVEL,
} from "@/engine"
import { Section } from "./parts"

const percent = (share: number) => `${Math.round(share * 100)}%`

const WARNINGS: { name: string; means: string; line: string }[] = [
  {
    name: "Glare",
    means:
      "A bright reflection on a Card patch or on the soil. It wipes out the color underneath. Tilt the Card or move into shade.",
    line: `On the Card: a patch with ${Math.round(GLARE_SHARE * 100)} percentage points more blown pixels than the Card's own white has (the white is the brightest thing exposure can put on the Card, so more than that is a reflection). On a Spot: ${percent(GLARE_SHARE)} of its pixels blown, while the rest of the Spot sits well below the top of the range (under ${NEAR_CLIP_LEVEL} out of 255).`,
  },
  {
    name: "Clipped",
    means:
      "Part of the Photo is washed out to pure white or lost in pure black, so the camera recorded nothing there that a correction could recover. Use less light or lower the exposure, or add light.",
    line: `The Card's white has ${BLOWN_CHANNELS} channels at ${WHITE_CLIPPED_LEVEL} or more in its median color. Or the Card's black patch is ${percent(CLIP_SHARE)} crushed. Or fewer than ${MIN_LIT_SAMPLES} of the 15 places on the Card's black frame rise above black, so the light cannot be checked. On a Spot: blown pixels while the soil itself sits at ${NEAR_CLIP_LEVEL} or more, or ${percent(CLIP_SHARE)} of it crushed.`,
  },
  {
    name: "Uneven light",
    means:
      "The light across the Card is not the same everywhere, for example a shadow over part of it. The correction assumes one light, so move into even light.",
    line: `The ColorChecker's black frame is read at 15 places and a plane is fitted through them. If the light changes by more than ${FRAME_UNEVEN_STOPS} stops across the Card (and by less than ${FRAME_OFF_CARD_STOPS}, past which the places are probably not on the frame) the warning shows. A stop is a doubling of light.`,
  },
  {
    name: "Card too small",
    means: "The Card fills too little of the Photo for its patches to be read. Move closer.",
    line: `Patches are closer than ${MIN_SPACING_PX} pixels apart in the Photo (measured from the Card's corners, in the scaled-down Photo).`,
  },
]

export function PhotoWarnings() {
  return (
    <Section id="warnings" title="Photo warnings">
      <p>
        Before you trust a Reading, the app checks the Photo for four problems. Each warning names
        where it applies (the Card, or one Spot) and says what to do. A warning does not stop a
        Reading. It tells you how far to trust it.
      </p>
      <p>
        A pixel counts as <b>blown</b> when {BLOWN_CHANNELS} of its 3 color channels are at{" "}
        {BLOWN_LEVEL} or more (out of 255), and as <b>crushed</b> when all 3 are at {CRUSHED_LEVEL}{" "}
        or less.
      </p>
      <ul className="grid gap-3">
        {WARNINGS.map(({ name, means, line }) => (
          <li
            key={name}
            data-testid="warning-kind"
            className="grid gap-1 rounded-md border border-border bg-card p-3 text-sm"
          >
            <h3 className="font-heading text-base font-bold">{name}</h3>
            <p>{means}</p>
            <p>
              <span className="font-semibold">Where the line is: </span>
              {line}
            </p>
          </li>
        ))}
      </ul>
      <p>
        These are first values, chosen from simulated Photos. Real phone Photos have blur and
        compression the simulation lacks, so the lines will move as real Photos come in. A Photo can
        pass every check and still read wrong, and one that fails can still read well: the checks
        are warnings, not verdicts.
      </p>
      <p>
        If the Card's gray patches come out in the wrong order of brightness, the app takes the
        corners to be in the wrong place or the wrong order, and the failed Card check says so.
        Tap Start over and tap the corners clockwise from the brown patch.
      </p>
    </Section>
  )
}
