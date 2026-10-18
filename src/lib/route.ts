// Which page of the app is showing. There is one HTML file (so the service worker caches the
// whole app), and the page is named in the address after the #, so a link to a page works with
// no network and the back button returns to the Photo.
import * as React from "react"

export type Page = "reader" | "method"

const PAGES: Page[] = ["reader", "method"]

const pageOf = (hash: string): Page => {
  const name = hash.replace(/^#/, "")
  return PAGES.find((p) => p === name) ?? "reader"
}

/** The page named in the address, kept up to date as it changes. */
export function usePage(): Page {
  return React.useSyncExternalStore(
    (notify) => {
      window.addEventListener("hashchange", notify)
      return () => window.removeEventListener("hashchange", notify)
    },
    () => pageOf(window.location.hash),
    () => "reader",
  )
}

/** The link target for a page; the reader is the address with no #. */
export const hrefOf = (page: Page): string => (page === "reader" ? "#" : `#${page}`)
