import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message?: string;
  error?: Error | null;
  details?: string;
}

export function ErrorDialog({ open, onOpenChange, title = "Error Occurred", message, error, details }: ErrorDialogProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const shortMessage = error?.message
    ? error.message.length > 200
      ? error.message.substring(0, 200) + "…"
      : error.message
    : null;

  const errorLog = [
    `Title: ${title}`,
    `Message: ${message || "Unknown error"}`,
    error ? `Error: ${error.message}` : "",
    error?.stack ? `Stack:\n${error.stack}` : "",
    details ? `Details:\n${details}` : "",
    `Timestamp: ${new Date().toISOString()}`,
    `User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}`,
  ].filter(Boolean).join("\n\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(errorLog);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Error log copied for debugging.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-slate-200 dark:border-slate-800 max-w-lg bg-background/95 backdrop-blur-lg shadow-2xl rounded-xl sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-destructive">
            <AlertTriangle className="w-4 h-4" />
            {title}
          </DialogTitle>
          {message && (
            <DialogDescription className="text-sm text-foreground">
              {message}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="bg-muted/50 border border-border rounded p-3">
              <p className="text-xs font-mono text-destructive break-all">
                {showDetails ? error.message : shortMessage}
              </p>
              {error.message && error.message.length > 200 && (
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-primary underline mt-1"
                >
                  {showDetails ? "Show less" : "Show full message"}
                </button>
              )}
            </div>
          )}

          {details && (
            <div className="bg-muted/50 border border-border rounded p-3">
              <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                {details}
              </pre>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleCopy}
              variant="outline"
              className="flex-1"
              disabled={copied}
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? "Copied!" : "Copy Error Log"}
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Close
            </Button>
          </div>

          <p className="text-xs text-muted-foreground italic">
            Use the error log to debug the issue or report a bug.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
