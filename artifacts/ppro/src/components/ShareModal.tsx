import { useState } from "react";
import { useSharePedigree, useListProfiles } from "@workspace/api-client-react";
import { Link2, Copy, Check, X, ExternalLink, Share2, Shield, ShieldAlert, Key, AlertTriangle, Eye, Pencil, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DynamicImportSpinner } from "@/components/ui/dynamic-import-spinner";

interface ShareModalProps {
  pedigreeId: number;
  pedigreeTitle: string;
  onClose: () => void;
}

/**
 * ShareModal — Clean, hierarchical share dialog.
 *
 * Generates a short share link via the zero-knowledge relay.
 * Relay stores only compressed, optionally-encrypted blobs.
 * Tokens expire after 7 days.
 */
export function ShareModal({ pedigreeId, pedigreeTitle, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [recipientKey, setRecipientKey] = useState("");
  const [accessMode, setAccessMode] = useState<"view" | "edit">("view");
  const [shareData, setShareData] = useState<{ token: string; shareUrl: string } | null>(null);

  const shareMutation = useSharePedigree();
  const { data: profiles } = useListProfiles();
  const senderName = profiles?.[0]?.display_name ?? "A colleague";

  const isEncrypted = !!recipientKey.trim();

  const handleGenerate = () => {
    const key = recipientKey.trim();
    shareMutation.mutate(
      { pedigreeId, recipientKey: key },
      {
        onSuccess: (data: { share_token: string; share_url?: string }) => {
          const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
          const rawUrl = data.share_url
            ? data.share_url.replace(window.location.origin, base)
            : `${base}/share/${data.share_token}`;
          const shareUrl = accessMode === "edit" ? `${rawUrl}?access=edit` : rawUrl;
          setShareData({ token: data.share_token, shareUrl });
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

  const handleEmail = () => {
    if (!shareData) return;
    const subject = encodeURIComponent(`${senderName} shared a pedigree with you — Pedigree PRO`);
    const body = encodeURIComponent(`View the shared pedigree:\n\n${shareData.shareUrl}\n\n— Sent via Pedigree PRO`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const securityLabel = (() => {
    if (isEncrypted && accessMode === "edit") return "End-to-end encrypted — only the recipient can create their own copy";
    if (isEncrypted) return "End-to-end encrypted — only the recipient can view";
    if (accessMode === "edit") return "Open link — recipient can create their own editable copy";
    return "Open link — anyone with the URL can view";
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md border border-border rounded-xl shadow-2xl bg-card overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm tracking-wide">Share Pedigree</h2>
              <p className="text-xs text-muted-foreground">Short link · 7-day expiry</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close share modal" className="text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title block */}
        <div className="px-5 pb-4 border-b border-border/50">
          <p className="text-base font-semibold text-foreground truncate" title={pedigreeTitle}>{pedigreeTitle}</p>
          <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${isEncrypted ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" : "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"}`}>
            {isEncrypted ? <Shield className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
            {securityLabel}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Access control */}
          {!shareData && (
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Recipient Access</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAccessMode("view")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${accessMode === "view" ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  View only
                </button>
                <button
                  type="button"
                  onClick={() => setAccessMode("edit")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${accessMode === "edit" ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Can edit
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {accessMode === "view"
                  ? "Recipient views the pedigree but cannot modify it."
                  : "Recipient opens the full editor and saves their own copy."}
              </p>
            </div>
          )}

          {/* Recipient public key */}
          {!shareData && (
            <div>
              <label htmlFor="share-recipient-key" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                <Key className="w-3 h-3 inline mr-1" />
                Recipient Key (optional)
              </label>
              <input
                id="share-recipient-key"
                value={recipientKey}
                onChange={(e) => setRecipientKey(e.target.value)}
                placeholder="Paste Ed25519 public key to encrypt…"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                data-testid="input-recipient-key"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Leave blank for an open share link. Encryption protects sensitive pedigree data.
              </p>
            </div>
          )}

          {/* Generate button */}
          {!shareData ? (
            <Button
              variant="default"
              onClick={handleGenerate}
              disabled={shareMutation.isPending}
              className="w-full"
            >
              {shareMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <DynamicImportSpinner message={isEncrypted ? "Encrypting & Generating…" : "Generating…"} size="sm" />
                </span>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  {isEncrypted ? "Generate Encrypted Link" : "Generate Share Link"}
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              {/* URL bar */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border border-l-[3px] border-l-primary bg-muted/50 font-mono text-xs">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate text-primary" title={shareData.shareUrl}>{shareData.shareUrl}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded"
                  title="Copy link"
                  aria-label={copied ? "Link copied" : "Copy share link"}
                >
                  {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Action row */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleEmail} className="flex-1">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </Button>
                <a
                  href={shareData.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Preview
                </a>
                <Button variant="outline" size="sm" onClick={() => { setShareData(null); setRecipientKey(""); }} title="New link" aria-label="Generate new share link">
                  ↺ New
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {shareMutation.isError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="text-xs text-destructive">
                <p className="font-medium">{shareMutation.error?.message ?? "Sharing failed."}</p>
                <p className="text-muted-foreground mt-0.5">
                  {shareMutation.error?.message?.includes("atob") || shareMutation.error?.message?.includes("base64")
                    ? "Invalid recipient key."
                    : "Check the relay is reachable, or use File → Export for offline transfer."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
