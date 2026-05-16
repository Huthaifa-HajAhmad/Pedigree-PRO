import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  pedigreeId: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PedigreeCanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Pedigree PRO] Canvas error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-dvh bg-background">
          <div className="max-w-md mx-auto p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Canvas rendering error</h1>
            <p className="text-sm text-muted-foreground">
              The pedigree canvas encountered an unexpected error. Your drafts have been preserved in local storage.
            </p>
            {this.state.error && (
              <pre className="text-xs text-muted-foreground bg-muted rounded p-3 text-left overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-sm rounded border border-border hover:border-primary hover:text-primary transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 transition-colors"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
