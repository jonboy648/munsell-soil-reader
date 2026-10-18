// Credits and licenses. Each credit names its license and opens the full text, which is bundled
// into the app (see src/lib/credits.ts), so it reads the same with no network.
import { CREDITS, licenseTextOf, otherDependencies, type Credit } from "@/lib/credits"
import { Section, Sub } from "./parts"

function CreditCard({ credit }: { credit: Credit }) {
  const text = licenseTextOf(credit)
  return (
    <li
      data-testid="credit"
      className="grid gap-1 rounded-md border border-border bg-card p-3 text-sm"
    >
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-heading text-base font-bold">{credit.name}</span>
        <span className="font-mono text-xs font-semibold" data-testid="credit-license">
          {credit.license}
        </span>
      </p>
      <p className="text-muted-foreground">By {credit.by}</p>
      <p>{credit.used}</p>
      <p className="flex flex-wrap gap-x-4">
        {credit.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            {link.label}
          </a>
        ))}
      </p>
      {text && (
        <details className="group mt-1">
          <summary className="min-h-11 cursor-pointer py-2.5 font-semibold underline underline-offset-4">
            Read the full license text
          </summary>
          <pre
            data-testid="license-text"
            className="mt-1 max-h-96 overflow-auto rounded-sm border border-border bg-background p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap"
          >
            {text}
          </pre>
        </details>
      )}
    </li>
  )
}

export function Credits() {
  const others = otherDependencies()
  return (
    <Section id="credits" title="Credits and licenses">
      <p>
        The app is free and MIT licensed. It stands on the work below, each part under its own
        license. The full license texts are in this page, and in THIRD_PARTY_NOTICES.md and LICENSE
        in the source.
      </p>
      <ul className="grid gap-3">
        {CREDITS.map((credit) => (
          <CreditCard key={credit.name} credit={credit} />
        ))}
      </ul>

      <Sub>Methods</Sub>
      <p>
        Published methods the app uses, written out in its own code: CIEDE2000 color difference
        (Sharma, Wu and Dalal, 2005), checked against their published test pairs; monotone cubic
        interpolation for the tone curve (Fritsch and Carlson, 1980); and the Bradford adaptation
        that moves the ColorChecker's published colors to the screen's white.
      </p>

      <Sub>Everything else the app is built with</Sub>
      <p>These ship in the app, or build it. Each is used unmodified under its own license.</p>
      <ul className="grid gap-1 text-sm" data-testid="other-dependencies">
        {others.map((dep) => (
          <li key={dep.name} className="flex justify-between gap-4 border-b border-border py-1">
            <span>{dep.name}</span>
            <span className="font-mono text-xs font-semibold">{dep.license}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
