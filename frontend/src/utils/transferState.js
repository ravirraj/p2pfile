const STORAGE_PREFIX = "peerflow-transfer-";

export function saveTransferState(fileName, state) {
  try {
    const key = STORAGE_PREFIX + fileName;
    const data = JSON.stringify({
      ...state,
      timestamp: Date.now(),
    });
    localStorage.setItem(key, data);
  } catch {
    // storage full or unavailable
  }
}

export function getTransferState(fileName) {
  try {
    const key = STORAGE_PREFIX + fileName;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.timestamp > 86400000) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearTransferState(fileName) {
  localStorage.removeItem(STORAGE_PREFIX + fileName);
}

export function getSenderState(fileName) {
  const state = getTransferState(fileName);
  return state?.role === "sender" ? state : null;
}

export function getReceiverState(fileName) {
  const state = getTransferState(fileName);
  return state?.role === "receiver" ? state : null;
}
