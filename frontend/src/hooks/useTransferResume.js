import { useCallback } from "react";
import { getReceiverState } from "../utils/transferState.js";
import { TRANSFER_EVENTS } from "../constants.js";

export function useTransferResume(dcRef) {
  const requestResume = useCallback((fileName) => {
    const state = getReceiverState(fileName);
    if (!state || !dcRef.current) return null;
    const missing = [];
    for (let i = 0; i < state.receivedChunks.length; i++) {
      if (!state.receivedChunks.includes(i)) missing.push(i);
    }
    dcRef.current.send(JSON.stringify({
      type: TRANSFER_EVENTS.REQUEST_RESUME,
      fileName,
      missingChunks: missing,
    }));
    return missing;
  }, [dcRef]);

  return { requestResume };
}
