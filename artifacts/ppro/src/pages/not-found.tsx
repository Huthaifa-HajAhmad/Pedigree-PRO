import { Link } from "wouter";
import { Dna } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="min-h-dvh w-full flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Dna className="w-8 h-8 text-primary" />
          <span className="text-2xl font-bold tracking-tight text-primary">
            Pedigree PRO
          </span>
        </div>
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <p className="text-sm text-muted-foreground tracking-wide uppercase">Page Not Found</p>
        <Link href="/">
          <Button data-testid="button-go-home" className="mt-6">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </section>
  );
}
