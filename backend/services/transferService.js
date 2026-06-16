import logger from "../config/logger.js";

class TransferService {
  constructor() {
    this.metadata = new Map();
  }

  createTransfer(roomId, files, password) {
    const id = roomId;
    const createdAt = Date.now();
    const entry = {
      id,
      files,
      password: password || null,
      createdAt,
      expiresAt: createdAt + 3600000,
      downloadCount: 0,
      maxDownloads: 0,
    };
    this.metadata.set(id, entry);
    return entry;
  }

  getTransfer(roomId) {
    const entry = this.metadata.get(roomId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.metadata.delete(roomId);
      return null;
    }
    return { ...entry, password: !!entry.password };
  }

  verifyPassword(roomId, password) {
    const entry = this.metadata.get(roomId);
    if (!entry) return false;
    if (!entry.password) return true;
    return entry.password === password;
  }

  incrementDownloads(roomId) {
    const entry = this.metadata.get(roomId);
    if (!entry) return;
    entry.downloadCount++;
    if (entry.maxDownloads > 0 && entry.downloadCount >= entry.maxDownloads) {
      this.metadata.delete(roomId);
      logger.info({ roomId }, "Transfer deleted (max downloads reached)");
    }
  }
}

export const transferService = new TransferService();
