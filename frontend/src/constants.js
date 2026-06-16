export const CHUNK_SIZE = 16384;

export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: "turn:localhost:3478",
    username: "sharesharp",
    credential: "sharesharp-turn-secret",
  },
];

export const TRANSFER_EVENTS = {
  FILE_META: "file-meta",
  CHUNK: "chunk",
  CHUNK_ACK: "chunk-ack",
  TRANSFER_COMPLETE: "transfer-complete",
  TRANSFER_ERROR: "transfer-error",
  REQUEST_RESUME: "request-resume",
  RESUME_STATE: "resume-state",
};
