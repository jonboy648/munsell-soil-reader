// What a Reading cannot tell you. Plain words: these are the reasons to hold a Reading loosely.
import { Section } from "./parts"

const LIMITS: { name: string; body: string }[] = [
  {
    name: "Faded or dirty book pages",
    body: "The soil book is the answer key for every Reading, and a Page used as the Card is also what the correction works from. A page that has faded or collected soil shifts the Chips you compare against, and the Card check cannot see an even fade. Use a ColorChecker as the independent check when it matters.",
  },
  {
    name: "Phone camera processing",
    body: "Phones do not just record light. They brighten shadows, boost colors, merge exposures and sharpen, and no two phones do it alike. The Card in the same Photo absorbs much of that, but not all of it. Every accuracy figure on this page comes from a simulated camera, which is kinder than a real one. Expect real Readings to be worse until real Photos have been tested.",
  },
  {
    name: "One hue per Page",
    body: "Most Pages of the soil book hold one hue. The correction works best close to the colors on the Card, so a Page far from the soil's hue corrects it less well. The 10Y-5GY, Gley and White Pages mix hues across the grid.",
  },
  {
    name: "Light",
    body: "Sun, shade, overcast sky and time of day all change the color of the soil and of the Card, and the correction assumes they change both the same way. Keep the Card and the soil side by side in the same light, flat to the camera, with no shadow across either and no reflection on the Card. The warnings catch some of these problems, not all.",
  },
  {
    name: "Moist or dry",
    body: "The same soil gives a different Chip moist and dry. The Reading is the color of the Sample as it was in the Photo, so note whether it was moist or dry when you photographed it.",
  },
  {
    name: "Chip names",
    body: "The Chips and their names come from a public list, corrected against a physical soil book (2009 Revision, 2015 Production). That check is not finished: the 10R Chips and the names on the 2.5Y and 5Y Pages have not yet been compared with the book.",
  },
  {
    name: "A Reading is a color, not a classification",
    body: "The app reads the color of one Spot. It does not know your soil's texture, its moisture history or what the layer is, and it does not replace your eye or your field notes.",
  },
]

export function LimitsSection() {
  return (
    <Section id="limits" title="Limits">
      <p>These are the reasons to hold a Reading loosely.</p>
      <dl className="grid gap-3">
        {LIMITS.map((limit) => (
          <div key={limit.name} className="grid gap-0.5">
            <dt className="font-heading text-base font-bold">{limit.name}</dt>
            <dd>{limit.body}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
