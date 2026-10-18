// Small pieces the sections of the method page share: a section with its heading, a note that
// something is not in this version yet, and a plain table. Gray only, like the rest of the app.
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid min-w-0 scroll-mt-4 grid-cols-[minmax(0,1fr)] gap-3 border-t border-border px-4 py-6"
    >
      <h2 id={`${id}-title`} className="font-heading text-xl font-extrabold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function Sub({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 font-heading text-base font-bold">{children}</h3>
}

/** A dashed box: what the page says about something that is planned and not built. */
export function NotYet({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div
      data-testid={testId}
      className="grid gap-1 rounded-md border-2 border-dashed border-foreground/70 p-3 text-sm"
    >
      <p className="font-bold">Not yet in this version</p>
      {children}
    </div>
  )
}

export function Table({
  head,
  rows,
  className,
}: {
  head: string[]
  rows: ReactNode[][]
  className?: string
}) {
  return (
    <div className={cn("overflow-x-auto rounded-md border border-border", className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-b-0 align-top">
              {row.map((cell, j) => (
                <td key={j} className={cn("px-3 py-2", j === 0 && "font-semibold")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
