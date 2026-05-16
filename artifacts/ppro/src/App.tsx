import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/shared/Skeleton";
import { ThemeProvider } from "@/lib/theme";

const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Patients = lazy(() => import("@/pages/patients"));
const PatientDetail = lazy(() => import("@/pages/patient-detail"));
const Pedigrees = lazy(() => import("@/pages/pedigrees"));
const PedigreeCanvas = lazy(() => import("@/pages/pedigree-canvas"));
const PedigreeShare = lazy(() => import("@/pages/pedigree-share"));
const Profiles = lazy(() => import("@/pages/profiles"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Skeleton className="h-8 w-48" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function Router() {
  return (
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
              <Route component={NotFound} />
            </Switch>
          </Layout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
