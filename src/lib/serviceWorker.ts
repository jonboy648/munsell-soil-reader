import * as React from "react"

export type ServiceWorkerStatus = {
  /** The first install finished during this visit: the app now opens with no network. */
  offlineReady: boolean
  /** A newer version of the app has downloaded and is waiting for a reload. */
  updateReady: boolean
  dismissOfflineReady: () => void
  /** Hide the update notice until the app next comes back to the front. */
  dismissUpdate: () => void
  /** Switch to the newer version in this window. */
  reload: () => void
}

/**
 * Registers the service worker and follows its life: the first install ("ready offline") and
 * later updates ("new version ready"). The registration is followed here, not through
 * workbox-window, which stops listening for updates for good after one failed install and cannot
 * tell a first install from an update on a page that was open before the worker existed.
 */
export function useServiceWorker(): ServiceWorkerStatus {
  const [offlineReady, setOfflineReady] = React.useState(false)
  const [updateReady, setUpdateReady] = React.useState(false)
  const [updateDismissed, setUpdateDismissed] = React.useState(false)
  const registration = React.useRef<ServiceWorkerRegistration | undefined>(undefined)

  React.useEffect(() => {
    // The development server has no service worker file.
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return
    const container = navigator.serviceWorker
    const tracked = new WeakSet<ServiceWorker>()
    let stop = false

    // A worker that installs while another is active is an update; the first one is the install.
    // On a page no worker controls, the update goes straight on to activate, so by the time this
    // looks its state can be past "installed"; only "redundant" (a failed install) is not ready.
    const track = (worker: ServiceWorker, isUpdate: boolean) => {
      if (tracked.has(worker)) return
      tracked.add(worker)
      const check = () => {
        if (stop) return
        if (isUpdate && ["installed", "activating", "activated"].includes(worker.state)) {
          setUpdateReady(true)
        }
        if (!isUpdate && worker.state === "activated") {
          setOfflineReady(true)
          // Ask the browser not to evict the offline copy when storage runs short.
          void navigator.storage?.persist?.().catch(() => {})
        }
      }
      worker.addEventListener("statechange", check)
      check()
    }

    // Registers, or finds the existing registration, and follows its installs.
    const start = () => {
      container
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .then((reg) => {
          if (stop) return
          registration.current = reg
          const onUpdateFound = () => {
            if (reg.installing) track(reg.installing, !!reg.active)
          }
          // Every update is followed, so one that fails to install does not end the watching.
          reg.addEventListener("updatefound", onUpdateFound)
          onUpdateFound()
          // An update that finished waiting while the app was closed.
          if (reg.waiting) track(reg.waiting, true)
        })
        .catch(() => {
          // Offline or refused; the next look tries again. The app works online without it.
        })
    }

    // A phone can keep the app open for days without a new page load, so look for a new version
    // whenever it comes back to the front or the network returns. A first install that failed
    // (weak signal) leaves no registration at all, so that case registers again.
    const look = () => {
      const reg = registration.current
      if (!reg || (!reg.active && !reg.waiting && !reg.installing)) {
        start()
        return
      }
      reg.update().catch((error) => {
        if (error?.name === "InvalidStateError") start()
        // Anything else is the network being down; the next look will do.
      })
    }
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      setUpdateDismissed(false)
      look()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", look)
    start()

    return () => {
      stop = true
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", look)
    }
  }, [])

  const reload = React.useCallback(() => {
    const waiting = registration.current?.waiting
    // Nothing waiting: the new version is already the active one (a page no worker controlled),
    // so a plain reload gets it.
    if (!waiting) {
      location.reload()
      return
    }
    // Reload once the waiting worker is active, in this window only. This holds whether or not
    // this window is controlled: another window may be what kept the worker waiting.
    waiting.addEventListener("statechange", () => {
      if (waiting.state === "activated") location.reload()
    })
    waiting.postMessage({ type: "SKIP_WAITING" })
  }, [])

  const dismissOfflineReady = React.useCallback(() => setOfflineReady(false), [])
  const dismissUpdate = React.useCallback(() => setUpdateDismissed(true), [])

  return {
    offlineReady,
    updateReady: updateReady && !updateDismissed,
    dismissOfflineReady,
    dismissUpdate,
    reload,
  }
}
