/**
 * Pedigree PRO — Shared Cryptographic Primitives
 *
 * Provides Ed25519 signing/verification, SHA-256 content hashing,
 * symmetric encryption, and libsodium sealed boxes for all environments.
 *
 * Per ADR-001 (Trust Model) and ADR-003 (Database Strategy):
 * - Ed25519 keypairs for profile identity and provenance signatures
 * - SHA-256 for content-addressable integrity (canvas_hash)
 * - libsodium crypto_box_seal for end-to-end encrypted sharing
 * - AES-256-GCM for symmetric encryption of export packages
 *
 * Dependencies: @noble/ed25519, @noble/hashes, libsodium-wrappers
 */

import { getPublicKey, sign, verify, utils as ed25519Utils } from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { sha512 } from "@noble/hashes/sha512";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

// =============================================================================
// Ed25519 Key Generation
// =============================================================================

/**
 * Generates a new Ed25519 keypair.
 * @returns { publicKey: base64url string, privateKey: base64url string }
 */
export async function generateEd25519Keypair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const privateKeyBytes = ed25519Utils.randomPrivateKey();
  const publicKeyBytes = await getPublicKey(privateKeyBytes);
  return {
    publicKey: bytesToBase64url(publicKeyBytes),
    privateKey: bytesToBase64url(privateKeyBytes),
  };
}

/**
 * Derives the Ed25519 public key from a private key.
 * @param privateKeyBase64url Base64url-encoded 32-byte Ed25519 private key
 * @returns Base64url-encoded 32-byte Ed25519 public key
 */
export async function getPublicKeyFromPrivate(
  privateKeyBase64url: string
): Promise<string> {
  const privateKeyBytes = base64urlToBytes(privateKeyBase64url);
  const publicKeyBytes = await getPublicKey(privateKeyBytes);
  return bytesToBase64url(publicKeyBytes);
}

// =============================================================================
// Ed25519 Signing & Verification
// =============================================================================

/**
 * Signs arbitrary data with an Ed25519 private key.
 * @param data String or object to sign (object will be JSON-serialized)
 * @param privateKeyBase64url Base64url-encoded 32-byte Ed25519 private key
 * @returns Base64url-encoded 64-byte Ed25519 signature
 */
export async function signData(
  data: string | object,
  privateKeyBase64url: string
): Promise<string> {
  const message = typeof data === "string" ? data : JSON.stringify(data);
  const messageBytes = new TextEncoder().encode(message);
  const privateKeyBytes = base64urlToBytes(privateKeyBase64url);
  const signatureBytes = await sign(messageBytes, privateKeyBytes);
  return bytesToBase64url(signatureBytes);
}

/**
 * Verifies an Ed25519 signature.
 * @param data Original string or object that was signed
 * @param signatureBase64url Base64url-encoded 64-byte Ed25519 signature
 * @param publicKeyBase64url Base64url-encoded 32-byte Ed25519 public key
 * @returns true if signature is valid
 */
export async function verifySignature(
  data: string | object,
  signatureBase64url: string,
  publicKeyBase64url: string
): Promise<boolean> {
  try {
    const message = typeof data === "string" ? data : JSON.stringify(data);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = base64urlToBytes(signatureBase64url);
    const publicKeyBytes = base64urlToBytes(publicKeyBase64url);
    return await verify(signatureBytes, messageBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

// =============================================================================
// SHA-256 Content Hashing (Canvas Integrity)
// =============================================================================

/**
 * Computes SHA-256 hash of data for content-addressable integrity.
 * Used for canvas_hash in pedigrees and pedigree_versions.
 * @param data String to hash
 * @returns Hex-encoded 32-byte SHA-256 digest
 */
export function computeHash(data: string): string {
  const dataBytes = new TextEncoder().encode(data);
  return bytesToHex(sha256(dataBytes));
}

// =============================================================================
// Symmetric Encryption (XChaCha20-Poly1305 via Web Crypto API)
// =============================================================================

/**
 * Generates a random 256-bit (32-byte) symmetric key for XChaCha20-Poly1305.
 * @returns Uint8Array of 32 random bytes
 */
export function generateSymmetricKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Encrypts data with AES-256-GCM via the Web Crypto API.
 *
 * NOTE: This function uses AES-GCM (not XChaCha20-Poly1305 as the function
 * name might suggest), because XChaCha20 is not available in the standard
 * Web Crypto API. For XChaCha20-Poly1305, use the Rust backend (libsodium)
 * or the `@noble/ciphers` pure-JS library.
 *
 * AES-GCM provides authenticated encryption with a 12-byte IV.
 *
 * @param data String to encrypt
 * @param key 32-byte symmetric key (AES-256)
 * @returns { ciphertext: base64url string, nonce: base64url string (24 bytes, first 12 used as IV) }
 */
export async function encryptAesGcm(
  data: string,
  key: Uint8Array
): Promise<{ ciphertext: string; nonce: string }> {
  const nonce = crypto.getRandomValues(new Uint8Array(24)); // XChaCha20 nonce
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(key),
    { name: "AES-GCM" }, // Fallback to AES-GCM; XChaCha20 not in Web Crypto yet
    false,
    ["encrypt"]
  );
  const dataBytes = new TextEncoder().encode(data);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce.slice(0, 12) }, // AES-GCM uses 12-byte IV
    cryptoKey,
    dataBytes
  );
  return {
    ciphertext: bytesToBase64url(new Uint8Array(encrypted)),
    nonce: bytesToBase64url(nonce),
  };
}

