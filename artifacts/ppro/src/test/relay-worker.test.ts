import { describe, it, expect } from "vitest";
import relayWorker, { generate128BitToken } from "../../../../services/relay/src/index";

class MockKV {
  private store = new Map<string, { value: string; expiration?: number }>();

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, {
      value,
      expiration: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined,
    });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiration && Date.now() > entry.expiration) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe("Zero-Knowledge Relay Worker", () => {
  it("generates 128-bit CSPRNG tokens with 22 URL-safe characters", () => {
    const token = generate128BitToken();
    expect(token).toHaveLength(22);
    expect(/^[A-Za-z0-9]{22}$/.test(token)).toBe(true);

    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const t = generate128BitToken();
      expect(set.has(t)).toBe(false);
      set.add(t);
    }
  });

  it("handles full lifecycle: share -> receive -> revoke", async () => {
    const kv = new MockKV();
    const env = { RELAY_KV: kv as unknown as KVNamespace };

    // 1. Share
    const shareReq = new Request("https://relay.pedigreepro.test/api/relay/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ciphertext: "encrypted-pedigree-ciphertext-sample-12345",
        encrypted_key: "wrapped-ephemeral-key-67890",
        ttl_hours: 24,
      }),
    });
    const shareRes = await relayWorker.fetch(shareReq, env);
    expect(shareRes.status).toBe(200);
    expect(shareRes.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(shareRes.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const shareBody = (await shareRes.json()) as { share_token: string; expires_at: string };
    expect(shareBody.share_token).toBeDefined();
    expect(shareBody.share_token.length).toBe(22);

    // 2. Receive
    const receiveReq = new Request("https://relay.pedigreepro.test/api/relay/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share_token: shareBody.share_token }),
    });
    const receiveRes = await relayWorker.fetch(receiveReq, env);
    expect(receiveRes.status).toBe(200);
    const receiveBody = (await receiveRes.json()) as { ciphertext: string; encrypted_key: string };
    expect(receiveBody.ciphertext).toBe("encrypted-pedigree-ciphertext-sample-12345");
    expect(receiveBody.encrypted_key).toBe("wrapped-ephemeral-key-67890");

    // 3. Short landing page
    const landingReq = new Request(`https://relay.pedigreepro.test/s/${shareBody.share_token}`, {
      method: "GET",
    });
    const landingRes = await relayWorker.fetch(landingReq, env);
    expect(landingRes.status).toBe(200);
    const landingHtml = await landingRes.text();
    expect(landingHtml).toContain("Pedigree PRO Encrypted Share");

    // 4. Unauthorized Revoke (without revoke_token -> 401)
    const badRevokeReq = new Request("https://relay.pedigreepro.test/api/relay/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share_token: shareBody.share_token, revoke_token: "wrong-token" }),
    });
    const badRevokeRes = await relayWorker.fetch(badRevokeReq, env);
    expect(badRevokeRes.status).toBe(401);

    // 5. Authorized Revoke (with valid revoke_token -> 204)
    const revokeReq = new Request("https://relay.pedigreepro.test/api/relay/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share_token: shareBody.share_token, revoke_token: shareBody.revoke_token }),
    });
    const revokeRes = await relayWorker.fetch(revokeReq, env);
    expect(revokeRes.status).toBe(204);

    // 6. Subsequent receive fails (404)
    const secondReceiveReq = new Request("https://relay.pedigreepro.test/api/relay/receive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share_token: shareBody.share_token }),
    });
    const secondReceive = await relayWorker.fetch(secondReceiveReq, env);
    expect(secondReceive.status).toBe(404);
  });

  it("enforces 2MB maximum payload size limit", async () => {
    const kv = new MockKV();
    const env = { RELAY_KV: kv as unknown as KVNamespace };

    const largeCiphertext = "A".repeat(2.5 * 1024 * 1024);
    const req = new Request("https://relay.pedigreepro.test/api/relay/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ciphertext: largeCiphertext }),
    });
    const res = await relayWorker.fetch(req, env);
    expect(res.status).toBe(413);
  });
});
