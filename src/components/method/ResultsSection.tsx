// The 20-soil test. It has not run; ticket #17 replaces this text with the results.
import { Section } from "./parts"

export function ResultsSection() {
  return (
    <Section id="results" title="Results of the 20-soil test">
      <p
        data-testid="soil-test-results"
        className="rounded-md border-2 border-foreground p-3 font-bold"
      >
        The 20-soil test has not been run yet.
      </p>
      <p>
        The test is the bar for calling the app ready. Jon Cackler, who made the app, reads 20 soils
        against the soil book and the app reads the same 20 in Photos. The app passes if on 18 of the 20 soils it lands
        within one Chip of his reading: the same Chip or a Neighbouring chip, with
        his reading from the book as the truth. The results, and the data behind them, will be
        recorded here.
      </p>
      <p>
        Until then, the only measurements are from a simulated camera: on 160 simulated Photos of a
        simulated ColorChecker the correction reads within one Chip in 159. That says the method is
        sound in the best case. It does not say how a real phone will do, and the Page Card, which
        the 20-soil test uses, has no accuracy figure yet: the first real check of it is a Photo of
        a real Page.
      </p>
    </Section>
  )
}
