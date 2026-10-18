/** Hands a file to the browser as a download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000) // not at once: some browsers still need it
}

/** True when the browser's share sheet can take a file of this type. */
export function canShareFile(type: string): boolean {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([], "x", { type })] })
}

/** Opens the share sheet with the file; resolves quietly when the user closes it without choosing. */
export async function shareFile(blob: Blob, filename: string, title: string): Promise<void> {
  try {
    await navigator.share({ files: [new File([blob], filename, { type: blob.type })], title })
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) throw error
  }
}
