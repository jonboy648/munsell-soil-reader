// What the app decides, what it suggests, and what it never decides (ADR 0002). The delineation
// form features do not exist yet; their heading is here so they extend this page later.
import { NotYet, Section, Sub } from "./parts"

export function DecidesSection() {
  return (
    <Section id="decides" title="What the app decides, and what is yours">
      <p>
        The app is an instrument. It measures, and it tells you how far to trust what it measured.
        It does not make judgments that belong to you.
      </p>
      <dl className="grid gap-3">
        <div className="grid gap-0.5">
          <dt className="font-heading text-base font-bold">It decides</dt>
          <dd>
            The numbers: the median color, the correction, whether the Card check passed, the
            nearest Chip and the next two, and whether a Photo problem is flagged. The same Photo
            and the same taps always give the same answer.
          </dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="font-heading text-base font-bold">It shows, and you judge</dt>
          <dd>
            Which Reading to record, when to retake, and what to do about a warning or a Reading
            that sits between two Chips. The app shows the top 3 Chips with how far off each is, so
            you can see the doubt instead of being handed one answer.
          </dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="font-heading text-base font-bold">It never decides alone</dt>
          <dd>
            Anything that carries a regulatory meaning. Where the app suggests something of that
            kind, it quotes the rule it used, and it counts only when you confirm it.
          </dd>
        </div>
      </dl>

      <Sub>Delineation forms</Sub>
      <NotYet testId="forms-stub">
        <p>
          Filling the USACE Wetland Determination Data Form from the soil reader is planned and is
          not in this version. This part of the page will say how each hydric soil indicator,
          hydrophytic vegetation test, hydrology indicator and wetland determination is worked out,
          from which official sources and versions, with a citation for each suggestion. The
          stance will be the one above: the app suggests an indicator or a conclusion and quotes
          its rule, nothing is ticked on the form until you confirm it, and the app never decides a
          regulatory question by itself.
        </p>
      </NotYet>

      <Sub>Vegetation</Sub>
      <div data-testid="vegetation-notes" className="grid gap-2">
        <p>
          Plants are typed by common name, scientific name or abbreviation and looked up on the 2022
          National Wetland Plant List for the region (with USDA PLANTS names). The list is bundled,
          so the lookup works with no network. A name is added by itself only when exactly one plant
          matches; anything else shows the candidates and you pick.
        </p>
        <p>
          The status is the region&apos;s rating. The 2022 list has no NI or NO ratings. The
          supplement says to use the nearest adjacent region&apos;s rating for a plant the region
          does not rate, and the app does that: it tries the Midwest, then the Eastern Mountains and
          Piedmont, then the Atlantic and Gulf Coastal Plain, then the Great Plains. The supplement
          does not name the order, so the order is an assumption, and it matters only when two
          neighbours rate the plant differently. A plant on no list is recorded as UPL, as the
          supplement says to assume, and marked not identified when the app cannot place it in a
          genus.
        </p>
        <p>
          The dominant species of each stratum are chosen by the supplement&apos;s 50/20 rule: the
          most abundant plants until they pass half of the stratum&apos;s cover, and any plant that
          is a fifth of it alone. A stratum under 5 percent cover is recorded and not used, unless it
          is the only one. The Dominance Test, the Prevalence Index and the indicators follow the
          supplement&apos;s order. The prevalence index is applied only when the dominance test
          fails and hydric soil and wetland hydrology indicators are present, or when you apply it
          and say why. The app suggests Hydrophytic Vegetation Present? and nothing is ticked on
          the form until you confirm it. The tick for Morphological Adaptations is yours: the app
          does not recalculate the tests with a species counted as FAC.
        </p>
        <p>
          Decided on 2026-10-18: a plant identified only to its genus, where every species of the
          genus has the same status (Sonchus spp.), counts in the prevalence index and in the 80
          percent of cover that must be identified and rated. The supplement says not to include
          species that were not identified and does not say whether a genus is enough. A plant the list does
          not find is left out of the index. A dominant that is not identified to species is kept in
          the dominance test and warned about, because leaving it out could let the test pass.
        </p>
        <p>
          Not yet: the two Northcentral and Northeast subregion exceptions (quaking aspen and red
          raspberry, which are rated differently in the Northcentral Great Lakes).
        </p>
      </div>
    </Section>
  )
}