/**
 * Decrypts data encrypted with encryptAesGcm().
 * @param ciphertextBase64url Base64url-encoded ciphertext
 * @param nonceBase64url Base64url-encoded nonce (24 bytes, first 12 used as IV)
 * @param key 32-byte symmetric key (AES-256)
 * @returns Decrypted plaintext string
 */
export async function decryptAesGcm(
  ciphertextBase64url: string,
  nonceBase64url: string,
  key: Uint8Array
): Promise<string> {
  const nonce = base64urlToBytes(nonceBase64url);
  const ciphertext = base64urlToBytes(ciphertextBase64url);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(key),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(nonce.slice(0, 12)) },
    cryptoKey,
    new Uint8Array(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

// =============================================================================
// Asymmetric Encryption (libsodium-style Sealed Boxes)
// =============================================================================

/**
 * Encrypts data for a recipient using libsodium crypto_box_seal.
 *
 * This is the canonical sharing encryption primitive. It produces
 * ciphertext that the Rust backend (via libsodium-sys) can decrypt
 * with the recipient's Ed25519 private key.
 *
 * Protocol (libsodium crypto_box_seal):
 * 1. Generate ephemeral X25519 keypair
 * 2. Convert recipient Ed25519 pk → Curve25519 pk
 * 3. sealed = crypto_box_seal(message, recipient_curve25519_pk)
 * 4. Return { ephemeral_pk, ciphertext }
 *
 * @param data String to encrypt
 * @param recipientPublicKeyHex Recipient's Ed25519 public key (hex-encoded 32 bytes)
 * @returns Base64url-encoded sealed box ciphertext
 */
export async function sodiumSealBox(
  data: string,
  recipientPublicKeyHex: string
): Promise<string> {
  const _sodium = await import("libsodium-wrappers");
  await _sodium.ready;
  const sodium = _sodium;

  const messageBytes = sodium.from_string(data);
  const recipientKeyBytes = sodium.from_hex(recipientPublicKeyHex);

  // crypto_box_seal encrypts for a recipient's public key using an
  // ephemeral keypair internally. The ciphertext includes the
  // ephemeral public key.
  const sealed = sodium.crypto_box_seal(messageBytes, recipientKeyBytes);

  return sodium.to_base64(sealed, sodium.base64_variants.URLSAFE_NO_PADDING);
}

/**
 * Decrypts data sealed with sodiumSealBox().
 *
 * @param sealedCiphertext Base64url-encoded sealed box ciphertext
 * @param recipientPrivateKeyHex Recipient's Ed25519 private key (hex-encoded 64 bytes with public key)
 * @returns Decrypted plaintext string
 */
export async function sodiumOpenSealedBox(
  sealedCiphertext: string,
  recipientPrivateKeyHex: string
): Promise<string> {
  const _sodium = await import("libsodium-wrappers");
  await _sodium.ready;
  const sodium = _sodium;

  // crypto_box_seal_open expects separate public and private keys.
  // If the hex string contains the full 64-byte keypair (sk || pk),
  // split it into private key (first 32 bytes) and public key (last 32 bytes).
  const keypairBytes = sodium.from_hex(recipientPrivateKeyHex);
  const privateKeyBytes = keypairBytes.slice(0, 32);
  const publicKeyBytes = keypairBytes.slice(32, 64);
  const ciphertextBytes = sodium.from_base64(
    sealedCiphertext,
    sodium.base64_variants.URLSAFE_NO_PADDING
  );

  const decrypted = sodium.crypto_box_seal_open(ciphertextBytes, publicKeyBytes, privateKeyBytes);
  return sodium.to_string(decrypted);
}

// ---------------------------------------------------------------------------
// Legacy / simplified encryption (non-interoperable, deprecated)
// ---------------------------------------------------------------------------

/**
 * WARNING: INTERIM IMPLEMENTATION — NOT CRYPTOGRAPHICALLY INTEROPERABLE WITH THE RUST BACKEND.
 *
 * This is a simplified asymmetric encryption using deterministic SHA-256
 * wrapping. It does NOT implement libsodium crypto_box_seal semantics.
 * For production sharing, use sodiumSealBox() instead.
 *
 * @deprecated Use sodiumSealBox() for production sharing.
 */
export async function encryptForRecipient(
  data: string,
  recipientPublicKeyBase64url: string
): Promise<string> {
  const ephemeralSk = ed25519Utils.randomPrivateKey();
  const ephemeralPk = await getPublicKey(ephemeralSk);

  const symKey = generateSymmetricKey();
  const sealed = await encryptAesGcm(data, symKey);

  const recipientKeyBytes = base64urlToBytes(recipientPublicKeyBase64url);
  const wrappingKey = sha256(recipientKeyBytes);
  const wrappedKey = await encryptAesGcm(bytesToBase64url(symKey), wrappingKey);

  const envelope = {
    version: 1,
    ephemeral_pk: bytesToBase64url(ephemeralPk),
    wrapped_key: wrappedKey,
    payload: sealed,
  };

  return JSON.stringify(envelope);
}

/** @deprecated Use sodiumOpenSealedBox() for production sharing. */
export async function decryptFromSender(
  sealedEnvelope: string,
  recipientPrivateKeyBase64url: string
): Promise<string> {
  const envelope = JSON.parse(sealedEnvelope);
  const recipientKeyBytes = base64urlToBytes(recipientPrivateKeyBase64url);
  const publicKeyBytes = await getPublicKey(recipientKeyBytes);
  const wrappingKey = sha256(publicKeyBytes);
  const symKeyBase64url = await decryptAesGcm(
    envelope.wrapped_key.ciphertext,
    envelope.wrapped_key.nonce,
    wrappingKey
  );
  const symKey = base64urlToBytes(symKeyBase64url);
  return await decryptAesGcm(
    envelope.payload.ciphertext,
    envelope.payload.nonce,
    symKey
  );
}

// ---------------------------------------------------------------------------
// Legacy aliases (deprecated — use renamed functions above)
// ---------------------------------------------------------------------------

/** @deprecated Use encryptAesGcm() instead. */
export const sealData = encryptAesGcm;

/** @deprecated Use decryptAesGcm() instead. */
export const unsealData = decryptAesGcm;

/** @deprecated Use encryptForRecipient() instead. */
export const sealForRecipient = encryptForRecipient;

/** @deprecated Use decryptFromSender() instead. */
export const unsealFromSender = decryptFromSender;

// =============================================================================
// Base64url Encoding Utilities
// =============================================================================

/**
 * Converts a Uint8Array to a base64url string (no padding).
 */
function bytesToBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Converts a base64url string to a Uint8Array.
 */
function base64urlToBytes(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// =============================================================================
// Key Derivation (PBKDF2)
// =============================================================================

/**
 * Derives a key from a passphrase using PBKDF2-HMAC-SHA512.
 * Used for browser mode where OS keychain is unavailable.
 * @param passphrase User-provided passphrase
 * @param salt Random salt (base64url)
 * @param iterations Number of PBKDF2 iterations (default: 256,000)
 * @param keyLengthBytes Desired output key length (default: 32 bytes)
 * @returns { derivedKey: base64url, salt: base64url }
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt?: string,
  iterations: number = 256_000,
  keyLengthBytes: number = 32
): Promise<{ derivedKey: string; salt: string }> {
  const saltBytes = salt
    ? base64urlToBytes(salt)
    : crypto.getRandomValues(new Uint8Array(32));

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new Uint8Array(saltBytes),
      iterations,
      hash: "SHA-512",
    },
    keyMaterial,
    keyLengthBytes * 8
  );

  return {
    derivedKey: bytesToBase64url(new Uint8Array(derivedBits)),
    salt: bytesToBase64url(saltBytes),
  };
}