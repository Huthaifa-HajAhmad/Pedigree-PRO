import { describe, it, expect, vi } from "vitest";
import {
  computeHash, generateEd25519Keypair, signData, verifySignature,
  encryptAesGcm, decryptAesGcm, deriveKeyFromPassphrase,
  getPublicKeyFromPrivate, generateSymmetricKey,
  sodiumSealBox, sodiumOpenSealedBox,
} from "@workspace/crypto";
import { storeProfilePrivateKey, getProfilePrivateKey, listProfilePrivateKeys } from "@workspace/browser-backend";

const mockStore = new Map<string, any>();

// Polyfill global indexedDB for vitest environment
const dbMock: any = {
  transaction: () => {
    const tx: any = {
      objectStore: () => {
        const store: any = {
          get: (key: string) => {
            const req: any = {};
            setTimeout(() => {
              req.result = mockStore.get(key);
              if (req.onsuccess) req.onsuccess();
              if (tx.oncomplete) tx.oncomplete();
            }, 0);
            return req;
          },
          put: (val: any, key: string) => {
            const req: any = {};
            setTimeout(() => {
              mockStore.set(key, val);
              if (req.onsuccess) req.onsuccess();
              if (tx.oncomplete) tx.oncomplete();
            }, 0);
            return req;
          },
          getAllKeys: () => {
            const req: any = {};
            setTimeout(() => {
              req.result = Array.from(mockStore.keys());
              if (req.onsuccess) req.onsuccess();
              if (tx.oncomplete) tx.oncomplete();
            }, 0);
            return req;
          }
        };
        store.transaction = tx;
        return store;
      }
    };
    return tx;
  },
  createObjectStore: () => {}
};

(globalThis as any).indexedDB = {
  open: () => {
    const requestMock: any = {
      result: dbMock,
    };
    setTimeout(() => {
      if (requestMock.onsuccess) requestMock.onsuccess();
    }, 0);
    return requestMock;
  }
};

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
    expect(kp.privateKey).toBeDefined();
    expect(kp.publicKey.length).toBeGreaterThan(0);
    expect(kp.privateKey.length).toBeGreaterThan(0);
  });

  it("signs and verifies a message round-trip", async () => {
    const kp = await generateEd25519Keypair();
    const message = "test-pedigree-data";
    const signature = await signData(message, kp.privateKey);
    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(0);
    const valid = await verifySignature(message, signature, kp.publicKey);
    expect(valid).toBe(true);
  });

  it("rejects signature from different keypair", async () => {
    const kp1 = await generateEd25519Keypair();
    const kp2 = await generateEd25519Keypair();
    const message = "test-pedigree-data";
    const signature = await signData(message, kp1.privateKey);
    const valid = await verifySignature(message, signature, kp2.publicKey);
    expect(valid).toBe(false);
  });

  it("rejects tampered message", async () => {
    const kp = await generateEd25519Keypair();
    const signature = await signData("original-message", kp.privateKey);
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
    const b = await deriveKeyFromPassphrase("test-passphrase", a.salt);
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

describe("getPublicKeyFromPrivate", () => {
  it("derives the same public key as generateEd25519Keypair", async () => {
    const kp = await generateEd25519Keypair();
    const derived = await getPublicKeyFromPrivate(kp.privateKey);
    expect(derived).toBe(kp.publicKey);
  });

  it("produces different public keys for different private keys", async () => {
    const kp1 = await generateEd25519Keypair();
    const kp2 = await generateEd25519Keypair();
    expect(kp1.publicKey).not.toBe(kp2.publicKey);
  });
});

describe("generateSymmetricKey", () => {
  it("produces a 32-byte key", () => {
    const key = generateSymmetricKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it("produces unique keys on each call", () => {
    const a = generateSymmetricKey();
    const b = generateSymmetricKey();
    expect(a).not.toEqual(b);
  });
});

describe("sodiumSealBox + sodiumOpenSealedBox", () => {
  it("encrypts and decrypts a message round-trip", async () => {
    const kp = await generateEd25519Keypair();
    const message = "test-pedigree-sharing-data";
    const sealed = await sodiumSealBox(message, kp.publicKey);
    expect(sealed).toBeDefined();
    expect(sealed.length).toBeGreaterThan(0);
    const decrypted = await sodiumOpenSealedBox(sealed, kp.privateKey);
    expect(decrypted).toBe(message);
  });

  it("fails to decrypt with wrong private key", async () => {
    const kp1 = await generateEd25519Keypair();
    const kp2 = await generateEd25519Keypair();
    const sealed = await sodiumSealBox("secret-message", kp1.publicKey);
    await expect(sodiumOpenSealedBox(sealed, kp2.privateKey)).rejects.toThrow();
  });

  it("handles complex JSON data round-trip", async () => {
    const kp = await generateEd25519Keypair();
    const data = JSON.stringify({
      id: 1,
      title: "Test Pedigree",
      canvas_data: { nodes: [{ id: "n1", type: "male" }], edges: [] },
      creator_key: kp.publicKey,
    });
    const sealed = await sodiumSealBox(data, kp.publicKey);
    const decrypted = await sodiumOpenSealedBox(sealed, kp.privateKey);
    expect(decrypted).toBe(data);
    const parsed = JSON.parse(decrypted);
    expect(parsed.title).toBe("Test Pedigree");
  });

  it("produces different ciphertexts for same plaintext (ephemeral keypair)", async () => {
    const kp = await generateEd25519Keypair();
    const a = await sodiumSealBox("same-data", kp.publicKey);
    const b = await sodiumSealBox("same-data", kp.publicKey);
    expect(a).not.toBe(b);
  });
});

describe("Profile private key storage encryption", () => {
  it("stores private keys encrypted and recovers them successfully", async () => {
    const profileId = "profile-123";
    const privateKey = "my-super-secret-private-key";
    
    await storeProfilePrivateKey(profileId, privateKey);
    
    // The stored value should not be the plaintext key
    const rawVal = mockStore.get(`ppro:profile_private_key:${profileId}`);
    expect(rawVal).toBeDefined();
    expect(typeof rawVal).not.toBe("string");
    expect(rawVal.ciphertext).toBeDefined();
    expect(rawVal.iv).toBeDefined();
    
    // Retrieval should return the plaintext key
    const decrypted = await getProfilePrivateKey(profileId);
    expect(decrypted).toBe(privateKey);
    
    // Listing keys should also return the decrypted key
    const keys = await listProfilePrivateKeys();
    expect(keys).toContainEqual({ profileId, privateKey });
  });

  it("retains backwards compatibility with legacy plaintext keys", async () => {
    const profileId = "legacy-profile";
    const plaintextKey = "legacy-plaintext-private-key";
    
    // Manually insert legacy plaintext key into the mock store
    mockStore.set(`ppro:profile_private_key:${profileId}`, plaintextKey);
    
    // Retrieval should fall back to the legacy string value
    const decrypted = await getProfilePrivateKey(profileId);
    expect(decrypted).toBe(plaintextKey);
    
    // Listing keys should include the legacy entry
    const keys = await listProfilePrivateKeys();
    expect(keys).toContainEqual({ profileId, privateKey: plaintextKey });
  });
});