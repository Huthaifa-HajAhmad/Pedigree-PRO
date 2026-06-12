import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-sm gap-0 p-6 border border-slate-200 dark:border-slate-800 bg-background/95 backdrop-blur-lg shadow-2xl rounded-xl sm:rounded-xl">
        <DialogHeader className="flex flex-row items-start gap-3 mb-4 space-y-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            variant === "destructive" ? "bg-destructive/10" : "bg-primary/10"
          }`}>
            <AlertTriangle className={`w-4 h-4 ${variant === "destructive" ? "text-destructive" : "text-primary"}`} />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {message}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="flex gap-2 justify-end sm:justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
