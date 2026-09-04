import { describe, it, expect } from "vitest";
import {
  backup_database,
  restore_database,
} from "../../../../lib/browser-backend/src/commands/importExportCommands";
import { initDb, exec, query } from "../../../../lib/browser-backend/src/db";

describe("Portable Encrypted Backup Envelope (v2)", () => {
  it("creates and decrypts cross-device portable backup with PBKDF2 passphrase and embedded salt", async () => {
    await initDb();
    exec("INSERT INTO patients (first_name, last_name, sex) VALUES (?, ?, ?)", ["Alice", "Smith", "female"]);

    const passphrase = "CorrectHorseBatteryStaple123!";
    const backupJson = await backup_database({ passphrase });

    const parsed = JSON.parse(backupJson);
    expect(parsed.v).toBe("ppro-encrypted-backup-v2");
    expect(parsed.kdf).toBe("PBKDF2-HMAC-SHA512");
    expect(parsed.iterations).toBe(256000);
    expect(parsed.salt).toBeDefined();
    expect(parsed.ciphertext).toBeDefined();
    expect(parsed.iv).toBeDefined();

    // Wipe/reset the in-memory db
    exec("DELETE FROM patients", []);
    const beforeRestore = query<{ id: number }>("SELECT id FROM patients");
    expect(beforeRestore).toHaveLength(0);

    // Restore on simulated second device with correct passphrase
    await restore_database({ backup_data: backupJson, passphrase });
    const afterRestore = query<{ first_name: string; last_name: string }>("SELECT first_name, last_name FROM patients");
    expect(afterRestore.length).toBeGreaterThan(0);
    expect(afterRestore[0]?.first_name).toBe("Alice");
    expect(afterRestore[0]?.last_name).toBe("Smith");
  });

  it("fails restore when incorrect passphrase is provided", async () => {
    await initDb();
    const passphrase = "CorrectPassphrase!";
    const backupJson = await backup_database({ passphrase });

    await expect(
      restore_database({ backup_data: backupJson, passphrase: "WrongPassphrase!" })
    ).rejects.toThrow(/Invalid backup file/);
  });

  it("fails restore when passphrase is missing for v2 backup", async () => {
    await initDb();
    const passphrase = "RequiredPassphrase!";
    const backupJson = await backup_database({ passphrase });

    await expect(
      restore_database({ backup_data: backupJson })
    ).rejects.toThrow(/Passphrase required/);
  });
});

