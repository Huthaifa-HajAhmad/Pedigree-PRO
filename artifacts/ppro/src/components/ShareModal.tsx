import { useState, useMemo, useEffect } from "react";
import { useSharePedigree, useListProfiles } from "@workspace/api-client-react";
import { Link2, Copy, Check, ExternalLink, Shield, ShieldAlert, Key, AlertTriangle, Mail, Loader2, Clock, Info, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PedigreeSummaryPanel } from "@/components/shared/PedigreeSummaryPanel";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

function isTauriDesktop(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

interface ShareModalProps {
  pedigreeId: number;
  pedigreeTitle: string;
  canvasNodes: PedigreeNode[];
  canvasEdges: PedigreeEdge[];
  onClose: () => void;
  backgroundSaveVersion?: (label: string) => Promise<void>;
}

export function ShareModal({
  pedigreeId,
  pedigreeTitle,
  canvasNodes,
  canvasEdges,
  onClose,
  backgroundSaveVersion,
}: ShareModalProps) {
  const [relayCopied, setRelayCopied] = useState(false);
  const [recipientKey, setRecipientKey] = useState("");
  const [shareData, setShareData] = useState<{ token: string; shareUrl: string; revokeToken?: string; expiresAt?: string } | null>(null);
  const [myKeyCopied, setMyKeyCopied] = useState(false);
  const [generateCooldown, setGenerateCooldown] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const ACTIVE_SHARE_STORAGE_KEY = `ppro:active_share:${pedigreeId}`;

  // Restore active unexpired share from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_SHARE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.token === "string" && typeof parsed.shareUrl === "string") {
          const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt).getTime() : 0;
          if (expiresAt === 0 || Date.now() < expiresAt) {
            setShareData({
              token: parsed.token,
              shareUrl: parsed.shareUrl,
              revokeToken: parsed.revokeToken,
              expiresAt: parsed.expiresAt,
            });
          } else {
            localStorage.removeItem(ACTIVE_SHARE_STORAGE_KEY);
          }
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, [pedigreeId, ACTIVE_SHARE_STORAGE_KEY]);

  const shareMutation = useSharePedigree();
  const { data: profiles } = useListProfiles();
  const senderName = profiles?.[0]?.display_name ?? "A colleague";

  const isEncrypted = !!recipientKey.trim();
  const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL ?? "https://pedigree-pro.pages.dev";

  const formattedDate = useMemo(() => new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }), []);
  const expiryDate = useMemo(() => {
    if (shareData?.expiresAt) {
      return new Date(shareData.expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }, [shareData?.expiresAt]);

  const handleGenerateRelay = async () => {
    if (generateCooldown) return;
    setGenerateCooldown(true);
    setTimeout(() => setGenerateCooldown(false), 2000);

    const key = recipientKey.trim();
    if (backgroundSaveVersion) {
      await backgroundSaveVersion("Auto-saved before Link Sharing");
    }
    shareMutation.mutate(
      { pedigreeId, recipientKey: key },
      {
        onSuccess: (data: { share_token: string; share_url?: string; revoke_token?: string; expires_at?: string }) => {
          const shareUrl = data.share_url || (
            isTauriDesktop()
              ? `${PUBLIC_APP_URL}/share/${data.share_token}`
              : `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/share/${data.share_token}`
          );
          // Prefer authoritative server expiration timestamp; fallback to +7 days for offline shares
          const expiresAt = data.expires_at || (() => {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            return d.toISOString();
          })();
          // Note: Storing under ppro:active_share:${pedigreeId} preserves the most recent active
          // share for this pedigree so the clinician can return and revoke it within the TTL window.
          const activeShare = {
            token: data.share_token,
            shareUrl,
            revokeToken: data.revoke_token,
            expiresAt,
          };
          try {
            localStorage.setItem(ACTIVE_SHARE_STORAGE_KEY, JSON.stringify(activeShare));
          } catch {
            // Storage quota exceeded or disabled
          }
          setShareData(activeShare);
          setRevokeSuccess(false);
          setRevokeError(null);
        },
      }
    );
  };

  const handleCopyRelay = async () => {
    if (!shareData) return;
    await navigator.clipboard.writeText(shareData.shareUrl);
    setRelayCopied(true);
    setTimeout(() => setRelayCopied(false), 2000);
  };

  const handleEmailRelay = async () => {
    if (!shareData) return;
    const subject = encodeURIComponent(`${senderName} shared a pedigree with you — Pedigree PRO`);
    const body = encodeURIComponent(`View the shared pedigree:\n\n${shareData.shareUrl}\n\n— Sent via Pedigree PRO`);
    const url = `mailto:?subject=${subject}&body=${body}`;

    try {
      if (isTauriDesktop()) {
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(url);
      } else {
        window.location.href = url;
      }
    } catch {
      window.location.href = url;
    }
  };

  const handlePreviewRelay = async () => {
    if (!shareData) return;
    try {
      if (isTauriDesktop()) {
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(shareData.shareUrl);
      } else {
        window.open(shareData.shareUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      window.open(shareData.shareUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleRevoke = async () => {
    if (!shareData) return;
    setIsRevoking(true);
    setRevokeError(null);
    try {
      const { relayRevoke } = await import("@workspace/api-client-react");
      await relayRevoke(shareData.token, shareData.revokeToken);
      try {
        localStorage.removeItem(ACTIVE_SHARE_STORAGE_KEY);
      } catch {
        // Storage cleanup
      }
      setShareData(null);
      setRevokeSuccess(true);
    } catch (err) {
      console.error("Revocation failed", err);
      setRevokeError("Unable to revoke share link. Please verify your network connection or try again.");
    } finally {
      setIsRevoking(false);
    }
  };

  const securityLabel = isEncrypted
    ? "Recipient-encrypted (Ed25519 sealed box) — only matching profile key can decrypt"
    : "Zero-knowledge link (AES-256-GCM) — encrypted client-side, key in URL fragment";

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="border border-slate-200 dark:border-slate-800 max-w-5xl p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-lg shadow-2xl flex flex-col md:flex-row h-[80vh] md:h-[580px] max-h-[90vh]">
        
        {/* Left Side: Summary Card */}
        <PedigreeSummaryPanel
          title={pedigreeTitle}
          subtitle={`Share session on ${formattedDate}`}
          nodes={canvasNodes}
          edges={canvasEdges}
          footerText="Sharing connections are established locally. Zero-knowledge relays keep your clinical records strictly confidential."
        />

        {/* Right Side: Options and Actions */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">Share & Collaborate</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Generate a secure URL to share this pedigree via a zero-knowledge cloud relay (expires in 7 days).
              </DialogDescription>
            </div>

            <div className="space-y-4">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${isEncrypted ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" : "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"}`}>
                {isEncrypted ? <Shield className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                {securityLabel}
              </div>

              {!shareData ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="share-recipient-key" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      <Key className="w-3 h-3 inline mr-1" />
                      Recipient Key (optional)
                    </label>
                    <input
                      id="share-recipient-key"
                      value={recipientKey}
                      onChange={(e) => setRecipientKey(e.target.value)}
                      placeholder="Paste recipient's Ed25519 public key to encrypt…"
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-colors"
                    />
                    <p className="text-[9px] text-muted-foreground mt-1">
                      Leave blank for open share link. Adding a recipient key encrypts the data client-side before upload.
                    </p>

                    {/* Your Sharing Key — copy public key helper */}
                    {profiles?.[0]?.public_key && (
                      <div className="mt-3 p-3 rounded-lg border border-sky-500/20 bg-sky-500/5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1">
                            <Key className="w-3 h-3" />
                            Your Sharing Key
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(profiles[0]!.public_key);
                                setMyKeyCopied(true);
                                setTimeout(() => setMyKeyCopied(false), 2000);
                              } catch { /* clipboard not available */ }
                            }}
                            className="flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors px-1.5 py-0.5 rounded hover:bg-sky-500/10"
                          >
                            {myKeyCopied ? (
                              <><Check className="w-3 h-3" /> Copied!</>
                            ) : (
                              <><Copy className="w-3 h-3" /> Copy</>
                            )}
                          </button>
                        </div>
                        <code className="text-[10px] font-mono text-muted-foreground break-all leading-relaxed block">
                          {profiles[0]!.public_key}
                        </code>
                        <p className="text-[9px] text-muted-foreground/80 mt-2 leading-relaxed">
                          Send this key to your colleague so they can encrypt pedigrees specifically for you.
                        </p>
                      </div>
                    )}
                  </div>

                  {revokeSuccess && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span className="text-xs font-medium">
                        Previous sharing link successfully revoked and deleted from the relay service.
                      </span>
                    </div>
                  )}

                  <Button
                    variant="default"
                    onClick={handleGenerateRelay}
                    disabled={shareMutation.isPending || generateCooldown}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold"
                  >
                    {shareMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isEncrypted ? "Encrypting..." : "Generating..."}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <Link2 className="w-4 h-4" />
                        {isEncrypted ? "Generate Encrypted Link" : "Generate Share Link"}
                      </span>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-muted border border-border rounded-lg font-mono text-xs">
                    <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 truncate text-primary" title={shareData.shareUrl}>{shareData.shareUrl}</span>
                  </div>

                  {/* Share Link Expiry Indicator */}
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 px-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Link expires in 7 days ({expiryDate})</span>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCopyRelay} className="flex-1 font-bold">
                      {relayCopied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {relayCopied ? "Copied!" : "Copy URL"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleEmailRelay} className="flex-1 font-bold">
                      <Mail className="w-3.5 h-3.5 mr-1" />
                      Email
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePreviewRelay} className="flex-1 font-bold">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRevoke}
                      disabled={isRevoking}
                      className="font-bold text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 hover:border-destructive/30"
                    >
                      {isRevoking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldX className="w-3.5 h-3.5 mr-1" />
                      )}
                      Revoke
                    </Button>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        try {
                          localStorage.removeItem(ACTIVE_SHARE_STORAGE_KEY);
                        } catch {}
                        setShareData(null);
                        setRecipientKey("");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Generate another link
                    </Button>
                  </div>

                  {revokeError && (
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <div className="text-xs">
                        <p className="font-bold">Failed to revoke link</p>
                        <p className="opacity-80 mt-0.5">{revokeError}</p>
                      </div>
                    </div>
                  )}

                  {/* Share Actions Guide Banner */}
                  <div className="p-3 rounded-lg border border-teal-500/20 bg-teal-500/5 text-slate-600 dark:text-slate-300 text-[10px] leading-relaxed font-sans">
                    <div className="font-semibold text-teal-600 dark:text-teal-400 mb-1.5 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>Share Actions Guide & Privacy</span>
                    </div>
                    <ul className="space-y-1.5 list-disc pl-3">
                      <li>
                        <strong>Zero-Knowledge Relay:</strong> The relay server only sees end-to-end encrypted ciphertext. It never possesses private keys and cannot view clinical data.
                      </li>
                      <li>
                        <strong>Email:</strong> Automatically composes an email draft in your local system mail client.
                      </li>
                      <li>
                        <strong>Preview:</strong> Open the share URL in a new tab to verify what the recipient will see.
                      </li>
                      <li>
                        <strong>Revoke:</strong> Instantly deletes the encrypted payload from the relay service, invalidating the sharing link immediately.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {shareMutation.isError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-destructive">
                    <p className="font-bold">{shareMutation.error?.message ?? "Sharing failed."}</p>
                    <p className="text-muted-foreground mt-0.5">
                      Ensure the recipient public key is copied correctly, or export a .ppro backup file instead.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end border-t border-border/40 pt-4 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
