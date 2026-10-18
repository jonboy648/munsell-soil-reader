// iOS gives a home screen app its own storage, apart from Safari's, so the installed icon has
// to be opened once with signal before it works offline. Nothing in the page can do that for
// the user, so say it.
const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) // iPadOS sends a Mac user agent

const isInstalled = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches

export function InstallHint() {
  if (!isIos() || isInstalled()) return null
  return (
    <p className="px-2 text-sm text-muted-foreground" data-testid="install-hint">
      On iPhone or iPad: tap Share, then Add to Home Screen, and open the icon once with signal to
      use it offline.
    </p>
  )
}
