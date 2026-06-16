import { describe, it, expect } from "vitest";
import { Reassembler } from "../src/utils/reassembler.js";
import { computeSHA256 } from "../src/utils/chunker.js";

describe("Reassembler", () => {
  it("should track progress", () => {
    const r = new Reassembler({ name: "test.txt", size: 50000, type: "text/plain" });
    expect(r.getProgress().received).toBe(0);
    expect(r.getProgress().total).toBeGreaterThan(1);
    expect(r.isComplete()).toBe(false);
  });

  it("should report missing chunks", () => {
    const r = new Reassembler({ name: "test.txt", size: 50000, type: "text/plain" });
    const missing = r.getMissingChunks();
    expect(missing.length).toBe(r.totalChunks);
  });

  it("should verify chunk integrity", async () => {
    const r = new Reassembler({ name: "test.txt", size: 10, type: "text/plain" });
    const data = new TextEncoder().encode("Hello World").buffer;
    const hash = await computeSHA256(data);

    await r.addChunk(0, data, hash);
    expect(r.hasChunk(0)).toBe(true);
    expect(r.getProgress().received).toBe(1);
  });

  it("should reject chunks with wrong hash", async () => {
    const r = new Reassembler({ name: "test.txt", size: 10, type: "text/plain" });
    const data = new TextEncoder().encode("Hello World").buffer;

    await expect(
      r.addChunk(0, data, "wronghash")
    ).rejects.toThrow("integrity check failed");
  });

  it("should serialize and restore state", () => {
    const r = new Reassembler({ name: "test.txt", size: 50000, type: "text/plain" });
    const state = r.getState();
    expect(state.metadata.name).toBe("test.txt");
    expect(Array.isArray(state.receivedChunks)).toBe(true);

    const r2 = new Reassembler({ name: "test.txt", size: 50000, type: "text/plain" });
    r2.restoreState(state);
    expect(r2.receivedChunks.size).toBe(0);
  });

  it("should assemble blob when complete", async () => {
    const content = "Hello World";
    const r = new Reassembler({ name: "test.txt", size: content.length, type: "text/plain" });
    const data = new TextEncoder().encode(content).buffer;
    const hash = await computeSHA256(data);

    await r.addChunk(0, data, hash);
    const blob = r.assemble();
    expect(blob).not.toBeNull();
    expect(blob.size).toBe(content.length);
  });
});
