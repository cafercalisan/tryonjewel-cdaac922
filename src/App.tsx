import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { GenerationProvider } from "@/contexts/GenerationContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Route-based code splitting
const Landing = lazy(() => import("./pages/Landing"));
const Examples = lazy(() => import("./pages/Examples"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Generate = lazy(() => import("./pages/Generate"));
const Results = lazy(() => import("./pages/Results"));
const DesignResults = lazy(() => import("./pages/DesignResults"));
const CreateDesign = lazy(() => import("./pages/CreateDesign"));
const Gallery = lazy(() => import("./pages/Gallery"));
const ModelGallery = lazy(() => import("./pages/ModelGallery"));
const Videos = lazy(() => import("./pages/Videos"));
const Scenes = lazy(() => import("./pages/Scenes"));
const Account = lazy(() => import("./pages/Account"));
const Admin = lazy(() => import("./pages/Admin"));
const Studio = lazy(() => import("./pages/Studio"));
const Brand = lazy(() => import("./pages/Brand"));
const PremiumHeroDemo = lazy(() => import("./pages/PremiumHeroDemo"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <GenerationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/ornekler" element={<Examples />} />
                <Route path="/giris" element={<Login />} />
                <Route path="/kayit" element={<Signup />} />
                <Route path="/sahneler" element={<Scenes />} />
                <Route path="/demo/premium-hero" element={<PremiumHeroDemo />} />
                <Route path="/panel" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/olustur" element={<ProtectedRoute><Generate /></ProtectedRoute>} />
                <Route path="/sonuclar" element={<ProtectedRoute><Results /></ProtectedRoute>} />
                <Route path="/tasarim-sonuc" element={<ProtectedRoute><DesignResults /></ProtectedRoute>} />
                <Route path="/tasarim-olustur" element={<ProtectedRoute><CreateDesign /></ProtectedRoute>} />
                <Route path="/gorsellerim" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
                <Route path="/modellerim" element={<ProtectedRoute><ModelGallery /></ProtectedRoute>} />
                <Route path="/videolarim" element={<ProtectedRoute><Videos /></ProtectedRoute>} />
                <Route path="/studyo" element={<ProtectedRoute><Studio /></ProtectedRoute>} />
                <Route path="/markam" element={<ProtectedRoute><Brand /></ProtectedRoute>} />
                <Route path="/hesap" element={<ProtectedRoute><Account /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </GenerationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
