import { CHUNK_SIZE } from "../constants.js";

export async function* chunkFile(file) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);
    const buffer = await blob.arrayBuffer();
    const hash = await computeSHA256(buffer);
    yield {
      index: i,
      data: buffer,
      hash,
      totalChunks,
    };
  }
}

export async function computeSHA256(buffer) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeFileHash(file) {
  const buffer = await file.arrayBuffer();
  return computeSHA256(buffer);
}

export function getFileMetadata(file) {
  return {
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  };
}
