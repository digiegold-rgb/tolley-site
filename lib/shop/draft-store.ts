/**
 * IndexedDB draft store for /shop/admin/bulk-add.
 *
 * Every queued product's photo Blobs are written here the moment "Queue this
 * product" is tapped, so drafts survive tab reloads, mobile-Safari memory
 * discards, camera round-trips, and browser restarts — with or without
 * network. Drafts are cleared only after the server has confirmed the batch
 * (POST 200 + first successful poll).
 *
 * Blobs (not Files) are stored — Safari has historically had File-cloning
 * bugs in IDB; callers reconstruct File from { blob, name, type }.
 */

const DB_NAME = "tolley-bulk-add-drafts";
const DB_VERSION = 1;
const DRAFTS = "drafts";
const META = "meta";
const PENDING_KEY = "pendingBatch";

/** Reserved draft id for the in-progress, not-yet-queued group. */
export const CURRENT_DRAFT_ID = "__current__";

export interface DraftPhoto {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  thumbDataUrl: string;
}

export interface DraftGroup {
  id: string;
  createdAt: number;
  photos: DraftPhoto[];
}

export interface PendingBatch {
  batchId: string;
  submittedAt: number;
  groupIds: string[];
}

export class DraftStoreError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "DraftStoreError";
    this.cause = cause;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new DraftStoreError("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DRAFTS)) {
        db.createObjectStore(DRAFTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new DraftStoreError("failed to open draft DB", req.error));
    req.onblocked = () => reject(new DraftStoreError("draft DB open blocked"));
  });
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = run(t.objectStore(store));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(new DraftStoreError("draft DB transaction failed", t.error));
      t.onabort = () => reject(new DraftStoreError("draft DB transaction aborted", t.error));
    });
  } finally {
    db.close();
  }
}

export async function saveDraft(group: DraftGroup): Promise<void> {
  await tx(DRAFTS, "readwrite", (s) => s.put(group));
}

export async function deleteDraft(id: string): Promise<void> {
  await tx(DRAFTS, "readwrite", (s) => s.delete(id));
}

/** All saved drafts, oldest first. Includes the "__current__" group if present. */
export async function loadDrafts(): Promise<DraftGroup[]> {
  const all = await tx<DraftGroup[]>(DRAFTS, "readonly", (s) => s.getAll());
  return (all ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function clearAllDrafts(): Promise<void> {
  await tx(DRAFTS, "readwrite", (s) => s.clear());
}

export async function savePendingBatch(p: PendingBatch): Promise<void> {
  await tx(META, "readwrite", (s) => s.put({ key: PENDING_KEY, ...p }));
}

export async function loadPendingBatch(): Promise<PendingBatch | null> {
  const row = await tx<(PendingBatch & { key: string }) | undefined>(META, "readonly", (s) =>
    s.get(PENDING_KEY)
  );
  if (!row) return null;
  const { batchId, submittedAt, groupIds } = row;
  return { batchId, submittedAt, groupIds };
}

export async function clearPendingBatch(): Promise<void> {
  await tx(META, "readwrite", (s) => s.delete(PENDING_KEY));
}

/** Ask the browser not to evict our storage. Best-effort; heuristic on iOS. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
