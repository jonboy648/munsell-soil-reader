// Credits and licenses. Each credit names its license and opens the full text, which is bundled
// into the app (see src/lib/credits.ts), so it reads the same with no network.
import * as React from "react"
import {
  CREDITED_ABOVE,
  CREDITS,
  licenseTextOf,
  loadBundledPackages,
  type BundledPackage,
  type Credit,
} from "@/lib/credits"
import { Section, Sub } from "./parts"

function CreditCard({ credit }: { credit: Credit }) {
  const text = licenseTextOf(credit)
  return (
    <li
      data-testid="credit"
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 rounded-md border border-border bg-card p-3 text-sm"
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
        <details className="group mt-1 min-w-0">
          <summary className="min-h-11 cursor-pointer py-2.5 font-semibold underline underline-offset-4">
            Read the full license text
          </summary>
          <pre
            data-testid="license-text"
            className="mt-1 max-h-96 max-w-full overflow-auto rounded-sm border border-border bg-background p-3 font-mono text-xs leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap"
          >
            {text}
          </pre>
        </details>
      )}
    </li>
  )
}

/** The packages whose code or files are in the built app, each with the license it ships. */
function BundledPackages() {
  const [packages, setPackages] = React.useState<BundledPackage[] | "failed" | null>(null)
  React.useEffect(() => {
    let stop = false
    loadBundledPackages().then(
      (list) => !stop && setPackages(list.filter((pkg) => !CREDITED_ABOVE.has(pkg.name))),
      () => !stop && setPackages("failed"),
    )
    return () => {
      stop = true
    }
  }, [])

  if (packages === null) return <p className="text-sm text-muted-foreground">Loading the list...</p>
  if (packages === "failed") {
    return (
      <p role="alert" className="text-sm" data-testid="bundled-failed">
        The list could not be loaded. It is made when the app is built, so the development server
        does not have it.
      </p>
    )
  }
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] text-sm" data-testid="bundled-packages">
      {packages.map((pkg) => (
        <li key={`${pkg.name}@${pkg.version}`} data-testid="bundled-package" data-package={pkg.name} className="min-w-0 border-b border-border">
          <details className="min-w-0">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {pkg.name} <span className="text-muted-foreground">{pkg.version}</span>
              </span>
              <span className="shrink-0 font-mono text-xs font-semibold">{pkg.license}</span>
            </summary>
            <pre
              data-testid="package-license-text"
              className="mb-2 max-h-96 max-w-full overflow-auto rounded-sm border border-border bg-background p-3 font-mono text-xs leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap"
            >
              {pkg.text}
            </pre>
          </details>
        </li>
      ))}
    </ul>
  )
}

export function Credits() {
  return (
    <Section id="credits" title="Credits and licenses">
      <p>
        The app is free and MIT licensed. It stands on the work below, each part under its own
        license, and the full texts open in this page, so they are here with no network too. They
        are also in THIRD_PARTY_NOTICES.md and LICENSE in the source.
      </p>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
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

      <Sub>Everything else the app ships</Sub>
      <p>
        These packages are in the app you are using, used unmodified, each under the license it
        comes with, whose text is below. The list is written when the app is built, from what the
        build contains, so it cannot fall behind.
      </p>
      <BundledPackages />
    </Section>
  )
}
