import { Loader2 } from "lucide-react";

interface DynamicImportSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export function DynamicImportSpinner({
  message = "Loading...",
  size = "md",
}: DynamicImportSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <Loader2
        className={`${sizeMap[size]} animate-spin text-primary`}
        role="status"
        aria-label={message}
      />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
