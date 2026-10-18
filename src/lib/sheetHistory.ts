import * as React from "react"

/**
 * While a sheet is open, the Back button (Android's, or the browser's) closes the sheet instead
 * of leaving the app. Opening pushes one history entry; closing any other way takes it off again.
 * `setOpen` must be stable, such as a state setter.
 */
export function useBackClosesSheet(open: boolean, setOpen: (open: boolean) => void): void {
  React.useEffect(() => {
    if (!open) return
    history.pushState({ sheet: true }, "")
    let wentBack = false
    const onPopState = () => {
      wentBack = true
      setOpen(false)
    }
    window.addEventListener("popstate", onPopState, { once: true })
    return () => {
      window.removeEventListener("popstate", onPopState)
      if (!wentBack) history.back()
    }
  }, [open, setOpen])
}
