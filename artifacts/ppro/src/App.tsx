import { Suspense, lazy, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Layout } from "@/components/Layout";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/lib/theme";
import { FontProvider } from "@/lib/font";
import { CanvasConfigProvider } from "@/features/pedigree-editor/context/CanvasConfigContext";
import { useListProfiles } from "@workspace/api-client-react";

const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Patients = lazy(() => import("@/pages/patients"));
const PatientDetail = lazy(() => import("@/pages/patient-detail"));
const Pedigrees = lazy(() => import("@/pages/pedigrees"));
const PedigreeCanvas = lazy(() => import("@/pages/pedigree-canvas"));
const PedigreeShare = lazy(() => import("@/pages/pedigree-share"));
const Profiles = lazy(() => import("@/pages/profiles"));
const Settings = lazy(() => import("@/pages/settings"));
const About = lazy(() => import("@/pages/about"));
const Onboarding = lazy(() => import("@/components/Onboarding"));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <div className="text-sm font-medium text-primary tracking-wider">Loading…</div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function Router() {
  const { data: profiles, isLoading } = useListProfiles();

  // In Tauri desktop mode, add a top border to visually separate the native
  // title bar from the web toolbar / ribbon. This prevents the title bar
  // from visually blending into the app chrome on Windows.
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isLoading) {
    return <PageLoader />;
  }

  if (!profiles || profiles.length === 0) {
    return (
      <div className={isTauri ? "border-t border-border/60" : ""}>
        <Suspense fallback={<PageLoader />}>
          <Onboarding />
        </Suspense>
      </div>
    );
  }

  return (
    <div className={isTauri ? "border-t border-border/60" : ""}>
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/pedigrees/:id" component={PedigreeCanvas} />
        <Route path="/share/:token" component={PedigreeShare} />
        <Route>
          <Layout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/patients" component={Patients} />
              <Route path="/patients/:id" component={PatientDetail} />
              <Route path="/pedigrees" component={Pedigrees} />
              <Route path="/profiles" component={Profiles} />
              <Route path="/settings" component={Settings} />
              <Route path="/about" component={About} />
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </Suspense>
    </div>
  );
}

function App() {
  useEffect(() => {
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    document.addEventListener("wheel", preventZoom, { passive: false });
    return () => {
      document.removeEventListener("wheel", preventZoom);
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <FontProvider>
          <CanvasConfigProvider>
          <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
          </CanvasConfigProvider>
        </FontProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
