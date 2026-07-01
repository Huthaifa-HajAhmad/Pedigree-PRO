/**
 * Pedigree PRO — Browser Backend Crypto Store
 *
 * Manages encryption keys for the sql.js database using Web Crypto API.
 * In browser mode there is no OS keychain, so keys are stored in IndexedDB.
 * Users may optionally protect keys with a passphrase.
 */

import { get, set, del, createStore } from "idb-keyval";
import { encryptAesGcm, decryptAesGcm } from "@workspace/crypto";

const KEY_STORE = createStore("pedigree-pro-keys", "keys");
const DB_KEY_NAME = "db-encryption-key";
const PASSPHRASE_SALT_NAME = "passphrase-salt";

/**
 * Converts a Uint8Array to an ArrayBuffer for Web Crypto API consumption.
 * Handles the TypeScript 5.9 Uint8Array<ArrayBuffer> generic correctly.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * Generates a random 256-bit AES key for database encryption.
 */
async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Generates a random 256-bit AES key for key wrapping (AES-KW).
 */
async function generateWrappingKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-KW", length: 256 }, true, [
    "wrapKey",
    "unwrapKey",
  ]);
}

/**
 * Derives an AES key from a passphrase using PBKDF2-HMAC-SHA512.
 */
async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: 256_000,
      hash: "SHA-512",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports a CryptoKey to raw bytes.
 */
async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

/**
 * Imports raw bytes to a wrapping CryptoKey (AES-KW).
 */
async function importWrappingKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(raw), "AES-KW", true, [
    "wrapKey",
    "unwrapKey",
  ]);
}

/**
 * Wraps a key with another key using AES-KW.
 */
async function wrapKey(
  keyToWrap: CryptoKey,
  wrappingKey: CryptoKey
): Promise<Uint8Array> {
  const wrapped = await crypto.subtle.wrapKey("raw", keyToWrap, wrappingKey, {
    name: "AES-KW",
  });
  return new Uint8Array(wrapped);
}

/**
 * Unwraps a key with another key using AES-KW.
 */
