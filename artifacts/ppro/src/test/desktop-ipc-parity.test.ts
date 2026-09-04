import { describe, it, expect, beforeEach } from "vitest";
import { initDb } from "../../../../lib/browser-backend/src/db";
import { create_profile } from "../../../../lib/browser-backend/src/commands/profileCommands";
import { create_patient } from "../../../../lib/browser-backend/src/commands/patientCommands";
import { create_pedigree } from "../../../../lib/browser-backend/src/commands/pedigreeCommands";
import type { CreateProfileInput, CreatePatientInput, CreatePedigreeInput } from "../../../../lib/browser-backend/src/commands/types";

describe("Desktop / Browser IPC Command Parity (C1)", () => {
  beforeEach(async () => {
    await initDb();
  });

  it("handles create_profile with nested { input: ... } and flat arguments identically", () => {
    const flatArgs: CreateProfileInput = {
      display_name: "Dr. Alice Smith",
      role_label: "Clinical Geneticist",
    };
    const nestedArgs = {
      input: {
        display_name: "Dr. Bob Jones",
        role_label: "Genetic Counselor",
      },
    };

    const res1 = create_profile(flatArgs);
    const res2 = create_profile(nestedArgs);

    expect(res1.display_name).toBe("Dr. Alice Smith");
    expect(res1.role_label).toBe("Clinical Geneticist");
    expect(res2.display_name).toBe("Dr. Bob Jones");
    expect(res2.role_label).toBe("Genetic Counselor");
    expect(res1.id).toBeDefined();
    expect(res2.id).toBeDefined();
  });

  it("handles create_patient with nested { input: ... } and flat arguments identically", () => {
    const flatArgs: CreatePatientInput = {
      first_name: "John",
      last_name: "Doe",
      date_of_birth: "1985-05-15",
      sex: "male",
      referral_reason: "Cardiomyopathy screening",
    };
    const nestedArgs = {
      input: {
        first_name: "Jane",
        last_name: "Roe",
        date_of_birth: "1990-08-20",
        sex: "female",
        referral_reason: "BRCA1 screening",
      },
    };

    const res1 = create_patient(flatArgs);
    const res2 = create_patient(nestedArgs);

    expect(res1.first_name).toBe("John");
    expect(res1.last_name).toBe("Doe");
    expect(res2.first_name).toBe("Jane");
    expect(res2.last_name).toBe("Roe");
    expect(res1.id).toBeGreaterThan(0);
    expect(res2.id).toBeGreaterThan(0);
  });

  it("handles create_pedigree with nested { input: ... } and flat arguments identically", () => {
    const flatArgs: CreatePedigreeInput = {
      title: "Family A Pedigree",
      creator_key: "ed25519_pubkey_test",
      notes: "Index case II-2",
    };
    const nestedArgs = {
      input: {
        title: "Family B Pedigree",
        creator_key: "ed25519_pubkey_test",
        notes: "Index case III-1",
      },
    };

    const res1 = create_pedigree(flatArgs);
    const res2 = create_pedigree(nestedArgs);

    expect(res1.title).toBe("Family A Pedigree");
    expect(res1.creator_key).toBe("ed25519_pubkey_test");
    expect(res2.title).toBe("Family B Pedigree");
    expect(res2.creator_key).toBe("ed25519_pubkey_test");
    expect(res1.id).toBeGreaterThan(0);
    expect(res2.id).toBeGreaterThan(0);
  });

  it("enforces rename_all = 'snake_case' on every Tauri command in src-tauri (F3)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const srcTauriDir = path.resolve(__dirname, "../../src-tauri/src");
    if (!fs.existsSync(srcTauriDir)) return;

    const files = fs.readdirSync(srcTauriDir).filter((f) => f.endsWith(".rs"));
    expect(files.length).toBeGreaterThan(0);

    let commandCount = 0;
    for (const file of files) {
      const filePath = path.join(srcTauriDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trim();
        if (line.startsWith("#[tauri::command")) {
          commandCount++;
          expect(
            line,
            `File ${file}:${i + 1} has Tauri command missing rename_all = "snake_case": ${line}`
          ).toContain('rename_all = "snake_case"');
        }
      }
    }

    expect(commandCount).toBeGreaterThan(30);
  });

  it("ensures relay_share and share_pedigree return revoke_token and expires_at shape (G6)", async () => {
    // Mock global fetch to return a realistic relay worker response
    const originalFetch = global.fetch;
    const fakeExpiresAt = new Date(Date.now() + 168 * 3600 * 1000).toISOString();
    
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/relay/share")) {
        return new Response(
          JSON.stringify({
            share_token: "test_share_tok_123",
            revoke_token: "test_revoke_tok_456",
            expires_at: fakeExpiresAt,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    };

    try {
      const { relay_share, share_pedigree } = await import("../../../../lib/browser-backend/src/commands/sharingCommands");

      // Test relay_share return shape
      const relayRes = await relay_share({ ciphertext: "test_cipher", encrypted_key: "", ttl_hours: 168 });
      expect(relayRes).toHaveProperty("share_token", "test_share_tok_123");
      expect(relayRes).toHaveProperty("revoke_token", "test_revoke_tok_456");
      expect(relayRes).toHaveProperty("expires_at", fakeExpiresAt);
      expect(relayRes.share_url).toContain("test_share_tok_123");

      // Test share_pedigree return shape
      const p = create_pedigree({ title: "Test Tree", creator_key: "ed25519_key" });
      const shareRes = await share_pedigree({ pedigree_id: p.id, recipient_key: "" });
      expect(shareRes).toHaveProperty("share_token", "test_share_tok_123");
      expect(shareRes).toHaveProperty("revoke_token", "test_revoke_tok_456");
      expect(shareRes).toHaveProperty("expires_at", fakeExpiresAt);
      expect(shareRes.share_url).toContain("test_share_tok_123");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("handles safety snapshot retrieval and bounds (H7)", async () => {
    const { get_safety_snapshots } = await import("../../../../lib/browser-backend/src/commands/importExportCommands");
    const snapshots = await get_safety_snapshots();
    expect(Array.isArray(snapshots)).toBe(true);
    expect(snapshots.length).toBeLessThanOrEqual(2);
  });
});

