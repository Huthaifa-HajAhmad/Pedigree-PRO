/**
 * Pedigree PRO — Zero-Knowledge Cloudflare Workers Relay
 *
 * Implements the relay service for end-to-end encrypted pedigree data (ADR-001 §3.3).
 *
 * Security Invariants:
 * 1. Zero-Knowledge: The relay receives and stores only encrypted ciphertext blobs and
 *    ephemeral wrapped keys. It NEVER has access to private decryption keys or plaintext PHI.
 * 2. High-Entropy Tokens: Generates 128-bit CSPRNG tokens using Web Crypto API.
 * 3. Strict Payload Limits: Rejects requests exceeding 2 MB.
 * 4. Rate Limiting: Defends against abuse with per-IP rate limiting.
 * 5. Auto-Expiration: KV records auto-expire after TTL (default 7 days, max 30 days).
 */

export interface Env {
  RELAY_KV: KVNamespace;
}

const BASE62_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024; // 2 MB maximum payload cap
const DEFAULT_TTL_SECONDS = 7 * 24 * 3600; // 7 days default
const MAX_TTL_SECONDS = 30 * 24 * 3600; // 30 days maximum
const MIN_TTL_SECONDS = 60; // 1 minute minimum

// In-memory rate limiting map per worker isolate.
// NOTE: Cloudflare Workers isolates are ephemeral and distributed across edge data centers.
// This in-memory limiter provides isolate-level defense-in-depth. Production edge deployments
// should configure Cloudflare WAF Rate Limiting rules or Workers Rate Limiting bindings.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

/**
 * Generates a 128-bit cryptographically secure token (22 base62 characters).
 * Uses unbiased rejection sampling (rejection above 248 = 4 * 62) to prevent modulo bias.
 * 22 chars in base62 provides 22 * log2(62) ≈ 131 bits of cryptographic entropy.
 */
export function generate128BitToken(): string {
  const charsNeeded = 22;
  let token = "";
  const randomBytes = new Uint8Array(64);
  while (token.length < charsNeeded) {
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < randomBytes.length && token.length < charsNeeded; i++) {
      const val = randomBytes[i]!;
      // 248 = 4 * 62; reject bytes >= 248 to guarantee uniform distribution
      if (val < 248) {
        token += BASE62_CHARS[val % 62];
      }
    }
  }
  return token;
}

function securityHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders(),
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: securityHeaders() });
    }

    const clientIp = request.headers.get("cf-connecting-ip") || "unknown-ip";

    // Global rate limit check (60 req/min per IP)
    if (!checkRateLimit(clientIp, 60, 60_000)) {
      return jsonResponse({ error: "Rate limit exceeded. Please try again later." }, 429);
    }

    try {
      // ── Share (POST /api/relay/share) ─────────────────────────
      if (path === "/api/relay/share" && method === "POST") {
        const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
        if (contentLength > MAX_PAYLOAD_BYTES) {
          return jsonResponse({ error: "Payload exceeds maximum allowed size (2 MB)" }, 413);
        }

        const body = (await request.json()) as {
          ciphertext?: string;
          encrypted_key?: string;
          ttl_hours?: number | null;
        };

        if (!body.ciphertext || typeof body.ciphertext !== "string") {
          return jsonResponse({ error: "Missing required 'ciphertext' field" }, 400);
        }

        const totalPayloadSize = body.ciphertext.length + (body.encrypted_key?.length || 0);
        if (totalPayloadSize > MAX_PAYLOAD_BYTES) {
          return jsonResponse({ error: "Payload exceeds maximum allowed size (2 MB)" }, 413);
        }

        const token = generate128BitToken();
        const revokeToken = generate128BitToken();
        const ttlSeconds = body.ttl_hours
          ? Math.max(MIN_TTL_SECONDS, Math.min(MAX_TTL_SECONDS, Math.round(body.ttl_hours * 3600)))
          : DEFAULT_TTL_SECONDS;

        const expiresAt = Date.now() + ttlSeconds * 1000;

        await env.RELAY_KV.put(
          token,
          JSON.stringify({
            ciphertext: body.ciphertext,
            encrypted_key: body.encrypted_key || "",
            revoke_token: revokeToken,
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
          }),
          { expirationTtl: ttlSeconds }
        );

        return jsonResponse({
          share_token: token,
          revoke_token: revokeToken,
          expires_at: new Date(expiresAt).toISOString(),
        });
      }

      // ── Receive (POST /api/relay/receive) ───────────────────────
      if (path === "/api/relay/receive" && method === "POST") {
        const body = (await request.json()) as { share_token?: string };

        if (!body.share_token || typeof body.share_token !== "string") {
          return jsonResponse({ error: "Missing required 'share_token' field" }, 400);
        }

        // Validate token format (defense in depth against key injection)
        if (!/^[A-Za-z0-9]{8,64}$/.test(body.share_token)) {
          return jsonResponse({ error: "Invalid token format" }, 400);
        }

        const data = await env.RELAY_KV.get(body.share_token);
        if (!data) {
          return jsonResponse({ error: "Share token not found or expired" }, 404);
        }

        const parsed = JSON.parse(data) as {
          ciphertext: string;
          encrypted_key?: string;
        };

        return jsonResponse({
          ciphertext: parsed.ciphertext,
          encrypted_key: parsed.encrypted_key || "",
        });
      }

      // ── Revoke (POST /api/relay/revoke or DELETE /api/relay/revoke/:token) ──
      if (path === "/api/relay/revoke" && method === "POST") {
        const body = (await request.json()) as { share_token?: string; revoke_token?: string };
        if (!body.share_token || !/^[A-Za-z0-9]{8,64}$/.test(body.share_token)) {
          return jsonResponse({ error: "Invalid or missing 'share_token' field" }, 400);
        }

        const data = await env.RELAY_KV.get(body.share_token);
        if (!data) {
          return jsonResponse({ error: "Share token not found or expired" }, 404);
        }

        const parsed = JSON.parse(data) as { revoke_token?: string };
        // If revoke_token exists on the record, require matching authorization
        if (parsed.revoke_token && parsed.revoke_token !== body.revoke_token) {
          return jsonResponse({ error: "Unauthorized: invalid revoke token" }, 401);
        }

        await env.RELAY_KV.delete(body.share_token);
        return new Response(null, { status: 204, headers: securityHeaders() });
      }

      if ((path.startsWith("/api/relay/receive/") || path.startsWith("/api/relay/revoke/")) && method === "DELETE") {
        const token = path.split("/").pop();
        if (!token || !/^[A-Za-z0-9]{8,64}$/.test(token)) {
          return jsonResponse({ error: "Invalid or missing token" }, 400);
        }

        const authHeader = request.headers.get("x-revoke-token") || "";
        const data = await env.RELAY_KV.get(token);
        if (!data) {
          return jsonResponse({ error: "Share token not found or expired" }, 404);
        }

        const parsed = JSON.parse(data) as { revoke_token?: string };
        if (parsed.revoke_token && parsed.revoke_token !== authHeader && parsed.revoke_token !== token) {
          return jsonResponse({ error: "Unauthorized: invalid revoke token" }, 401);
        }

        await env.RELAY_KV.delete(token);
        return new Response(null, { status: 204, headers: securityHeaders() });
      }

      // ── Short Landing (GET /s/:token) ─────────────────────────
      if (path.startsWith("/s/") && method === "GET") {
        const token = path.slice(3);
        if (!token || !/^[A-Za-z0-9]{8,64}$/.test(token)) {
          return new Response("Invalid share link format", {
            status: 400,
            headers: { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders() },
          });
        }
        const data = await env.RELAY_KV.get(token);
        if (!data) {
          return new Response("Share link expired or not found", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders() },
          });
        }
        return new Response(
          `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pedigree PRO — Secure Share</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:48px 16px;background:#0f172a;color:#f8fafc">
  <h2 style="color:#2dd4bf;margin-bottom:8px">Pedigree PRO Encrypted Share</h2>
  <p style="color:#94a3b8;font-size:14px;max-width:480px;margin:0 auto 24px">This pedigree record is end-to-end encrypted and ready to open in Pedigree PRO.</p>
  <a href="https://pedigree-pro.pages.dev/share/${token}" style="display:inline-block;padding:12px 28px;background:#0d9488;color:#ffffff;font-weight:600;font-size:14px;border-radius:8px;text-decoration:none">Open in Pedigree PRO</a>
</body>
</html>`,
          { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", ...securityHeaders() } }
        );
      }

      return jsonResponse({ error: "Endpoint not found" }, 404);
    } catch (e) {
      console.error("Relay error:", e);
      return jsonResponse({ error: "Internal relay error" }, 500);
    }
  },
};
