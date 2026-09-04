import { describe, it, expect, beforeEach } from "vitest";
import {
  encryptDraft,
  decryptDraft,
  getRawDraftKeyStorageForTesting,
  clearKeyStoreForTesting,
} from "@workspace/browser-backend";

const mockStore = new Map<string, any>();

// Polyfill global indexedDB for vitest environment if missing
if (!globalThis.indexedDB) {
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
            clear: () => {
              const req: any = {};
              setTimeout(() => {
                mockStore.clear();
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
            },
          };
          store.transaction = tx;
          return store;
        },
      };
      return tx;
    },
    createObjectStore: () => {},
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
    },
  };
}

describe("Draft Key Storage Encryption (M6)", () => {
  beforeEach(async () => {
    mockStore.clear();
    await clearKeyStoreForTesting();
  });

  it("encrypts and decrypts draft payloads round-trip", async () => {
    const draftPayload = JSON.stringify({
      nodes: [{ id: "n1", x: 100, y: 100, gender: "male" }],
      edges: [],
    });

    const encrypted = await encryptDraft(draftPayload);
    expect(typeof encrypted).toBe("string");
    expect(encrypted).not.toContain("gender");

    const decrypted = await decryptDraft(encrypted);
    expect(decrypted).toBe(draftPayload);
  });

  it("stores draft encryption key wrapped/encrypted in IndexedDB, not as raw 32-byte plaintext", async () => {
    await encryptDraft("sample draft content");

    const storedKey = await getRawDraftKeyStorageForTesting();
    expect(storedKey).toBeDefined();
    // Verify it is stored as an encrypted object with ciphertext + iv, NOT a raw Uint8Array
    expect(typeof storedKey).toBe("object");
    expect(storedKey.ciphertext).toBeInstanceOf(Uint8Array);
    expect(storedKey.iv).toBeInstanceOf(Uint8Array);
    expect(storedKey).not.toBeInstanceOf(Uint8Array);
  });
});
