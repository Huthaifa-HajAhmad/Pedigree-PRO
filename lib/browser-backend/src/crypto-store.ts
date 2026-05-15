/**
 * Pedigree PRO — Browser Backend Crypto Store
 *
 * Manages encryption keys for the sql.js database using Web Crypto API.
 * In browser mode there is no OS keychain, so keys are stored in IndexedDB.
 * Users may optionally protect keys with a passphrase.
 */

import { get, set, createStore } from "idb-keyval";

const KEY_STORE = createStore("haploclinical-keys", "keys");
const DB_KEY_NAME = "db-encryption-key";
const PASSPHRASE_SALT_NAME = "passphrase-salt";

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
      salt: salt as unknown as unknown as ArrayBuffer,
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
 * Imports raw bytes to a CryptoKey.
 */
async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw as unknown as ArrayBuffer, "AES-GCM", true, [
    "encrypt",
    "decrypt",
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
    wrappedKey as unknown as ArrayBuffer,
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
  const stored = await get<{ wrappedKey: Uint8Array; wrappingKey: Uint8Array } | null>(
    DB_KEY_NAME,
    KEY_STORE
  );
  if (stored) {
    const wrappingKey = await importKey(stored.wrappingKey);
    return unwrapKey(stored.wrappedKey, wrappingKey);
  }

  const dbKey = await generateAesKey();
  const wrappingKey = await generateAesKey();
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
  await set(`hc:profile_private_key:${profileId}`, privateKey, KEY_STORE);
}

/**
 * Retrieves a private key from IndexedDB for a profile.
 */
export async function getProfilePrivateKey(
  profileId: string
): Promise<string | undefined> {
  return get<string>(`hc:profile_private_key:${profileId}`, KEY_STORE);
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
  for (const key of allKeys) {
    if (
      typeof key === "string" &&
      key.startsWith("hc:profile_private_key:")
    ) {
      const profileId = key.slice("hc:profile_private_key:".length);
      const privateKey = await get<string>(key, KEY_STORE);
      if (privateKey) {
        entries.push({ profileId, privateKey });
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
    { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
    key,
    data as unknown as ArrayBuffer
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
    { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
    key,
    ciphertext as unknown as ArrayBuffer
  );
  return new Uint8Array(decrypted);
}
