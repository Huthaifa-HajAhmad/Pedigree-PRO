import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[HaploClinical] Uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="max-w-md text-center p-8">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              An unexpected error occurred. Your data is safe — all unsaved changes were
              preserved in the local draft storage.
            </p>
            {this.state.error && (
              <pre className="text-xs text-left text-muted-foreground bg-muted border border-border rounded-lg p-3 mb-6 overflow-auto max-h-32 font-mono">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-4 h-4" /> Reload App
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}