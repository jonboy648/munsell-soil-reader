import { Button } from "@/components/ui/button"
import { isIosBrowserTab } from "@/lib/ios"
import { useServiceWorker } from "@/lib/serviceWorker"

/**
 * What the service worker has to tell the user: the app now works offline, and a new version is
 * ready. It sits inside the header and replaces the title while it shows, so it is exactly as
 * big as the title was: nothing below it, the step indicator and the Photo included, moves or is
 * covered, and a tap never lands somewhere other than where the user aimed. Reload throws away
 * the Photo and the taps made on it, so with a Photo loaded the notice says so, and "Later" puts
 * it away until the app next comes back to the front. Render it inside a `relative` header.
 */
export function UpdateNotice({ hasPhoto }: { hasPhoto: boolean }) {
  const { offlineReady, updateReady, dismissOfflineReady, dismissUpdate, reload } =
    useServiceWorker()
  if (!updateReady && !offlineReady) return null

  return (
    <div
      role="status"
      data-testid={updateReady ? "update-notice" : "offline-notice"}
      className="absolute inset-0 z-20 flex items-center gap-2 border-b-2 border-foreground bg-card px-4 pt-[env(safe-area-inset-top)] text-sm"
    >
      <div className="min-w-0 flex-1 leading-tight">
        {updateReady ? (
          <>
            <p className="font-medium">Update ready.</p>
            {hasPhoto && <p className="text-xs text-muted-foreground">Reload clears this Photo.</p>}
          </>
        ) : (
          <>
            <p className="font-medium">Ready to work offline.</p>
            {isIosBrowserTab() && (
              <p className="text-xs text-muted-foreground">
                Home Screen: open it once online.
              </p>
            )}
          </>
        )}
      </div>
      {updateReady ? (
        <>
          <Button size="lg" className="h-11" onClick={reload}>
            Reload
          </Button>
          <Button size="lg" variant="outline" className="h-11" onClick={dismissUpdate}>
            Later
          </Button>
        </>
      ) : (
        <Button size="lg" className="h-11" onClick={dismissOfflineReady}>
          OK
        </Button>
      )}
    </div>
  )
}
