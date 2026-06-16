import { computeSHA256 } from "./chunker.js";

export class Reassembler {
  constructor(metadata) {
    this.metadata = metadata;
    this.chunks = new Map();
    this.totalChunks = Math.ceil(metadata.size / 16384);
    this.receivedChunks = new Set();
  }

  getMissingChunks() {
    const missing = [];
    for (let i = 0; i < this.totalChunks; i++) {
      if (!this.receivedChunks.has(i)) missing.push(i);
    }
    return missing;
  }

  async addChunk(index, data, expectedHash) {
    const actualHash = await computeSHA256(data);
    if (actualHash !== expectedHash) {
      throw new Error(`Chunk ${index} integrity check failed`);
    }
    this.chunks.set(index, data);
    this.receivedChunks.add(index);
  }

  hasChunk(index) {
    return this.receivedChunks.has(index);
  }

  getProgress() {
    return {
      received: this.receivedChunks.size,
      total: this.totalChunks,
      percent: Math.round((this.receivedChunks.size / this.totalChunks) * 100),
    };
  }

  isComplete() {
    return this.receivedChunks.size === this.totalChunks;
  }

  assemble() {
    if (!this.isComplete()) return null;
    const sorted = [];
    for (let i = 0; i < this.totalChunks; i++) {
      sorted.push(this.chunks.get(i));
    }
    return new Blob(sorted, { type: this.metadata.type });
  }

  getState() {
    return {
      metadata: this.metadata,
      receivedChunks: Array.from(this.receivedChunks),
    };
  }

  restoreState(state) {
    this.receivedChunks = new Set(state.receivedChunks);
  }
}
