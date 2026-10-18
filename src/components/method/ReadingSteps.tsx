// How a Reading is made, step by step, in plain words. The numbers come from the engine's own
// constants, so this page cannot drift from what the app does.
import { CARD_CHECK_GOOD } from "@/engine"
import { MAX_SIDE } from "@/lib/photo"
import { Section } from "./parts"

const STEPS: { name: string; body: string }[] = [
  {
    name: "Sampling",
    body: `The app reads colors from the Photo, scaled down so its longest side is at most ${MAX_SIDE} pixels. Where you tap a Spot, it takes the median color inside a small circle, whose radius is a fortieth of the Photo's longer side (at least 6 pixels). On the Card it does the same inside a circle about half as wide as a patch, centered on every patch. A median is used, not an average, so a few bright specks or a stray hair do not move the color.`,
  },
  {
    name: "Correction",
    body: "The Card's patches have known colors. The app compares what the camera recorded with what each patch really is and works out how to undo the camera's changes: first it straightens the camera's tone curve using the Card's gray patches, then it fits a 3x3 color matrix to all the patches to remove the color cast. The same fix is applied to the Spot. The raw color and the corrected color are both kept, so you can see what the Card changed.",
  },
  {
    name: "Card check",
    body: `Before you trust the corrected color, the app tests the fix on the Card itself. It leaves one patch (or, on a Page, one Chip) out, fits the correction to the others, and sees how close the left-out one comes to its true color. It does that for every one and averages. Below ${CARD_CHECK_GOOD} the check is good. At ${CARD_CHECK_GOOD} or more it has failed, and the app shows the uncorrected Reading with a note instead.`,
  },
  {
    name: "Munsell conversion",
    body: "The corrected color is converted to Munsell hue, value and chroma with munsell.js, which inverts the Munsell renotation data. The result is the exact notation, for example 9.6YR 4.1/2.8, which usually falls between two Chips in the book.",
  },
  {
    name: "Nearest Chip",
    body: "The app compares the corrected color with every Chip in the soil book, using CIEDE2000 (the standard measure of how different two colors look), and names the nearest one. It also shows the next two nearest, with how far off each is, so you can judge a Reading that sits between Chips. Readings land only on Chips that exist in the book, gley Chips included.",
  },
]

export function ReadingSteps() {
  return (
    <Section id="steps" title="How a Reading is made">
      <p>
        You photograph the Sample with a Card in the shot, tap the Card's corners, then tap one or
        more Spots on the soil. For each Spot the app works in five steps.
      </p>
      <ol className="grid gap-3">
        {STEPS.map((step, i) => (
          <li key={step.name} className="grid grid-cols-[2rem_1fr] gap-2">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full border-2 border-foreground font-mono text-sm font-semibold"
            >
              {i + 1}
            </span>
            <div className="grid gap-1">
              <h3 className="font-heading text-base font-bold">{step.name}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p>
        With no Card in the Photo the app still gives a Reading, straight from the Photo. It is
        marked "Not corrected", because the light and the camera shift the color, often by a whole
        Chip.
      </p>
      <p>
        "Off by" next to a Chip is the CIEDE2000 difference between your Reading and that Chip.
        Under 2 is hard to see. Over 3 is usually a different Chip.
      </p>
    </Section>
  )
}
