import { Button } from "@/components/ui/button"
import { useServiceWorker } from "@/lib/serviceWorker"

/**
 * The two things the service worker has to tell the user: the app now works offline, and a new
 * version is ready. Reload throws away the Photo and taps in progress, so it is only offered
 * when no Photo is loaded; otherwise the notice asks the user to finish first.
 */
export function UpdateNotice({ hasPhoto }: { hasPhoto: boolean }) {
  const { offlineReady, updateReady, dismissOfflineReady, reload } = useServiceWorker()
  if (!updateReady && !offlineReady) return null

  return (
    <div className="fixed inset-x-0 top-0 z-20 mx-auto max-w-xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div
        role="status"
        data-testid={updateReady ? "update-notice" : "offline-notice"}
        className="flex items-center justify-between gap-3 rounded-md border-2 border-foreground bg-card p-3 text-sm font-medium"
      >
        {updateReady ? (
          <>
            <span>
              {hasPhoto
                ? "A new version is ready. Reload clears the current Photo, so finish this one first, then reopen the app."
                : "A new version is ready."}
            </span>
            {!hasPhoto && (
              <Button size="lg" onClick={reload}>
                Reload
              </Button>
            )}
          </>
        ) : (
          <>
            <span>Ready to work offline.</span>
            <Button size="lg" onClick={dismissOfflineReady}>
              OK
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
