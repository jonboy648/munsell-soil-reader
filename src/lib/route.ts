// Which page of the app is showing. There is one HTML file (so the service worker caches the
// whole app), and the page is named in the address after the #, so a link to a page works with
// no network and the back button returns to the Photo.
import * as React from "react"

export type Page = "reader" | "method" | "guide"

const PAGES: Page[] = ["reader", "method", "guide"]

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

// Leaving a page. A page opened by a tap on a link in the app is one step on the browser's history,
// so closing it takes that step back, and the system Back button does not bring it up again. A page
// that was the first thing opened (a bookmark, a reload) has nothing to go back to inside the
// app, so it is replaced by the reader instead.
let openedHere = false

/** Call when a link in the app opens a page. */
export const markOpenedHere = (): void => {
  openedHere = true
}

/** Close the page being shown and show the reader. */
export function closePage(): void {
  if (openedHere && window.history.length > 1) {
    openedHere = false
    window.history.back()
  } else {
    window.location.replace(hrefOf("reader"))
  }
}
