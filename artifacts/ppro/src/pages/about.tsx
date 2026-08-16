import { Server, Lock, Database, Fingerprint, Wifi, Hash, Code, Heart, Globe, GitBranch, CloudOff, Dna } from "lucide-react";
import { PanelSection } from "@/components/shared/panels/PanelSection";
import { getAppVersion } from "@/lib/version";

export default function AboutPage() {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/[0.08] flex items-center justify-center shadow-sm shadow-primary/4 p-2">
              <Dna className="w-full h-full text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Pedigree PRO</h1>
              <p className="text-sm text-muted-foreground">Local-first clinical pedigree editor</p>
            </div>
          </div>

          <PanelSection title="Privacy &amp; Compliance" icon={<Lock className="w-3.5 h-3.5" />}>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Server className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Local-first architecture</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All data stays on your device in local SQLite (desktop) or browser IndexedDB. An optional zero-knowledge relay enables encrypted link sharing — it never sees plaintext data.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Database className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Encrypted at rest</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Browser mode encrypts the database with AES-256-GCM before writing to IndexedDB. SQLCipher protects the desktop SQLite database.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Fingerprint className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">HIPAA-aligned &amp; Serverless</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No third-party analytics, telemetry trackers, or background logging. Private keys are saved securely via IndexedDB (never in plaintext localStorage).
                  </p>
                </div>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Networking & Sharing" icon={<Wifi className="w-3.5 h-3.5" />}>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Globe className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Self-contained encrypted links</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Share pedigrees directly via compressed base64url links containing the encrypted dataset. Requires zero server infrastructure.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <CloudOff className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Zero-knowledge relay</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Encrypted link sharing via an ephemeral relay storing encrypted blobs with auto-expiration. The relay operator never accesses plaintext.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Hash className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Hybrid encryption</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ed25519 keypairs with AES-256-GCM envelopes. Only designated recipients holding the corresponding private key can decrypt the data.
                  </p>
                </div>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Technology" icon={<Code className="w-3.5 h-3.5" />}>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">React + Vite + TS</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <Database className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">sql.js (WASM SQLite)</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Tauri + SQLCipher</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <Fingerprint className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">AES-256-GCM + noble-crypto</span>
              </div>
            </div>
          </PanelSection>


          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Heart className="w-3 h-3 text-destructive" />
            <span>Pedigree PRO {getAppVersion()} · Built for clinical genetics</span>
          </div>
        </div>
      </div>
    </div>
  );
}
