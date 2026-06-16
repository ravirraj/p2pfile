import { get, set, del, keys } from "idb-keyval";

const HISTORY_KEY = "sharesharp-transfer-history";

export async function addTransferToHistory(entry) {
  const list = await get(HISTORY_KEY) || [];
  list.unshift({
    ...entry,
    timestamp: Date.now(),
  });
  if (list.length > 50) list.length = 50;
  await set(HISTORY_KEY, list);
}

export async function getTransferHistory() {
  return (await get(HISTORY_KEY)) || [];
}

export async function clearTransferHistory() {
  await del(HISTORY_KEY);
}
