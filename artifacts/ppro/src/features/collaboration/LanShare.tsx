import { useState, useCallback, useEffect, useRef } from "react";
import { Share2, QrCode, Link2, Copy, Check, X, AlertTriangle, Loader2, Timer } from "lucide-react";

interface LanShareProps {
  pedigreeData: string; // JSON string of the pedigree to share
  onClose: () => void;
  onPedigreeReceived?: (data: unknown) => void;
}

/**
 * LanShare — WebRTC data channel file transfer for LAN sharing.
 *
 * Manual SDP exchange via QR code or text paste.
 * No signaling server. No internet required.
 *
 * Note: This is a convenience feature. If WebRTC is unavailable,
 * the user falls back to manual .ppro export/import.
 */
export function LanShare({ pedigreeData, onClose, onPedigreeReceived }: LanShareProps) {
  const [mode, setMode] = useState<"host" | "join" | null>(null);
  const modeRef = useRef<"host" | "join" | null>(null);
  const [offer, setOffer] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === "connecting") {
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
  }, [status]);

  const cleanup = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    try { dcRef.current?.close(); } catch {}
    try { pcRef.current?.close(); } catch {}
    dcRef.current = null;
    pcRef.current = null;
    modeRef.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [], // LAN only, no STUN/TUN
    });

    pc.onicecandidate = (event) => {
      if (event.candidate === null) {
        const currentMode = modeRef.current;
        if (currentMode === "host") {
          setOffer(btoa(JSON.stringify(pc.localDescription)));
        } else if (currentMode === "join") {
          setAnswer(btoa(JSON.stringify(pc.localDescription)));
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setStatus("connected");
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setStatus("error");
        setError("Connection failed. Try manual export/import.");
      }
    };

    return pc;
  }, []);

  const startHost = useCallback(async () => {
    setMode("host");
    modeRef.current = "host";
    setStatus("connecting");
    try {
      const pc = createPeerConnection();
      pcRef.current = pc;

      // Timeout: if ICE gathering takes >30s, show error
      const iceTimeout = setTimeout(() => {
        if (status !== "connected") {
          setStatus("error");
          setError("ICE gathering timed out. Check network connectivity.");
        }
      }, 30_000);

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") clearTimeout(iceTimeout);
      };

      const dc = pc.createDataChannel("pedigree-share", {
        ordered: true,
      });
      dcRef.current = dc;

      dc.onopen = () => {
        dc.send(pedigreeData);
        setStatus("connected");
      };

      dc.onmessage = () => {};

      const localOffer = await pc.createOffer();
      await pc.setLocalDescription(localOffer);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to create host connection");
    }
  }, [pedigreeData]);

  const joinSession = useCallback(async () => {
    setMode("join");
    modeRef.current = "join";
    setStatus("connecting");
    try {
      if (!offer) {
        throw new Error("Paste the host's offer first");
      }

      const pc = createPeerConnection();
      pcRef.current = pc;

      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dcRef.current = dc;
        dc.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            onPedigreeReceived?.(data);
            setStatus("connected");
          } catch {
            setError("Invalid data received");
          }
        };
      };

      const remoteOffer = JSON.parse(atob(offer));
      await pc.setRemoteDescription(remoteOffer);
      const localAnswer = await pc.createAnswer();
      await pc.setLocalDescription(localAnswer);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to join session");
    }
  }, [offer, onPedigreeReceived]);

  const completeHostConnection = useCallback(async () => {
    if (!answer || !pcRef.current) return;
    try {
      const remoteAnswer = JSON.parse(atob(answer));
      await pcRef.current.setRemoteDescription(remoteAnswer);
    } catch (e) {
      setError("Invalid answer");
    }
  }, []);

  const handleCopy = useCallback(async (text: string) => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard not available");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select and copy via textarea
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
      document.body.removeChild(ta);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md border border-border rounded-lg shadow-2xl p-6 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">LAN Share</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Share directly with a colleague on the same network. No server, no internet needed.
          If this fails, use manual export/import instead.
        </p>

        {!mode && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={startHost}
              className="flex flex-col items-center gap-1.5 p-4 rounded border border-border hover:border-primary/30 hover:bg-accent transition-colors"
            >
              <QrCode className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium">Host Session</span>
              <span className="text-[10px] text-muted-foreground">Share this pedigree</span>
            </button>
            <button
              onClick={() => setMode("join")}
              className="flex flex-col items-center gap-1.5 p-4 rounded border border-border hover:border-primary/30 hover:bg-accent transition-colors"
            >
              <Link2 className="w-5 h-5 text-primary" />
              <span className="text-xs font-medium">Join Session</span>
              <span className="text-[10px] text-muted-foreground">Receive a pedigree</span>
            </button>
          </div>
        )}

        {mode === "host" && (
          <div className="space-y-3">
            {status === "connecting" && !offer && (
              <div className="flex flex-col items-center gap-2 py-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Establishing connection...</span>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <Timer className="w-3 h-3" />
                  <span>ICE timeout in {countdown}s</span>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Your Offer (send to guest)</label>
              <div className="flex gap-2">
                <textarea
                  readOnly
                  value={offer}
                  className="flex-1 h-20 px-2 py-1.5 text-[10px] font-mono bg-muted border border-border rounded resize-none focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(offer)}
                  className="self-start p-2 rounded hover:bg-accent text-muted-foreground transition-colors"
                  title="Copy offer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Guest's Answer (paste here)</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Paste answer from guest..."
                className="w-full h-20 px-2 py-1.5 text-[10px] font-mono bg-background border border-border rounded resize-none focus:outline-none focus:border-primary"
              />
            </div>

            <button
              onClick={completeHostConnection}
              disabled={!answer || status === "connected"}
              className="w-full py-2 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {status === "connected" ? "Connected ✓" : "Complete Connection"}
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Host's Offer (paste here)</label>
              <textarea
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="Paste offer from host..."
                className="w-full h-20 px-2 py-1.5 text-[10px] font-mono bg-background border border-border rounded resize-none focus:outline-none focus:border-primary"
              />
            </div>

            <button
              onClick={joinSession}
              disabled={!offer || status === "connecting"}
              className="w-full py-2 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {status === "connecting" ? (
                <span className="flex flex-col items-center gap-1">
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-primary/70">
                    <Timer className="w-2.5 h-2.5" />
                    ICE timeout in {countdown}s
                  </span>
                </span>
              ) : "Join Session"}
            </button>

            {answer && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Your Answer (send to host)</label>
                <div className="flex gap-2">
                  <textarea
                    readOnly
                    value={answer}
                    className="flex-1 h-20 px-2 py-1.5 text-[10px] font-mono bg-muted border border-border rounded resize-none focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopy(answer)}
                    className="self-start p-2 rounded hover:bg-accent text-muted-foreground transition-colors"
                    title="Copy answer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded border border-destructive/30 bg-destructive/5">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5" />
            <div>
              <p className="text-xs text-destructive">{error}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Use File → Export → .ppro and share the file manually.
              </p>
            </div>
          </div>
        )}

        {status === "connected" && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded border border-green-500/30 bg-green-500/5">
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-green-400">Connected! Data transferred.</span>
          </div>
        )}
      </div>
    </div>
  );
}
