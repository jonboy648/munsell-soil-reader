import type { Page, TestInfo } from "@playwright/test"

/** Test-only, bounded evidence for first-install failures; never wait for worker readiness. */
export async function recordFirstInstall(
  page: Page,
  info: TestInfo,
  attachmentName = "first-install-lifecycle",
): Promise<() => Promise<void>> {
  await page.addInitScript(() => {
    const events: { event: string; state?: string; ms: number }[] = []
    Object.assign(window, { __firstInstallEvents: events })
    const record = (event: string, state?: string) => {
      if (events.length < 100) events.push({ event, state, ms: performance.now() })
    }
    if (!("serviceWorker" in navigator)) return record("unsupported")
    const original = ServiceWorkerContainer.prototype.register
    ServiceWorkerContainer.prototype.register = function (...args) {
      record("register-called")
      return original.apply(this, args).then((registration) => {
        record("register-resolved")
        const watched = new WeakSet<ServiceWorker>()
        const watch = (worker: ServiceWorker | null) => {
          if (!worker || watched.has(worker)) return
          watched.add(worker)
          record("worker", worker.state)
          worker.addEventListener("statechange", () => record("worker", worker.state))
        }
        watch(registration.installing)
        watch(registration.waiting)
        watch(registration.active)
        registration.addEventListener("updatefound", () => {
          record("updatefound")
          watch(registration.installing)
        })
        return registration
      }, (error: unknown) => {
        record("register-rejected")
        throw error
      })
    }
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      record("controllerchange", navigator.serviceWorker.controller?.state)
    })
  })
  return async () => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const evidence = await Promise.race([
        page.evaluate(() => ({
          events: (window as Window & { __firstInstallEvents?: unknown }).__firstInstallEvents,
          controller: navigator.serviceWorker?.controller?.state ?? null,
          readyNotice: !!document.querySelector('[data-testid="offline-notice"]'),
        })).catch(() => ({ unavailable: "page snapshot failed" })),
        new Promise((resolve) => { timer = setTimeout(() => resolve({ unavailable: "snapshot timed out" }), 1000) }),
      ])
      await info.attach(attachmentName, {
        body: JSON.stringify(evidence), contentType: "application/json",
      })
    } catch {
      // Diagnostics must never replace the original navigation/assertion failure.
      info.annotations.push({ type: "diagnostic", description: "First-install evidence unavailable" })
    } finally {
      clearTimeout(timer)
    }
  }
}
