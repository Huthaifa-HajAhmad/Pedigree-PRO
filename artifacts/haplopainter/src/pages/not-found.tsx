import { Link } from "wouter";
import { Dna } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Dna className="w-8 h-8 text-primary" />
          <span className="text-2xl font-bold tracking-tight text-primary">
            Pedigree PRO
          </span>
        </div>
        <div className="text-6xl font-bold text-muted-foreground">404</div>
        <div className="text-sm text-muted-foreground tracking-wide uppercase">Page Not Found</div>
        <Link href="/">
          <button
            data-testid="button-go-home"
            className="mt-6 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all bg-primary text-primary-foreground hover:opacity-90"
          >
            Return to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
