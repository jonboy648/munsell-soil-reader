const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) // iPadOS sends a Mac user agent

const isInstalled = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  window.matchMedia("(display-mode: standalone)").matches

/**
 * True in a browser tab on iPhone or iPad, false in the app installed to the Home Screen. iOS
 * gives the installed app its own storage, apart from the browser's, so the offline copy a tab
 * downloaded is not there: the icon has to be opened once with signal.
 */
export const isIosBrowserTab = () => isIos() && !isInstalled()
