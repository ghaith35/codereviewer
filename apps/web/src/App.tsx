import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { RequireAuth } from "./components/RequireAuth.js";
import { PageSkeleton } from "./components/PageSkeleton.js";

const LandingPage    = lazy(() => import("./pages/LandingPage.js").then((m) => ({ default: m.LandingPage })));
const DashboardPage  = lazy(() => import("./pages/DashboardPage.js").then((m) => ({ default: m.DashboardPage })));
const RepositoryPage = lazy(() => import("./pages/RepositoryPage.js").then((m) => ({ default: m.RepositoryPage })));
const AnalysisPage   = lazy(() => import("./pages/AnalysisPage.js").then((m) => ({ default: m.AnalysisPage })));
const ReportPage     = lazy(() => import("./pages/ReportPage.js").then((m) => ({ default: m.ReportPage })));
const SettingsPage   = lazy(() => import("./pages/SettingsPage.js").then((m) => ({ default: m.SettingsPage })));
const NotFoundPage   = lazy(() => import("./pages/NotFoundPage.js").then((m) => ({ default: m.NotFoundPage })));

export default function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/dashboard"             element={<DashboardPage />} />
          <Route path="/repos/:id"             element={<RepositoryPage />} />
          <Route path="/analyses/:id"          element={<AnalysisPage />} />
          <Route path="/analyses/:id/report"   element={<ReportPage />} />
          <Route path="/settings"              element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
