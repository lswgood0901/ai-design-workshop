const NAME = "ai-design-workshop-history";
const STORE = "images";
let database;
export function openHistory() {
  if (database) return Promise.resolve(database);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => { database = request.result; resolve(database); };
    request.onerror = () => reject(request.error);
  });
}
async function transaction(mode, operation) {
  const db = await openHistory();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = operation(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("기록을 저장하지 못했습니다."));
  });
}
export async function listHistory() {
  const records = await transaction("readonly", store => store.getAll());
  return records.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export const saveHistory = record => transaction("readwrite", store => store.put(record));
export const deleteHistory = id => transaction("readwrite", store => store.delete(id));
