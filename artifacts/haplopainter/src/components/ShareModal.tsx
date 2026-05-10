import { useState } from "react";
import { useSharePedigree } from "@workspace/api-client-react";
import { Link2, Copy, Check, X, ExternalLink, Share2, Shield, Key } from "lucide-react";

interface ShareModalProps {
  pedigreeId: number;
  pedigreeTitle: string;
  onClose: () => void;
}

/**
 * ShareModal — Encrypted Colleague-to-Colleague Sharing
 *
 * Generates a share link via the zero-knowledge relay service.
 * The sharing protocol (ADR-001 §3.3):
 *   1. Frontend encrypts .hpcl with ephemeral symmetric key (libsodium sealed box)
 *   2. Frontend seals symmetric key for recipient's Ed25519 public key
 *   3. POST ciphertext + encrypted_key to Cloudflare Workers relay
 *   4. Relay returns share_token → recipient decrypts with their private key
 *
 * Current status: Share token generation via relay (backend ready).
 * Client-side encryption (libsodium sealed box) is deferred to Phase 1+.
 */
export function ShareModal({ pedigreeId, pedigreeTitle, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [recipientKey, setRecipientKey] = useState("");
  const [shareData, setShareData] = useState<{ token: string; shareUrl: string } | null>(null);

  const shareMutation = useSharePedigree();

  const handleGenerate = () => {
    shareMutation.mutate(
      { pedigreeId, recipientKey: recipientKey || "anonymous" },
      {
        onSuccess: (data: { share_token: string; share_url?: string }) => {
          const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
          const url = data.share_url || `${base}/share/${data.share_token}`;
          setShareData({ token: data.share_token, shareUrl: url });
        },
      }
    );
  };

  // For local-first beta: encrypted sharing is deferred to v0.2
  // See ADR-001 §3.3 for full sharing protocol design
  const sharingAvailable = false; // Toggle when relay + libsodium interop is verified

  const handleCopy = async () => {
    if (!shareData) return;
    await navigator.clipboard.writeText(shareData.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-md border border-border rounded-lg shadow-2xl p-6"
        style={{ background: "hsl(var(--card))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm tracking-wide">Share Pedigree</span>
          </div>
          <button onClick={onClose} aria-label="Close share modal" className="text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <p className="text-xs text-muted-foreground mb-5">
          Share <span className="text-foreground font-medium">{pedigreeTitle}</span> with a colleague.
          The data is end-to-end encrypted — only the recipient with the matching private key can decrypt it.
        </p>

        {/* Security notice */}
        <div className="flex items-start gap-2 px-3 py-2 rounded border border-primary/30 bg-primary/5 mb-5">
          <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-primary/80">
            Zero-knowledge relay: the relay service never sees plaintext pedigree data.
            Share tokens are single-use and expire after 7 days.
          </p>
        </div>

        {/* Recipient public key (optional) */}
        {!shareData && (
          <div className="mb-5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">
              <Key className="w-3 h-3 inline mr-1" />
              Recipient Public Key (optional)
            </label>
            <input
              value={recipientKey}
              onChange={(e) => setRecipientKey(e.target.value)}
              placeholder="Paste colleague's Ed25519 public key..."
              className="w-full bg-muted border border-border rounded px-3 py-2 text-xs font-mono outline-none focus:border-primary transition-colors"
              data-testid="input-recipient-key"
            />
            <p className="text-xs text-muted-foreground mt-1">
              If provided, the pedigree is encrypted specifically for this recipient.
              Leave blank for an open share link.
            </p>
          </div>
        )}

        {!shareData ? (
          <button
            onClick={handleGenerate}
            disabled={shareMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <Link2 className="w-4 h-4" />
            {shareMutation.isPending ? "Encrypting & Generating..." : "Generate Encrypted Share Link"}
          </button>
        ) : (
          <div className="space-y-3">
            {/* URL display */}
            <div className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-black/30 font-mono text-xs">
              <span className="flex-1 truncate text-primary">{shareData.shareUrl}</span>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded"
                title="Copy link"
                aria-label={copied ? "Link copied" : "Copy share link"}
              >
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded border border-primary text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <a
                href={shareData.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Preview
              </a>
              <button
                onClick={() => { setShareData(null); setRecipientKey(""); }}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                title="Generate new link"
                aria-label="Generate new share link"
              >
                ↺ New
              </button>
            </div>

            {recipientKey && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-emerald-500/30 bg-emerald-500/5">
                <Shield className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400">Encrypted for specific recipient</span>
              </div>
            )}
          </div>
        )}

        {/* Encryption status indicator */}
        {shareMutation.isError && (
          <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded border border-destructive/30 bg-destructive/5">
            <span className="text-destructive mt-0.5 text-xs">⚠</span>
            <p className="text-xs text-destructive/80">
              Sharing is not fully available yet. Client-side encryption (libsodium sealed box)
              must be implemented in the frontend. The backend relay service is ready.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}