async function unwrapKey(
  wrappedKey: Uint8Array,
  wrappingKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    toArrayBuffer(wrappedKey),
    wrappingKey,
    { name: "AES-KW" },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Gets or creates the database encryption key.
 * If a passphrase is provided, the key is derived from it.
 * Otherwise, a random key is generated and stored in IndexedDB.
 */
export async function getOrCreateDbKey(
  passphrase?: string
): Promise<CryptoKey> {
  if (passphrase) {
    let salt = await get<Uint8Array>(PASSPHRASE_SALT_NAME, KEY_STORE);
    if (!salt) {
      salt = crypto.getRandomValues(new Uint8Array(32));
      await set(PASSPHRASE_SALT_NAME, salt, KEY_STORE);
    }
    return deriveKeyFromPassphrase(passphrase, salt);
  }

  // No passphrase: wrap the DB key with a randomly generated wrapping key before storing
  // SECURITY NOTE: When no passphrase is set, both the wrapping key and the wrapped DB key
  // are stored side-by-side in IndexedDB. This provides at-rest obfuscation only, NOT
  // confidentiality. An attacker with IndexedDB access can trivially unwrap the key.
  // For real protection, require a passphrase or use WebAuthn-derived keys.
  const stored = await get<{ wrappedKey: Uint8Array; wrappingKey: Uint8Array } | null>(
    DB_KEY_NAME,
    KEY_STORE
  );
  if (stored) {
    try {
      const wrappingKey = await importWrappingKey(stored.wrappingKey);
      return unwrapKey(stored.wrappedKey, wrappingKey);
    } catch {
      // Old key was stored with wrong algorithm (AES-GCM instead of AES-KW).
      // Clear it and generate a new one.
      console.warn("Clearing corrupted wrapping key, generating new one...");
      await del(DB_KEY_NAME, KEY_STORE);
    }
  }

  const dbKey = await generateAesKey();
  const wrappingKey = await generateWrappingKey();
  const wrappedKey = await wrapKey(dbKey, wrappingKey);
  const exportedWrappingKey = await exportKey(wrappingKey);
  await set(DB_KEY_NAME, { wrappedKey, wrappingKey: exportedWrappingKey }, KEY_STORE);
  return dbKey;
}

/**
 * Stores a private key in IndexedDB for a profile.
 */
export async function storeProfilePrivateKey(
  profileId: string,
  privateKey: string
): Promise<void> {
  const key = await getOrCreateDbKey();
  const enc = new TextEncoder();
  const encoded = enc.encode(privateKey);
  const { ciphertext, iv } = await encryptDbBlob(encoded, key);
  await set(`ppro:profile_private_key:${profileId}`, { ciphertext, iv }, KEY_STORE);
}

/**
 * Retrieves a private key from IndexedDB for a profile.
 */
export async function getProfilePrivateKey(
  profileId: string
): Promise<string | undefined> {
  const stored = await get<any>(`ppro:profile_private_key:${profileId}`, KEY_STORE);
  if (!stored) return undefined;
  if (typeof stored === "string") {
    return stored;
  }
  if (stored.ciphertext && stored.iv) {
    const key = await getOrCreateDbKey();
    const decrypted = await decryptDbBlob(stored.ciphertext, stored.iv, key);
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }
  return undefined;
}

/**
 * Lists all stored profile private keys in IndexedDB.
 */
export async function listProfilePrivateKeys(): Promise<
  Array<{ profileId: string; privateKey: string }>
> {
  const { keys } = await import("idb-keyval");
  const allKeys = await keys(KEY_STORE);
  const entries: Array<{ profileId: string; privateKey: string }> = [];
  const key = await getOrCreateDbKey();
  for (const k of allKeys) {
    if (
      typeof k === "string" &&
      k.startsWith("ppro:profile_private_key:")
    ) {
      const profileId = k.slice("ppro:profile_private_key:".length);
      const stored = await get<any>(k, KEY_STORE);
      if (stored) {
        if (typeof stored === "string") {
          entries.push({ profileId, privateKey: stored });
        } else if (stored.ciphertext && stored.iv) {
          const decrypted = await decryptDbBlob(stored.ciphertext, stored.iv, key);
          const dec = new TextDecoder();
          entries.push({ profileId, privateKey: dec.decode(decrypted) });
        }
      }
    }
  }
  return entries;
}

/**
 * Encrypts a database blob (Uint8Array) using AES-256-GCM.
 */
export async function encryptDbBlob(
  data: Uint8Array,
  key: CryptoKey
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(data)
  );
  return { ciphertext: new Uint8Array(ciphertext), iv };
}

/**
 * Decrypts a database blob using AES-256-GCM.
 */
export async function decryptDbBlob(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  key: CryptoKey
): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(ciphertext)
  );
  return new Uint8Array(decrypted);
}

const DRAFT_KEY_NAME = "ppro:draft_encryption_key";

async function getOrCreateDraftKey(): Promise<Uint8Array> {
  const stored = await get<any>(DRAFT_KEY_NAME, KEY_STORE);
  if (stored instanceof Uint8Array && stored.length === 32) {
    return stored;
  }
  const newKey = new Uint8Array(32);
  crypto.getRandomValues(newKey);
  await set(DRAFT_KEY_NAME, newKey, KEY_STORE);
  return newKey;
}

export async function encryptDraft(payload: string): Promise<string> {
  try {
    const key = await getOrCreateDraftKey();
    const { ciphertext, nonce } = await encryptAesGcm(payload, key);
    return JSON.stringify({ ciphertext, nonce });
  } catch (e) {
    console.error("Failed to encrypt draft:", e);
    return payload;
  }
}

export async function decryptDraft(encrypted: string): Promise<string> {
  try {
    const parsed = JSON.parse(encrypted);
    if (parsed && typeof parsed === "object" && parsed.ciphertext && parsed.nonce) {
      const key = await getOrCreateDraftKey();
      return await decryptAesGcm(parsed.ciphertext, parsed.nonce, key);
    }
  } catch {}
  return encrypted;
}
