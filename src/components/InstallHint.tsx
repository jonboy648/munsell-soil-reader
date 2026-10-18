import { isIosBrowserTab } from "@/lib/ios"

// Nothing in the page can add itself to the Home Screen or open the new icon once with signal,
// so say it. Safari is named because other iOS browsers, and the browsers inside other apps,
// differ in how (or whether) they add a page to the Home Screen.
export function InstallHint() {
  if (!isIosBrowserTab()) return null
  return (
    <p className="px-2 text-sm text-muted-foreground" data-testid="install-hint">
      On iPhone or iPad: open this page in Safari, tap Share, then Add to Home Screen, and open the
      icon once with signal to use it offline.
    </p>
  )
}
