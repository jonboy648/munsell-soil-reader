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
    </Section>
  )
}
