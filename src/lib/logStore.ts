// The Log on disk: one IndexedDB object store holding whole Samples, Readings included.
// IndexedDB is the browser's own database on this device; nothing here leaves it.
import type { Sample } from "@/lib/log"

const DB_NAME = "munsell-soil-reader"
const STORE = "samples"

let opened: Promise<IDBDatabase> | undefined

function open(): Promise<IDBDatabase> {
  opened ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch((error) => {
    opened = undefined // so a later call can try again
    throw error
  })
  return opened
}

/** Runs one request and resolves once the transaction is committed, so a reload sees it. */
async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = work(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = tx.onabort = () => reject(tx.error)
  })
}

export const listSamples = (): Promise<Sample[]> => run("readonly", (store) => store.getAll())
export const putSample = (sample: Sample): Promise<IDBValidKey> => run("readwrite", (store) => store.put(sample))
export const deleteSample = (id: string): Promise<undefined> => run("readwrite", (store) => store.delete(id))
