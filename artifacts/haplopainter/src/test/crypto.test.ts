import { describe, it, expect } from "vitest";
import {
  computeHash, generateEd25519Keypair, signData, verifySignature,
  encryptAesGcm, decryptAesGcm, deriveKeyFromPassphrase,
} from "@workspace/crypto";

describe("computeHash (SHA-256)", () => {
  it("produces a 64-character hex digest", () => {
    const hash = computeHash("hello world");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    const a = computeHash("pedigree-canvas-data");
    const b = computeHash("pedigree-canvas-data");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", () => {
    const a = computeHash("canvas-v1");
    const b = computeHash("canvas-v2");
    expect(a).not.toBe(b);
  });

  it("handles empty string", () => {
    const hash = computeHash("");
    expect(hash).toHaveLength(64);
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("generateEd25519Keypair + signData + verifySignature", () => {
  it("produces a valid keypair with public and secret keys", async () => {
    const kp = await generateEd25519Keypair();
    expect(kp.publicKey).toBeDefined();
    expect(kp.secretKey).toBeDefined();
    expect(kp.publicKey.length).toBeGreaterThan(0);
    expect(kp.secretKey.length).toBeGreaterThan(0);
  });

  it("signs and verifies a message round-trip", async () => {
    const kp = await generateEd25519Keypair();
    const message = "test-pedigree-data";
    const signature = await signData(message, kp.secretKey);
    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(0);
    const valid = await verifySignature(message, signature, kp.publicKey);
    expect(valid).toBe(true);
  });

  it("rejects signature from different keypair", async () => {
    const kp1 = await generateEd25519Keypair();
    const kp2 = await generateEd25519Keypair();
    const message = "test-pedigree-data";
    const signature = await signData(message, kp1.secretKey);
    const valid = await verifySignature(message, signature, kp2.publicKey);
    expect(valid).toBe(false);
  });

  it("rejects tampered message", async () => {
    const kp = await generateEd25519Keypair();
    const signature = await signData("original-message", kp.secretKey);
    const valid = await verifySignature("tampered-message", signature, kp.publicKey);
    expect(valid).toBe(false);
  });
});

describe("encryptAesGcm + decryptAesGcm", () => {
  it("encrypts and decrypts a message round-trip", async () => {
    const key = new Uint8Array(32);
    crypto.getRandomValues(key);
    const message = JSON.stringify({ nodes: [{ id: "n1", type: "male" }], edges: [] });
    const { ciphertext, nonce } = await encryptAesGcm(message, key);
    expect(ciphertext).toBeDefined();
    expect(nonce).toBeDefined();
    const decrypted = await decryptAesGcm(ciphertext, nonce, key);
    expect(decrypted).toBe(message);
  });

  it("fails to decrypt with wrong key", async () => {
    const key1 = new Uint8Array(32);
    crypto.getRandomValues(key1);
    const key2 = new Uint8Array(32);
    crypto.getRandomValues(key2);
    const { ciphertext, nonce } = await encryptAesGcm("secret-data", key1);
    await expect(decryptAesGcm(ciphertext, nonce, key2)).rejects.toThrow();
  });

  it("produces different ciphertexts for same plaintext (different nonces)", async () => {
    const key = new Uint8Array(32);
    crypto.getRandomValues(key);
    const a = await encryptAesGcm("same-data", key);
    const b = await encryptAesGcm("same-data", key);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});

describe("deriveKeyFromPassphrase", () => {
  it("produces deterministic output with same passphrase and salt", async () => {
    const a = await deriveKeyFromPassphrase("test-passphrase");
    const b = await deriveKeyFromPassphrase("test-passphrase");
    expect(a.derivedKey).toBe(b.derivedKey);
    expect(a.salt).toBe(b.salt);
  });

  it("produces different derived keys for different passphrases", async () => {
    const a = await deriveKeyFromPassphrase("passphrase-one");
    const b = await deriveKeyFromPassphrase("passphrase-two");
    expect(a.derivedKey).not.toBe(b.derivedKey);
  });

  it("produces a non-empty salt and derived key", async () => {
    const result = await deriveKeyFromPassphrase("any-passphrase");
    expect(result.salt.length).toBeGreaterThan(0);
    expect(result.derivedKey.length).toBeGreaterThan(0);
  });
});