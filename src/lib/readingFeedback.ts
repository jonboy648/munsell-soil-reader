// Review notes are stored separately from the Log. Saving feedback also keeps a snapshot of
// that reading, so an unsaved trial can be found later. No photos or network requests.
import type { SavedReading } from "./log"

export const RATINGS = { good: "Good", off: "Off", unsure: "Not sure" } as const
export type Rating = keyof typeof RATINGS
export interface Feedback {
  id: string
  at: number
  rating: Rating
  note: string
}
export interface ReviewedReading {
  id: string
  reading: SavedReading
  feedback: Feedback[]
}

let connection: Promise<IDBDatabase> | undefined
const changed = new EventTarget()
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("munsell-reading-feedback")
channel?.addEventListener("message", () => changed.dispatchEvent(new Event("change")))

function open(): Promise<IDBDatabase> {
  if (connection) return connection
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("munsell-reading-feedback", 1)
    request.onupgradeneeded = () => request.result.createObjectStore("readings", { keyPath: "id" })
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("Close older tabs and try again."))
    request.onsuccess = () => {
      const db = request.result
      db.onclose = db.onversionchange = () => { connection = undefined; db.close() }
      resolve(db)
    }
  })
  connection = pending
  pending.catch(() => { if (connection === pending) connection = undefined })
  return pending
}

/** Refreshes both this tab's panels and other tabs after a committed feedback write. */
export function watchFeedback(onChange: () => void): () => void {
  const visible = () => { if (document.visibilityState === "visible") onChange() }
  changed.addEventListener("change", onChange)
  document.addEventListener("visibilitychange", visible)
  return () => {
    changed.removeEventListener("change", onChange)
    document.removeEventListener("visibilitychange", visible)
  }
}

export async function listReviewedReadings(): Promise<ReviewedReading[]> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction("readings", "readonly")
    const get = tx.objectStore("readings").getAll()
    tx.oncomplete = () => resolve(get.result as ReviewedReading[])
    tx.onerror = tx.onabort = () => reject(tx.error)
  })
}

/** One panel reads only its own feedback, rather than cloning every saved snapshot. */
export async function feedbackForReading(id: string): Promise<Feedback[]> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction("readings", "readonly")
    const get = tx.objectStore("readings").get(id)
    tx.oncomplete = () => resolve((get.result as ReviewedReading | undefined)?.feedback ?? [])
    tx.onerror = tx.onabort = () => reject(tx.error)
  })
}

/** Append in one transaction: concurrent reviewers never overwrite each other's notes. */
export async function addReadingFeedback(reading: SavedReading, rating: Rating, note: string): Promise<void> {
  if (!Object.hasOwn(RATINGS, rating) || note.length > 1000) throw new Error("Invalid feedback")
  const feedback: Feedback = { id: crypto.randomUUID(), at: Date.now(), rating, note: note.trim() }
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("readings", "readwrite")
    const store = tx.objectStore("readings")
    const get = store.get(reading.id)
    get.onsuccess = () => {
      const previous = get.result as ReviewedReading | undefined
      store.put({ id: reading.id, reading: previous?.reading ?? reading, feedback: [...(previous?.feedback ?? []), feedback] })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(tx.error)
  })
  changed.dispatchEvent(new Event("change"))
  channel?.postMessage("changed")
}
