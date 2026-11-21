import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "../lib/firebase-client"; // registers the browser database for the shared store
import "../styles/globals.css";
import { SecretProvider } from "@/components/Secret";
import { ToastProvider } from "@/components/Toast";
import { TopProgress } from "@/components/TopProgress";
import { AuthProvider } from "@/lib/auth";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { AudiencePage, OverviewPage, PageLayout, PostPage, PostsPage } from "./pages/PageRoutes";
import { RequireAdmin } from "./pages/RequireAdmin";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SecretProvider>
          <ToastProvider>
            <Suspense fallback={null}>
              <TopProgress />
            </Suspense>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<RequireAdmin />}>
                <Route path="/" element={<Home />} />
                <Route path="/p/:pageId" element={<PageLayout />}>
                  <Route index element={<OverviewPage />} />
                  <Route path="posts" element={<PostsPage />} />
                  <Route path="audience" element={<AudiencePage />} />
                  <Route path="post/:postKey" element={<PostPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </SecretProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
