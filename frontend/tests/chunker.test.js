import { describe, it, expect } from "vitest";
import { chunkFile, computeSHA256 } from "../src/utils/chunker.js";

describe("chunker", () => {
  it("should compute SHA-256 hash", async () => {
    const buffer = new TextEncoder().encode("hello world").buffer;
    const hash = await computeSHA256(buffer);
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });

  it("should yield chunks for a file", async () => {
    const content = "a".repeat(50000);
    const file = new File([content], "test.txt", { type: "text/plain" });

    const chunks = [];
    for await (const chunk of chunkFile(file)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].hash).toBeDefined();
    expect(chunks[0].totalChunks).toBe(chunks.length);
  });

  it("should yield a single chunk for small files", async () => {
    const file = new File(["hello"], "small.txt", { type: "text/plain" });

    const chunks = [];
    for await (const chunk of chunkFile(file)) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(1);
    expect(chunks[0].index).toBe(0);
  });
});
