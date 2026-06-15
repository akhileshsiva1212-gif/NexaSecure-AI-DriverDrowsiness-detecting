// Client-side persistence for the driver's uploaded wake-up audio.
//
// The uploaded MP3/WAV blob never leaves the browser (privacy-first), so it can't live on the
// backend. We keep it in IndexedDB so it survives reloads. The backend only stores *which*
// option is selected and the file's display name (see features/mood on the server).

const DB_NAME = 'nexa-mood'
const STORE = 'audio'
const KEY = 'uploaded'
const DB_VERSION = 1

export interface StoredAudio {
  blob: Blob
  name: string
  type: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveUploadedAudio(blob: Blob, name: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ blob, name, type: blob.type } satisfies StoredAudio, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadUploadedAudio(): Promise<StoredAudio | null> {
  const db = await openDb()
  const result = await new Promise<StoredAudio | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve((req.result as StoredAudio) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return result
}

export async function clearUploadedAudio(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
