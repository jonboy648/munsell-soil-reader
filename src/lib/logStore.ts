// The Log on disk: IndexedDB object stores holding whole Samples (Readings included) and whole
// Projects (Sampling points and Layers included). IndexedDB is the browser's own database on this
// device; nothing here leaves it.
//
// Every change is one read-modify-write inside a single transaction and carries only the
// change, so a second tab or window can never have its Readings overwritten by a copy of the
// Sample that was loaded earlier.
import { cmSampleToInches, type Sample, type SampleFields, type SavedReading } from "@/lib/log"

const DB_NAME = "munsell-soil-reader"
/**
 * Version 1 held Samples with depths in centimeters. Version 2 holds depths in inches, and
 * Projects beside the Samples.
 */
const DB_VERSION = 2
const SAMPLES = "samples"
export const PROJECTS = "projects"

let opened: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  if (opened) return opened
  const connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      const db = request.result
      if (event.oldVersion < 1) db.createObjectStore(SAMPLES, { keyPath: "id" })
      if (event.oldVersion < 2) db.createObjectStore(PROJECTS, { keyPath: "id" })
      // A Log made before version 2 has centimeters in it. Turn each Sample's depths into inches,
      // here, inside the upgrade, so it happens once and a failure leaves the old Log as it was.
      if (event.oldVersion === 1) {
        const cursor = request.transaction!.objectStore(SAMPLES).openCursor()
        cursor.onsuccess = () => {
          if (!cursor.result) return
          cursor.result.update(cmSampleToInches(cursor.result.value as Sample))
          cursor.result.continue()
        }
      }
    }
    request.onsuccess = () => {
      const db = request.result
      // The browser can drop the connection (iOS does when the app is backgrounded), and the
      // database can be deleted or cleared under us. Either way, connect afresh next time.
      db.onclose = db.onversionchange = () => {
        if (opened === connection) opened = undefined
        db.close()
      }
      resolve(db)
    }
    request.onerror = () => reject(request.error)
  })
  opened = connection
  connection.catch(() => {
    if (opened === connection) opened = undefined // so a later call can try again
  })
  return connection
}

/** Tells the other tabs and windows of this app that the Log changed. */
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("munsell-soil-log")

/** Calls `onChange` when another tab or window changes the Log, and when this one is shown again. */
export function watchLog(onChange: () => void): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange()
  }
  document.addEventListener("visibilitychange", onVisible)
  channel?.addEventListener("message", onChange)
  return () => {
    document.removeEventListener("visibilitychange", onVisible)
    channel?.removeEventListener("message", onChange)
  }
}

/**
 * Runs `work` on an object store in one transaction. `work` starts its requests and returns a
 * function that reads the result once the transaction has committed, so a reload sees it.
 */
export async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => () => T,
  retry = true,
): Promise<T> {
  try {
    const db = await open()
    const value = await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode)
      const result = work(tx.objectStore(store))
      tx.oncomplete = () => resolve(result())
      tx.onerror = tx.onabort = () => reject(tx.error ?? new DOMException("The Log could not be written", "AbortError"))
    })
    if (mode === "readwrite") channel?.postMessage("changed")
    return value
  } catch (error) {
    // A connection that went stale shows up as one of these. Reconnect and try once more.
    const stale = error instanceof DOMException && (error.name === "InvalidStateError" || error.name === "UnknownError")
    if (!retry || !stale) throw error
    opened = undefined
    return run(store, mode, work, false)
  }
}

/** Reads a Sample, changes it, and writes it back in one transaction. Resolves undefined when the Sample is gone. */
const modify = (id: string, change: (sample: Sample) => Sample): Promise<Sample | undefined> =>
  run(SAMPLES, "readwrite", (store) => {
    let updated: Sample | undefined
    const get = store.get(id)
    get.onsuccess = () => {
      if (get.result) store.put((updated = change(get.result as Sample)))
    }
    return () => updated
  })

export const listSamples = (): Promise<Sample[]> =>
  run(SAMPLES, "readonly", (store) => {
    const request = store.getAll()
    return () => request.result as Sample[]
  })

export const addSample = (sample: Sample): Promise<void> =>
  run(SAMPLES, "readwrite", (store) => {
    store.put(sample)
    return () => undefined
  })

export const deleteSample = (id: string): Promise<void> =>
  run(SAMPLES, "readwrite", (store) => {
    store.delete(id)
    return () => undefined
  })

export const addReadings = (id: string, readings: SavedReading[]) =>
  modify(id, (sample) => ({ ...sample, readings: [...sample.readings, ...readings] }))

export const updateFields = (id: string, fields: Partial<SampleFields>) => modify(id, (sample) => ({ ...sample, ...fields }))

export const removeReading = (id: string, readingId: string) =>
  modify(id, (sample) => ({ ...sample, readings: sample.readings.filter((r) => r.id !== readingId) }))

export const removeLocation = (id: string) => modify(id, (sample) => ({ ...sample, location: null }))

let askedToKeep = false

/** Asks the browser not to erase the Log on its own. Once per page load, after the first save. */
export function askToKeepLog(): void {
  if (askedToKeep) return
  askedToKeep = true
  try {
    navigator.storage?.persist?.().catch(() => {})
  } catch {
    // Nothing to do: the Log stays as evictable as the browser makes it.
  }
}
