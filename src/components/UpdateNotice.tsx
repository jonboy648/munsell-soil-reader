import { useRegisterSW } from "virtual:pwa-register/react"
import { Button } from "@/components/ui/button"

/**
 * Registers the service worker and, when a new version of the app has been downloaded in the
 * background, asks the user to reload into it. The old version keeps working until they tap
 * Reload (or close the app), so an update never interrupts a Reading.
 */
export function UpdateNotice() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // A phone can keep the app open in the background for days without a new page load, so
      // look for a new version whenever the app comes back to the front.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          // Offline, the check fails; the next one will do.
          registration?.update().catch(() => {})
        }
      })
    },
  })

  if (!needRefresh) return null
  return (
    <div className="fixed inset-x-0 top-0 z-20 mx-auto max-w-xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div
        role="status"
        data-testid="update-notice"
        className="flex items-center justify-between gap-3 rounded-md border-2 border-foreground bg-card p-3 text-sm font-medium"
      >
        <span>A new version is ready.</span>
        <Button size="lg" onClick={() => void updateServiceWorker(true)}>
          Reload
        </Button>
      </div>
    </div>
  )
}
