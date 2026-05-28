/**
 * Pedigree PRO — Cloudflare Workers Relay
 *
 * Minimal share-token relay for encrypted pedigree data.
 * No server-side decryption. The relay only stores opaque,
 * compressed+encrypted blobs mapped to short random tokens.
 *
 * Endpoints:
 *   POST /api/relay/share   → stores blob, returns 12-char token
 *   POST /api/relay/receive → looks up token, returns blob
 *   DELETE /api/relay/receive/:token → revoke token
 *
 * Storage: Cloudflare KV (configured in wrangler.toml)
 * Default TTL: 7 days. Tokens auto-expire; explicit DELETE required for revocation.
 */

export interface Env {
  RELAY_KV: KVNamespace;
}

const TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateToken(length = 12): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)];
  }
  return result;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
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
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      // ── Share ────────────────────────────────────────────────
      if (path === "/api/relay/share" && method === "POST") {
        const body = (await request.json()) as {
          ciphertext?: string;
          encrypted_key?: string;
          ttl_hours?: number | null;
        };

        if (!body.ciphertext || typeof body.ciphertext !== "string") {
          return jsonResponse({ error: "Missing ciphertext" }, 400);
        }

        const token = generateToken(12);
        const ttlSeconds = body.ttl_hours
          ? Math.max(60, Math.round(body.ttl_hours * 3600))
          : 7 * 24 * 3600; // default 7 days, minimum 1 minute

        const expiresAt = Date.now() + ttlSeconds * 1000;

        await env.RELAY_KV.put(
          token,
          JSON.stringify({
            ciphertext: body.ciphertext,
            encrypted_key: body.encrypted_key || "",
            expires_at: expiresAt,
          }),
          { expirationTtl: ttlSeconds }
        );

        return jsonResponse({
          share_token: token,
          expires_at: new Date(expiresAt).toISOString(),
        });
      }

      // ── Receive ──────────────────────────────────────────────
      if (path === "/api/relay/receive" && method === "POST") {
        const body = (await request.json()) as { share_token?: string };

        if (!body.share_token || typeof body.share_token !== "string") {
          return jsonResponse({ error: "Missing share_token" }, 400);
        }

        // Validate token format (defence in depth)
        if (!/^[A-Za-z0-9]{12,32}$/.test(body.share_token)) {
          return jsonResponse({ error: "Invalid token format" }, 400);
        }

        const data = await env.RELAY_KV.get(body.share_token);
        if (!data) {
          return jsonResponse({ error: "Not found or expired" }, 404);
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

      // ── Revoke ───────────────────────────────────────────────
      if (path.startsWith("/api/relay/receive/") && method === "DELETE") {
        const token = path.split("/").pop();
        if (!token) {
          return jsonResponse({ error: "Missing token" }, 400);
        }
        await env.RELAY_KV.delete(token);
        return new Response(null, { status: 204, headers: corsHeaders() });
      }

      // ── Short URL landing page (human-readable) ──────────────
      if (path.startsWith("/s/") && method === "GET") {
        const token = path.slice(3);
        const data = await env.RELAY_KV.get(token);
        if (!data) {
          return new Response("Share link expired or not found", {
            status: 404,
            headers: { "Content-Type": "text/plain", ...corsHeaders() },
          });
        }
        // Return a tiny landing page directing users to the app
        return new Response(
          `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Pedigree PRO Share</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px">
  <h2>Pedigree PRO Share Link</h2>
  <p>This share link is ready to open in Pedigree PRO.</p>
  <p><a href="https://pedigreepro.app/share/${token}" style="padding:12px 24px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none">Open in Pedigree PRO</a></p>
</body></html>`,
          { status: 200, headers: { "Content-Type": "text/html", ...corsHeaders() } }
        );
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Server error";
      return jsonResponse({ error: message }, 500);
    }
  },
};
