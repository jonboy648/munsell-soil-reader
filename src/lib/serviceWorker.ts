import * as React from "react"

export type ServiceWorkerStatus = {
  /** The first install finished during this visit: the app now opens with no network. */
  offlineReady: boolean
  /** A newer version of the app has downloaded and is waiting for a reload. */
  updateReady: boolean
  dismissOfflineReady: () => void
  /** Switch to the newer version. Only the window where this is called reloads. */
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
  const registration = React.useRef<ServiceWorkerRegistration | undefined>(undefined)
  // Set when the user taps Reload in this window, so the other open windows are left alone when
  // the new worker takes over.
  const reloading = React.useRef(false)

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

    const onControllerChange = () => {
      if (reloading.current) location.reload()
    }
    container.addEventListener("controllerchange", onControllerChange)

    // A phone can keep the app open for days without a new page load, so look for a new
    // version whenever it comes back to the front. Offline the check fails; the next one will do.
    const onVisible = () => {
      if (document.visibilityState === "visible") registration.current?.update().catch(() => {})
    }
    document.addEventListener("visibilitychange", onVisible)

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
        // The app still works online without a service worker.
      })

    return () => {
      stop = true
      container.removeEventListener("controllerchange", onControllerChange)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

  const reload = React.useCallback(() => {
    const waiting = registration.current?.waiting
    // With no controlling worker (a page open since before the first install) the new one is
    // already active; with nothing waiting it is already running. A plain reload gets it.
    if (!navigator.serviceWorker.controller || !waiting) {
      location.reload()
      return
    }
    reloading.current = true
    waiting.postMessage({ type: "SKIP_WAITING" })
  }, [])

  const dismissOfflineReady = React.useCallback(() => setOfflineReady(false), [])

  return { offlineReady, updateReady, dismissOfflineReady, reload }
}
