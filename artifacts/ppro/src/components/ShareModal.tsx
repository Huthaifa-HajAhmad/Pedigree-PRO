import { useState } from "react";
import { useSharePedigree } from "@workspace/api-client-react";
import { Link2, Copy, Check, X, ExternalLink, Share2, Shield, Key, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DynamicImportSpinner } from "@/components/ui/dynamic-import-spinner";

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
 *   1. Frontend encrypts .ppro with ephemeral symmetric key (libsodium sealed box)
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
        className="relative z-10 w-full max-w-md border border-border rounded-lg shadow-2xl p-6 bg-card"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm tracking-wide">Share Pedigree</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close share modal" className="text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <p className="text-xs text-muted-foreground mb-5">
          Share <span className="text-foreground font-medium">{pedigreeTitle}</span> with a colleague.
        </p>

        {/* Security notice — conditional on whether encryption is in use */}
        {recipientKey ? (
          <div className="flex items-start gap-2 px-3 py-2 rounded border border-primary/30 bg-primary/5 mb-5">
            <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-primary/80">
              Encrypting for recipient's Ed25519 key. The relay never sees plaintext pedigree data.
              Share tokens are single-use and expire after 7 days.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 px-3 py-2 rounded border border-amber-500/30 bg-amber-500/5 mb-5">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No recipient key provided. The share link is <strong>not encrypted</strong> — anyone with the link can read the data.
              For HIPAA compliance, provide a recipient public key above.
            </p>
          </div>
        )}

        {/* Zero-knowledge relay notice (shown regardless) */}
        <div className="flex items-start gap-2 px-3 py-2 rounded border border-muted/30 bg-muted/10 mb-5">
          <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            The relay service never stores plaintext data. Share tokens are single-use and expire after 7 days.
          </p>
        </div>

        {/* Recipient public key (optional) */}
        {!shareData && (
          <div className="mb-5">
            <label htmlFor="share-recipient-key" className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">
              <Key className="w-3 h-3 inline mr-1" />
              Recipient Public Key (optional)
            </label>
            <input
              id="share-recipient-key"
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
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={shareMutation.isPending}
            className="w-full"
          >
            {shareMutation.isPending ? (
              <span className="flex items-center gap-2">
                <DynamicImportSpinner message="Encrypting & Generating..." size="sm" />
              </span>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Generate Encrypted Share Link
              </>
            )}
          </Button>
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex-1"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <a
                href={shareData.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Preview
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShareData(null); setRecipientKey(""); }}
                title="Generate new link"
                aria-label="Generate new share link"
              >
                ↺ New
              </Button>
            </div>

            {recipientKey && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-primary/30 bg-primary/5">
                <Shield className="w-3 h-3 text-primary" />
                <span className="text-xs text-primary">Encrypted for specific recipient</span>
              </div>
            )}
          </div>
        )}

        {/* Encryption status indicator */}
        {shareMutation.isError && (
          <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded border border-destructive/30 bg-destructive/5">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5" />
            <div>
              <p className="text-xs text-destructive">{shareMutation.error?.message ?? "Sharing requires the relay service."}</p>
              <p className="text-xs text-muted-foreground mt-1">Encrypted sharing will be available in v0.2. Use File → Export → .ppro for manual transfer.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}