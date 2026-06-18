import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSharePedigree, useListProfiles } from "@workspace/api-client-react";
import { Link2, Copy, Check, ExternalLink, Shield, ShieldAlert, Key, AlertTriangle, Eye, Pencil, Mail, Loader2, Wifi, Clock, Users, QrCode, Timer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { sodiumSealBox, sodiumOpenSealedBox } from "@workspace/crypto";

function isTauriDesktop(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

// Compress a string using native CompressionStream (gzip) and return base64url
async function compressString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const stream = new CompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(encoder.encode(input));
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  let binary = "";
  for (let i = 0; i < result.length; i++) {
    binary += String.fromCharCode(result[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Decompress a base64url string using native DecompressionStream (gzip)
async function decompressString(input: string): Promise<string> {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(result);
}

interface ShareModalProps {
  pedigreeId: number;
  pedigreeTitle: string;
  pedigreeData: string; // JSON string of the pedigree to share (used by LAN WebRTC)
  canvasNodes: any[];
  canvasEdges: any[];
  onPedigreeReceived?: (data: unknown) => void;
  onDecryptError?: (error: Error) => void;
  onClose: () => void;
  backgroundSaveVersion?: (label: string) => Promise<void>;
}

export function ShareModal({
  pedigreeId, pedigreeTitle, pedigreeData, canvasNodes, canvasEdges,
  onPedigreeReceived, onDecryptError, onClose, backgroundSaveVersion
}: ShareModalProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<"menu" | "relay" | "lan">("menu");

  // Summary metadata stats
  const totalPatients = canvasNodes.length;
  const relationshipCount = canvasEdges.length;
  const affectedCount = useMemo(() => canvasNodes.filter(n => n.affected).length, [canvasNodes]);
  const carrierCount = useMemo(() => canvasNodes.filter(n => n.carrier && !n.affected).length, [canvasNodes]);
  const formattedDate = useMemo(() => new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }), []);

  // ── Tab 1: Cloud Relay Share States ──────────────────────────────────────
  const [relayCopied, setRelayCopied] = useState(false);
  const [recipientKey, setRecipientKey] = useState("");
  const [accessMode, setAccessMode] = useState<"view" | "edit">("view");
  const [shareData, setShareData] = useState<{ token: string; shareUrl: string } | null>(null);

  const shareMutation = useSharePedigree();
  const { data: profiles } = useListProfiles();
  const senderName = profiles?.[0]?.display_name ?? "A colleague";

  const isEncrypted = !!recipientKey.trim();
  const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL ?? "https://pedigree-pro.pages.dev";

  const handleGenerateRelay = async () => {
    const key = recipientKey.trim();
    if (backgroundSaveVersion) {
      await backgroundSaveVersion("Auto-saved before Link Sharing");
    }
    shareMutation.mutate(
      { pedigreeId, recipientKey: key },
      {
        onSuccess: (data: { share_token: string; share_url?: string }) => {
          let shareUrl: string;
          if (isTauriDesktop()) {
            shareUrl = `${PUBLIC_APP_URL}/share/${data.share_token}`;
          } else {
            const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
            shareUrl = `${base}/share/${data.share_token}`;
          }
          if (accessMode === "edit") shareUrl += (shareUrl.includes("?") ? "&" : "?") + "access=edit";
          setShareData({ token: data.share_token, shareUrl });
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

  const handleEmailRelay = () => {
    if (!shareData) return;
    const subject = encodeURIComponent(`${senderName} shared a pedigree with you — Pedigree PRO`);
    const body = encodeURIComponent(`View the shared pedigree:\n\n${shareData.shareUrl}\n\n— Sent via Pedigree PRO`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
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

  const securityLabel = (() => {
    if (isEncrypted && accessMode === "edit") return "End-to-end encrypted — only recipient can edit";
    if (isEncrypted) return "End-to-end encrypted — only recipient can view";
    if (accessMode === "edit") return "Open link — recipient can view & edit copy";
    return "Open link — anyone with URL can view";
  })();

  // ── Tab 2: LAN P2P Share States ──────────────────────────────────────────
  const [lanMode, setLanMode] = useState<"host" | "join" | null>(null);
  const lanModeRef = useRef<"host" | "join" | null>(null);
  const [lanOffer, setLanOffer] = useState("");
  const [lanAnswer, setLanAnswer] = useState("");
  const [lanStatus, setLanStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const lanStatusRef = useRef<"idle" | "connecting" | "connected" | "error">("idle");
  const [lanError, setLanError] = useState("");
  const [lanCopied, setLanCopied] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    lanStatusRef.current = lanStatus;
  }, [lanStatus]);

  useEffect(() => {
    if (lanStatus === "connecting") {
      setCountdown(30);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            countdownRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [lanStatus]);

  const cleanupLan = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    try { dcRef.current?.close(); } catch {}
    try { pcRef.current?.close(); } catch {}
    dcRef.current = null;
    pcRef.current = null;
    lanModeRef.current = null;
  }, []);

  useEffect(() => {
    return cleanupLan;
  }, [cleanupLan]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [], // LAN only
    });

    pc.onicecandidate = async (event) => {
      if (event.candidate === null) {
        const currentMode = lanModeRef.current;
        const json = JSON.stringify(pc.localDescription);
        try {
          const compressed = await compressString(json);
          if (currentMode === "host") {
            setLanOffer(compressed);
          } else if (currentMode === "join") {
            setLanAnswer(compressed);
          }
        } catch {
          if (currentMode === "host") {
            setLanOffer(btoa(json));
          } else if (currentMode === "join") {
            setLanAnswer(btoa(json));
          }
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setLanStatus("connected");
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setLanStatus("error");
        setLanError("Connection failed. Try manual export/import.");
      }
    };

    return pc;
  }, []);

  const startHost = useCallback(async () => {
    setLanMode("host");
    lanModeRef.current = "host";
    setLanStatus("connecting");
    if (backgroundSaveVersion) {
      await backgroundSaveVersion("Auto-saved before LAN Sharing");
    }
    try {
      const pc = createPeerConnection();
      pcRef.current = pc;

      const iceTimeout = setTimeout(() => {
        if (lanStatusRef.current !== "connected") {
          setLanStatus("error");
          setLanError("ICE gathering timed out. Check network connectivity.");
        }
      }, 30_000);

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") clearTimeout(iceTimeout);
      };

      const dc = pc.createDataChannel("pedigree-share", { ordered: true });
      dcRef.current = dc;

      dc.onopen = async () => {
        let payload: string;
        // In the unified share modal, recipient key is read from the input if paste key exists
        const key = recipientKey.trim();
        if (key) {
          try {
            payload = await sodiumSealBox(pedigreeData, key);
          } catch {
            if (window.confirm("Encryption failed. Send data unencrypted instead? (Not recommended for HIPAA-compliance.)")) {
              payload = pedigreeData;
            } else {
              setLanStatus("error");
              setLanError("Sharing cancelled: encryption failed. Check the recipient's public key.");
              return;
            }
          }
        } else {
          payload = pedigreeData;
        }
        dc.send(JSON.stringify({ encrypted: !!key, data: payload }));
        setLanStatus("connected");
      };

      dc.onmessage = () => {};

      const localOffer = await pc.createOffer();
      await pc.setLocalDescription(localOffer);
    } catch (e) {
      setLanStatus("error");
      setLanError(e instanceof Error ? e.message : "Failed to create host connection");
    }
  }, [pedigreeData, recipientKey, createPeerConnection, backgroundSaveVersion]);

  const joinSession = useCallback(async () => {
    setLanMode("join");
    lanModeRef.current = "join";
    setLanStatus("connecting");
    try {
      if (!lanOffer) {
        throw new Error("Paste the host's offer first");
      }

      const pc = createPeerConnection();
      pcRef.current = pc;

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dcRef.current = dc;
        dc.onmessage = async (e) => {
          try {
            const envelope = JSON.parse(e.data);
            if (envelope.encrypted && envelope.data) {
              const { listProfilePrivateKeys } = await import("@workspace/browser-backend");
              const privateKeys = await listProfilePrivateKeys();
              let decrypted: string | null = null;
              for (const { privateKey } of privateKeys) {
                try {
                  decrypted = await sodiumOpenSealedBox(envelope.data, privateKey);
                  break;
                } catch {
                  // Key mismatch
                }
              }
              if (decrypted) {
                const data = JSON.parse(decrypted);
                onPedigreeReceived?.(data);
              } else {
                onDecryptError?.(new Error("Could not decrypt share: no matching private key"));
              }
            } else {
              const data = typeof envelope === "object" && envelope.data ? JSON.parse(envelope.data) : envelope;
              onPedigreeReceived?.(data);
            }
            setLanStatus("connected");
          } catch {
            setLanError("Invalid data received");
          }
        };
      };

      let remoteOfferJson: string;
      try {
        remoteOfferJson = await decompressString(lanOffer);
      } catch {
        remoteOfferJson = atob(lanOffer);
      }
      const remoteOffer = JSON.parse(remoteOfferJson);
      await pc.setRemoteDescription(remoteOffer);
      const localAnswer = await pc.createAnswer();
      await pc.setLocalDescription(localAnswer);
    } catch (e) {
      setLanStatus("error");
      setLanError(e instanceof Error ? e.message : "Failed to join session");
    }
  }, [lanOffer, onPedigreeReceived, createPeerConnection]);

  const completeHostConnection = useCallback(async () => {
    if (!lanAnswer || !pcRef.current) return;
    try {
      let remoteAnswerJson: string;
      try {
        remoteAnswerJson = await decompressString(lanAnswer);
      } catch {
        remoteAnswerJson = atob(lanAnswer);
      }
      const remoteAnswer = JSON.parse(remoteAnswerJson);
      await pcRef.current.setRemoteDescription(remoteAnswer);
    } catch (e) {
      setLanError("Invalid answer");
    }
  }, [lanAnswer]);

  const handleCopyLan = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setLanCopied(true);
      setTimeout(() => setLanCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setLanCopied(true); setTimeout(() => setLanCopied(false), 2000); } catch {}
      document.body.removeChild(ta);
    }
  }, []);

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="border border-slate-200 dark:border-slate-800 max-w-5xl p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-lg shadow-2xl flex flex-col md:flex-row h-[80vh] md:h-[580px] max-h-[90vh]">
        
        {/* Left Side: Summary Card */}
        <div className="w-full md:w-[280px] bg-slate-50/50 dark:bg-slate-950/40 p-6 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/60 shrink-0">
          <div className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">Active Pedigree</h3>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1 truncate" title={pedigreeTitle || "Untitled Pedigree"}>
                {pedigreeTitle || "Untitled Pedigree"}
              </h2>
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                <span>Share session on {formattedDate}</span>
              </div>
            </div>

            {/* Decorative DNA Helix */}
            <div className="hidden md:flex justify-center py-4 opacity-75">
              <svg className="w-32 h-20 text-teal-600/20 dark:text-teal-400/25" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10,20 Q25,5 40,20 T70,20 T100,20" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                <path d="M10,40 Q25,55 40,40 T70,40 T100,40" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                <line x1="20" y1="13" x2="20" y2="47" stroke="currentColor" strokeWidth="1.5" />
                <line x1="35" y1="17" x2="35" y2="43" stroke="currentColor" strokeWidth="1.5" />
                <line x1="50" y1="20" x2="50" y2="40" stroke="currentColor" strokeWidth="1.5" />
                <line x1="65" y1="23" x2="65" y2="37" stroke="currentColor" strokeWidth="1.5" />
                <line x1="80" y1="20" x2="80" y2="40" stroke="currentColor" strokeWidth="1.5" />
                <rect x="18" y="10" width="4" height="4" fill="#2dd4bf" rx="0.5" />
                <circle cx="20" cy="50" r="2.5" fill="#f43f5e" />
                <rect x="33" y="14" width="4" height="4" fill="#2dd4bf" rx="0.5" />
                <circle cx="35" cy="45" r="2.5" fill="#f43f5e" />
                <rect x="48" y="18" width="4" height="4" fill="#2dd4bf" rx="0.5" />
                <circle cx="50" cy="42" r="2.5" fill="#f43f5e" />
              </svg>
            </div>

            {/* Pedigree Metrics list */}
            <div className="space-y-4">
              <h4 className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Canvas Content</h4>
              
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span>Total Individuals</span>
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{totalPatients}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span>Relationships</span>
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{relationshipCount}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                  <span>Affected Patients</span>
                </span>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{affectedCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Carrier Members</span>
                </span>
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{carrierCount}</span>
              </div>
            </div>
          </div>

          <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-6 leading-relaxed hidden md:block">
            Sharing connections are established locally. Zero-knowledge relays and direct peer-to-peer data channels keep your clinical records strictly confidential.
          </div>
        </div>

        {/* Right Side: Tab Options */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">Share & Collaborate</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {activeTab === "menu" && "Select a method to share this pedigree with colleagues."}
                {activeTab === "relay" && "Generate a secure URL to share via cloud relay."}
                {activeTab === "lan" && "Share directly with a colleague on the same network using WebRTC."}
              </DialogDescription>
            </div>

            {/* tab 1: selection menu */}
            {activeTab === "menu" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("relay")}
                  className="group flex flex-col items-start text-left p-4 rounded-xl border border-border/60 bg-card hover:bg-accent hover:border-border transition-all active:scale-[0.98]"
                >
                  <div className="p-2 rounded-lg bg-teal-500/10 group-hover:bg-teal-500/25 transition-colors mb-3">
                    <Link2 className="w-5 h-5 text-teal-500" />
                  </div>
                  <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    Relay Link Sharing
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                    Generate a secure link via a zero-knowledge cloud relay (expires in 7 days). Supports optional public-key E2E encryption.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("lan")}
                  className="group flex flex-col items-start text-left p-4 rounded-xl border border-border/60 bg-card hover:bg-accent hover:border-border transition-all active:scale-[0.98]"
                >
                  <div className="p-2 rounded-lg bg-sky-500/10 group-hover:bg-sky-500/25 transition-colors mb-3">
                    <Wifi className="w-5 h-5 text-sky-500" />
                  </div>
                  <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    Direct LAN Share (P2P)
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                    Connect directly to a peer on the same local network using WebRTC. 100% serverless, zero-server data transfer (requires manual SDP exchange).
                  </p>
                </button>
              </div>
            )}

            {/* tab 2: cloud relay sharing */}
            {activeTab === "relay" && (
              <div className="space-y-4">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border ${isEncrypted ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" : "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"}`}>
                  {isEncrypted ? <Shield className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                  {securityLabel}
                </div>

                {!shareData ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Recipient Access</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAccessMode("view")}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors active:scale-95 ${accessMode === "view" ? "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400" : "border-border bg-muted/40 text-muted-foreground hover:bg-accent"}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View only
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccessMode("edit")}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-colors active:scale-95 ${accessMode === "edit" ? "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400" : "border-border bg-muted/40 text-muted-foreground hover:bg-accent"}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Can edit
                        </button>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-1.5">
                        {accessMode === "view"
                          ? "The recipient can view the pedigree in their browser but cannot save changes."
                          : "The recipient can modify the pedigree and save their own copy."}
                      </p>
                    </div>

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
                    </div>

                    <Button
                      variant="default"
                      onClick={handleGenerateRelay}
                      disabled={shareMutation.isPending}
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
                      <button
                        type="button"
                        onClick={handleCopyRelay}
                        className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors flex items-center justify-center"
                        title="Copy link"
                      >
                        {relayCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
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
                      <Button variant="outline" size="sm" onClick={() => { setShareData(null); setRecipientKey(""); }} className="font-bold">
                        New
                      </Button>
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
            )}

            {/* tab 3: local network direct P2P sharing */}
            {activeTab === "lan" && (
              <div className="space-y-4">
                {!lanMode && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={startHost}
                      className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-primary/20 transition-all"
                    >
                      <QrCode className="w-6 h-6 text-teal-500 mb-1 group-hover:scale-105 transition-transform" />
                      <span className="text-xs font-bold text-foreground">Host Session</span>
                      <span className="text-[10px] text-muted-foreground text-center">Generate offer to share this pedigree</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanMode("join")}
                      className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent/40 hover:border-primary/20 transition-all"
                    >
                      <Link2 className="w-6 h-6 text-sky-500 mb-1 group-hover:scale-105 transition-transform" />
                      <span className="text-xs font-bold text-foreground">Join Session</span>
                      <span className="text-[10px] text-muted-foreground text-center">Paste host's offer to receive data</span>
                    </button>
                  </div>
                )}

                {lanMode === "host" && (
                  <div className="space-y-4">
                    {lanStatus === "connecting" && !lanOffer && (
                      <div className="flex flex-col items-center gap-1.5 py-3 text-xs text-muted-foreground bg-muted/40 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                          <span>Generating WebRTC ICE descriptors...</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
                          <Timer className="w-3 h-3 text-slate-400" />
                          <span>Timeout in {countdown}s</span>
                        </div>
                      </div>
                    )}

                    {lanOffer && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Your Offer (send to guest)</label>
                          <span className="text-[9px] text-muted-foreground/60">
                            {lanOffer.length.toLocaleString()} chars
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <textarea
                            readOnly
                            aria-label="WebRTC offer"
                            value={lanOffer}
                            className="flex-1 h-20 px-2 py-1 text-xs font-mono bg-muted border border-border rounded-lg resize-none focus:outline-none whitespace-pre-wrap break-all"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopyLan(lanOffer)}
                            className="self-start p-2 rounded-lg border border-border hover:bg-accent text-muted-foreground transition-colors"
                          >
                            {lanCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Guest's Answer (paste here)</label>
                      <textarea
                        value={lanAnswer}
                        onChange={(e) => setLanAnswer(e.target.value)}
                        placeholder="Paste guest's WebRTC answer here..."
                        className="w-full h-20 px-2 py-1 text-xs font-mono bg-background border border-border rounded-lg resize-none focus:outline-none focus:border-teal-500 whitespace-pre-wrap break-all"
                      />
                    </div>

                    <Button
                      onClick={completeHostConnection}
                      disabled={!lanAnswer || lanStatus === "connected"}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold"
                    >
                      {lanStatus === "connected" ? "Connected ✓" : "Complete Connection"}
                    </Button>
                  </div>
                )}

                {lanMode === "join" && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Host's Offer (paste here)</label>
                      <textarea
                        value={lanOffer}
                        onChange={(e) => setLanOffer(e.target.value)}
                        placeholder="Paste host's WebRTC offer here..."
                        className="w-full h-20 px-2 py-1 text-xs font-mono bg-background border border-border rounded-lg resize-none focus:outline-none focus:border-teal-500 whitespace-pre-wrap break-all"
                      />
                    </div>

                    <Button
                      onClick={joinSession}
                      disabled={!lanOffer || lanStatus === "connecting"}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold"
                    >
                      {lanStatus === "connecting" ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Connecting... ({countdown}s)</span>
                        </span>
                      ) : "Join Session"}
                    </Button>

                    {lanAnswer && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Your Answer (send to host)</label>
                          <span className="text-[9px] text-muted-foreground/60">
                            {lanAnswer.length.toLocaleString()} chars
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <textarea
                            readOnly
                            aria-label="Your WebRTC answer"
                            value={lanAnswer}
                            className="flex-1 h-20 px-2 py-1 text-xs font-mono bg-muted border border-border rounded-lg resize-none focus:outline-none whitespace-pre-wrap break-all"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopyLan(lanAnswer)}
                            className="self-start p-2 rounded-lg border border-border hover:bg-accent text-muted-foreground transition-colors"
                          >
                            {lanCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {lanError && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/5">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-destructive">
                      <p className="font-bold">{lanError}</p>
                      <p className="text-muted-foreground mt-0.5">
                        WebRTC might be blocked by your router. Fall back to manual .ppro backup export.
                      </p>
                    </div>
                  </div>
                )}

                {lanStatus === "connected" && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Direct P2P channel established. Pedigree successfully shared!
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4 flex-shrink-0">
            {activeTab !== "menu" ? (
              <button
                type="button"
                onClick={() => {
                  cleanupLan();
                  setLanMode(null);
                  setLanOffer("");
                  setLanAnswer("");
                  setLanStatus("idle");
                  setLanError("");
                  setActiveTab("menu");
                }}
                className="text-xs font-bold text-slate-500 hover:text-primary transition-colors flex items-center gap-1"
              >
                ← Back to Share Options
              </button>
            ) : (
              <div />
            )}
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
