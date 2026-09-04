import { describe, it, expect, vi } from "vitest";
import { secureDispose } from "@/lib/secure-disposal";

describe("Secure Disposal & Right to Erasure (M7)", () => {
  it("explicitly invokes deleteDatabase for all known databases even if databases() is absent", async () => {
    const deletedDatabases: string[] = [];

    const mockDelete = vi.fn((name: string) => {
      deletedDatabases.push(name);
      return {
        set onsuccess(cb: () => void) {
          cb();
        },
        set onerror(_: unknown) {},
        set onblocked(_: unknown) {},
      };
    });

    // Mock indexedDB without databases() method
    const originalIDB = window.indexedDB;
    // @ts-expect-error test mock
    window.indexedDB = {
      deleteDatabase: mockDelete,
    };

    try {
      await secureDispose();
      expect(mockDelete).toHaveBeenCalled();
      expect(deletedDatabases).toContain("pedigree-pro-db");
      expect(deletedDatabases).toContain("pedigree-pro-keys");
      expect(deletedDatabases).toContain("keyval-store");
    } finally {
      window.indexedDB = originalIDB;
    }
  });
});
