import { ShieldCheck, Server, Radio, Lock, Database, Fingerprint, Wifi, Hash, Code, Heart, Globe, GitBranch } from "lucide-react";
import { PanelSection } from "@/components/shared/panels/PanelSection";

export default function AboutPage() {
  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Pedigree PRO</h1>
              <p className="text-sm text-muted-foreground">Zero-server clinical pedigree editor</p>
            </div>
          </div>

          <PanelSection title="Privacy &amp; Compliance" icon={<Lock className="w-3.5 h-3.5" />}>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Server className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Zero-server architecture</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No cloud servers, no data leaves your device. All data stays in local SQLite (desktop) or browser IndexedDB.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Database className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Encrypted at rest</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Browser mode encrypts the database with AES-256-GCM before writing to IndexedDB. SQLCipher protects the desktop database.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Fingerprint className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">HIPAA-aligned</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No third-party services, no analytics, no telemetry. Keys are stored in IndexedDB, never in localStorage.
                  </p>
                </div>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Networking" icon={<Wifi className="w-3.5 h-3.5" />}>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Radio className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">WebRTC peer-to-peer</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Share pedigrees directly over your local network. No signaling server, no data leaves the LAN.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                <Hash className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Hybrid encryption</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ed25519 keypairs with AES-GCM envelopes. Each recipient decrypts with their own stored private key.
                  </p>
                </div>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Technology" icon={<Code className="w-3.5 h-3.5" />}>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs">React + Vite</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <Database className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs">sql.js / SQLCipher</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs">Tauri (desktop)</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card">
                <Fingerprint className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs">Ed25519 + AES-GCM</span>
              </div>
            </div>
          </PanelSection>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Heart className="w-3 h-3" />
            <span>Pedigree PRO v1.0.0-1 · Built for clinical genetics</span>
          </div>
        </div>
      </div>
    </div>
  );
}
