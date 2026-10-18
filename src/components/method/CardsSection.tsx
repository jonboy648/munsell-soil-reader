// The Cards the app can read against, and the trade between them (ADR 0001, ADR 0003). The Page
// mechanics are a marked stub: they are written when the Page Card ships (ticket #8).
import { NotYet, Section, Sub } from "./parts"

export function CardsSection() {
  return (
    <Section id="cards" title="The Card: ColorChecker or a Page of your book">
      <p>
        The correction needs a Card in the same Photo and the same light as the soil, so it has
        colors it knows to work from. The app reads against a ColorChecker today and is gaining a
        second Card, a Page of your soil book. They trade against each other.
      </p>
      <Sub>X-Rite ColorChecker Classic</Sub>
      <p>
        A card of 24 patches. This is the Card the app reads today. It is an independent reference:
        its colors do not come from the soil book, and they do not fade the way a book does. It
        costs money, and its colors are bright and varied, not the browns and grays of soil, so the
        correction is not tuned to soil colors.
      </p>
      <Sub>A Page of your soil book</Sub>
      <p>
        Most people who read soil with the Munsell book do not own a ColorChecker, so a Page of the
        book itself can be the Card. The app knows every Chip's notation, so the Page's Chips are
        its reference colors. The Chips are exactly the colors soil has, and nothing extra has to be
        bought. The correction is strongest near the colors on the Page, so lay down the Page
        closest to your soil, as you would reading by eye.
      </p>
      <p>
        <b>The catch: a Page corrects against the same book the answer is read from.</b> Books fade
        and get dirty. A worn Page shifts every Reading, and the Card check cannot see a Page that
        has faded evenly, because every Chip on it has moved together. The Page is for convenience.
        If a Reading matters, cross-check it with a ColorChecker.
      </p>
      <NotYet testId="page-card-stub">
        <p>
          Using a Page as the Card is planned and is not in this version. This part of the page will
          say, when it ships: how a Page is laid out for the app (value rows, chroma columns, gaps),
          which Pages are supported, which Chips are the reference colors, how the app tells you when
          your soil reads on a different hue than the Page you used, and what the Card check
          measures on a Page.
        </p>
      </NotYet>
      <Sub>The printed frame</Sub>
      <NotYet testId="frame-stub">
        <p>
          A printed frame with measured color patches and a marker in each corner is planned, so the
          app can find the Card without taps and no book is needed. It is not in this version.
        </p>
      </NotYet>
    </Section>
  )
}
