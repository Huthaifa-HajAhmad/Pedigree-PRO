import { exec, queryOne } from "../db";
import { listProfilePrivateKeys } from "../crypto-store";
import { export_pedigree_ppro, import_pedigree_native } from "./importExportCommands";
import type { ShareResult, SharedPedigreeView, Pedigree, PproExport } from "./types";

const RELAY_BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.VITE_RELAY_URL) ||
  "https://pedigreepro-relay.pedigreepro.workers.dev";
const SHORT_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function toBase64url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64urlToBase64(base64url: string): string {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return base64;
}

export async function compressString(str: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(encoder.encode(str) as unknown as ArrayBufferView<ArrayBuffer>);
  writer.close();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function decompressBytes(bytes: Uint8Array): Promise<string> {
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(bytes as unknown as ArrayBufferView<ArrayBuffer>);
  writer.close();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(result);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function isGzipCompressed(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

function looksLikeRelayToken(token: string): boolean {
  return /^[A-Za-z0-9]{9,40}$/.test(token);
}

function generateShortCode(length = 8): string {
  let result = "";
  const maxValidVal = 256 - (256 % SHORT_CODE_CHARS.length);
  const byte = new Uint8Array(1);
  while (result.length < length) {
    crypto.getRandomValues(byte);
    const val = byte[0]!;
    if (val < maxValidVal) {
      result += SHORT_CODE_CHARS[val % SHORT_CODE_CHARS.length];
    }
  }
  return result;
}

function isShortCode(token: string): boolean {
  return /^[A-Za-z0-9]{8}$/.test(token);
}

function resolveShortCode(shortCode: string): string | null {
  const row = queryOne<{ token: string }>("SELECT token FROM share_links WHERE short_code = ? LIMIT 1", [shortCode]);
  return row?.token ?? null;
}

export function cleanupExpiredShareLinks(): void {
  exec("DELETE FROM share_links WHERE created_at < datetime('now', '-7 days')", []);
}

function extractKeyFromLocationOrFallback(fallbackToken?: string): string | undefined {
  if (typeof window !== "undefined" && window.location.hash) {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const k = params.get("key");
    if (k) return k;
    if (hash.startsWith("key=")) return hash.slice(4);
  }
  if (fallbackToken) {
    try {
      const params = new URLSearchParams(fallbackToken);
      const k = params.get("key");
      if (k) return k;
    } catch {}
  }
  return undefined;
}

async function decryptSharedRaw(raw: string, symKeyBase64url?: string): Promise<string> {
  if (symKeyBase64url) {
    try {
      const parsedEnvelope = JSON.parse(raw);
      if (parsedEnvelope?.v === "symmetric-gcm" && parsedEnvelope.ciphertext && parsedEnvelope.nonce) {
        const { decryptAesGcm, base64urlToBytes } = await import("@workspace/crypto");
        return await decryptAesGcm(parsedEnvelope.ciphertext, parsedEnvelope.nonce, base64urlToBytes(symKeyBase64url));
      }
    } catch {}
  }

  const { sodiumOpenSealedBox } = await import("@workspace/crypto");
  const privateKeys = await listProfilePrivateKeys();
  let lastError: Error | null = null;

  for (const { privateKey } of privateKeys) {
    try {
      return await sodiumOpenSealedBox(raw, privateKey);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  try {
    JSON.parse(raw);
    return raw;
  } catch {}

  throw lastError ?? new Error("This share is encrypted. Decryption key or matching profile private key not found.");
}

export async function share_pedigree(args: {
  pedigree_id: number;
  recipient_key: string;
}): Promise<ShareResult> {
  try {
    cleanupExpiredShareLinks();
  } catch (err) {
    console.error("Failed to cleanup expired share links", err);
  }

  const pproJson = export_pedigree_ppro({ pedigree_id: args.pedigree_id, exporter_key: args.recipient_key });
  const hasKey = args.recipient_key && args.recipient_key !== "anonymous";

  let payload: string;
  let keyFragment = "";
  if (hasKey) {
    const { sodiumSealBox } = await import("@workspace/crypto");
    payload = await sodiumSealBox(pproJson, args.recipient_key);
  } else {
    const { generateSymmetricKey, encryptAesGcm, bytesToBase64url } = await import("@workspace/crypto");
    const symKey = generateSymmetricKey();
    const { ciphertext, nonce } = await encryptAesGcm(pproJson, symKey);
    payload = JSON.stringify({ v: "symmetric-gcm", nonce, ciphertext });
    keyFragment = `#key=${bytesToBase64url(symKey)}`;
  }

  const compressed = await compressString(payload);
  const compressedBase64 = toBase64url(bytesToBase64(compressed));

  try {
    const relayResult = await relay_share({ ciphertext: compressedBase64, encrypted_key: "", ttl_hours: 168 });
    const appBaseUrl = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
      ? "https://pedigree-pro.pages.dev"
      : window.location.origin;
    return {
      share_token: relayResult.share_token,
      share_url: `${appBaseUrl}/share/${relayResult.share_token}${keyFragment}`,
    };
  } catch {
    // Relay offline fallback
  }

  const token = compressedBase64;
  let shortCode = generateShortCode(8);
  while (queryOne<{ short_code: string }>("SELECT short_code FROM share_links WHERE short_code = ? LIMIT 1", [shortCode])) {
    shortCode = generateShortCode(8);
  }
  exec("INSERT INTO share_links (short_code, token) VALUES (?, ?)", [shortCode, token]);

  const { saveDb } = await import("../db");
  await saveDb();

  const shareBaseUrl = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    ? "https://pedigree-pro.pages.dev"
    : window.location.origin;

  return {
    share_token: token,
    share_url: `${shareBaseUrl}/share/${shortCode}#token=${encodeURIComponent(token)}${keyFragment ? `&${keyFragment.slice(1)}` : ""}`,
  };
}

export async function import_shared(args: { share_token: string; importer_key?: string; fallback_token?: string }): Promise<Pedigree> {
  let token = args.share_token;
  const symKey = extractKeyFromLocationOrFallback(args.fallback_token);

  if (isShortCode(token)) {
    const resolved = resolveShortCode(token);
    if (resolved) {
      token = resolved;
    } else if (args.fallback_token) {
      token = args.fallback_token;
    } else {
      throw new Error("Invalid share link: short code not found");
    }
  }

  if (looksLikeRelayToken(token)) {
    try {
      const relayData = await relay_receive({ share_token: token });
      const compressedBytes = base64ToBytes(fromBase64urlToBase64(relayData.ciphertext));
      const raw = await decompressBytes(compressedBytes);
      const decrypted = await decryptSharedRaw(raw, symKey);
      return import_pedigree_native({ path: decrypted, importer_key: args.importer_key ?? "imported" });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Invalid share link")) throw e;
      // Continue to local decode fallback
    }
  }

  let raw: string;
  try {
    const stdBase64 = fromBase64urlToBase64(token);
    const bytes = base64ToBytes(stdBase64);
    if (isGzipCompressed(bytes)) {
      raw = await decompressBytes(bytes);
    } else {
      raw = new TextDecoder().decode(bytes);
    }
  } catch {
    throw new Error("Invalid share token: unable to decode");
  }

  const decrypted = await decryptSharedRaw(raw, symKey);
  return import_pedigree_native({ path: decrypted, importer_key: args.importer_key ?? "imported" });
}

function parsePproForView(raw: string): Omit<SharedPedigreeView, "encrypted" | "decryptError"> | null {
  try {
    const data: PproExport = JSON.parse(raw);
    if (data.format_version !== "1.0" || data.export_type !== "pedigree" || !data.pedigree) {
      return null;
    }
    const ped = data.pedigree;
    const canvasStr = ped.canvas_data ? JSON.stringify(ped.canvas_data) : null;
    return {
      title: ped.title,
      canvas_data: canvasStr,
      notes: ped.notes ?? null,
      updated_at: data.provenance?.exported_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function decode_shared_pedigree(args: {
  share_token: string;
  fallback_token?: string;
}): Promise<SharedPedigreeView> {
  let token = args.share_token;
  const symKey = extractKeyFromLocationOrFallback(args.fallback_token);

  if (isShortCode(token)) {
    const resolved = resolveShortCode(token);
    if (resolved) {
      token = resolved;
    } else if (args.fallback_token) {
      token = args.fallback_token;
    } else {
      return {
        title: "",
        canvas_data: null,
        notes: null,
        updated_at: new Date().toISOString(),
        encrypted: false,
        decryptError: "Short code not found in this browser's database. This share link was generated on a different device or in a private/incognito session. Open it in the same browser where it was created, or ask the sender to use File → Export for cross-device transfer.",
      };
    }
  }

  if (looksLikeRelayToken(token)) {
    try {
      const relayData = await relay_receive({ share_token: token });
      const compressedBytes = base64ToBytes(fromBase64urlToBase64(relayData.ciphertext));
      const raw = await decompressBytes(compressedBytes);

      try {
        const decrypted = await decryptSharedRaw(raw, symKey);
        const view = parsePproForView(decrypted);
        if (view) return { ...view, encrypted: false };
      } catch (err) {
        return {
          title: "",
          canvas_data: null,
          notes: null,
          updated_at: new Date().toISOString(),
          encrypted: true,
          decryptError: err instanceof Error ? err.message : "Unable to decrypt share",
        };
      }
    } catch {
      // Relay failed
    }
  }

  let raw: string;
  try {
    const stdBase64 = fromBase64urlToBase64(token);
    const bytes = base64ToBytes(stdBase64);
    if (isGzipCompressed(bytes)) {
      raw = await decompressBytes(bytes);
    } else {
      raw = new TextDecoder().decode(bytes);
    }
  } catch {
    return {
      title: "",
      canvas_data: null,
      notes: null,
      updated_at: new Date().toISOString(),
      encrypted: false,
      decryptError: "Invalid share token: unable to decode. The link may be corrupted or incomplete.",
    };
  }

  try {
    const decrypted = await decryptSharedRaw(raw, symKey);
    const view = parsePproForView(decrypted);
    if (view) return { ...view, encrypted: false };
  } catch (err) {
    return {
      title: "",
      canvas_data: null,
      notes: null,
      updated_at: new Date().toISOString(),
      encrypted: true,
      decryptError: err instanceof Error ? err.message : "Unable to decrypt share",
    };
  }

  return {
    title: "",
    canvas_data: null,
    notes: null,
    updated_at: new Date().toISOString(),
    encrypted: true,
    decryptError: "This share is encrypted. Decryption key or matching profile private key not found.",
  };
}

export async function relay_share(args: {
  ciphertext: string;
  encrypted_key: string;
  ttl_hours?: number;
}): Promise<ShareResult> {
  const response = await fetch(`${RELAY_BASE_URL}/api/relay/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ciphertext: args.ciphertext,
      encrypted_key: args.encrypted_key,
      ttl_hours: args.ttl_hours ?? 168,
    }),
  });

  if (!response.ok) {
    if (response.status === 404 || response.status === 410) {
      throw new Error("Share token expired or not found");
    }
    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(`Relay error: ${errorData.error ?? errorData.message ?? response.statusText}`);
  }

  const result = await response.json();
  if (!result || typeof result !== "object" || typeof result.share_token !== "string") {
    throw new Error("Invalid response received from relay: missing required fields");
  }
  const appBaseUrl = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    ? "https://pedigree-pro.pages.dev"
    : window.location.origin;
  return {
    share_token: result.share_token,
    share_url: `${appBaseUrl}/share/${result.share_token}`,
  };
}

export async function relay_receive(args: { share_token: string }): Promise<{
  ciphertext: string;
  encrypted_key: string;
}> {
  if (!/^[a-zA-Z0-9+/=_-]+$/.test(args.share_token)) {
    throw new Error("Invalid share token format");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${RELAY_BASE_URL}/api/relay/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share_token: args.share_token }),
      credentials: "omit",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Share token expired or not found");
      }
      if (response.status === 410) {
        throw new Error("Share token already consumed");
      }
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      const message = response.status >= 500 ? "Server error" : (errorData.error ?? errorData.message ?? response.statusText);
      throw new Error(`Relay error: ${message}`);
    }

    const data = await response.json();
    if (
      !data ||
      typeof data !== "object" ||
      typeof data.ciphertext !== "string" ||
      typeof data.encrypted_key !== "string"
    ) {
      throw new Error("Invalid response received from relay: missing required fields");
    }
    return {
      ciphertext: data.ciphertext,
      encrypted_key: data.encrypted_key,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Relay request timed out — please check your connection and try again");
    }
    throw err;
  }
}

export async function relay_revoke(args: { share_token: string }): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${RELAY_BASE_URL}/api/relay/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ share_token: args.share_token }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to revoke share token: HTTP ${response.status}`);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Relay request timed out — please check your connection and try again");
    }
    if (err instanceof TypeError && err.message === "Failed to fetch") {
      throw new Error("Unable to connect to the sharing relay service. Please check your network connection.");
    }
    throw err;
  }
}
