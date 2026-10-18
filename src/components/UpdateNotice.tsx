import { Button } from "@/components/ui/button"
import { isIosBrowserTab } from "@/lib/ios"
import { useServiceWorker } from "@/lib/serviceWorker"

/**
 * What the service worker has to tell the user: the app now works offline, and a new version is
 * ready. It sits in the page flow under the title, not over the Photo, so it never covers a tap.
 * Reload throws away the Photo and the taps made on it, so with a Photo loaded the button says
 * so, and "Later" puts the notice away until the app next comes back to the front.
 */
export function UpdateNotice({ hasPhoto }: { hasPhoto: boolean }) {
  const { offlineReady, updateReady, dismissOfflineReady, dismissUpdate, reload } =
    useServiceWorker()
  if (!updateReady && !offlineReady) return null

  return (
    <div className="px-4 pb-3">
      <div
        role="status"
        data-testid={updateReady ? "update-notice" : "offline-notice"}
        className="grid gap-3 rounded-md border-2 border-foreground bg-card p-3 text-sm font-medium"
      >
        {updateReady ? (
          <>
            <p>A new version is ready.</p>
            <div className="flex gap-2">
              <Button size="lg" className="h-11" onClick={reload}>
                {hasPhoto ? "Reload (clears this Photo)" : "Reload"}
              </Button>
              <Button size="lg" variant="outline" className="h-11" onClick={dismissUpdate}>
                Later
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>
              {isIosBrowserTab()
                ? "Ready to work offline in this browser. If you add it to the Home Screen, open the icon once with signal."
                : "Ready to work offline."}
            </p>
            <div className="flex">
              <Button size="lg" className="h-11" onClick={dismissOfflineReady}>
                OK
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
