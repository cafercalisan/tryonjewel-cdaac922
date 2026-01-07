import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Generate from "./pages/Generate";
import Results from "./pages/Results";
import Gallery from "./pages/Gallery";
import Scenes from "./pages/Scenes";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/giris" element={<Login />} />
            <Route path="/kayit" element={<Signup />} />
            <Route path="/sahneler" element={<Scenes />} />
            <Route path="/panel" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/olustur" element={<ProtectedRoute><Generate /></ProtectedRoute>} />
            <Route path="/sonuclar" element={<ProtectedRoute><Results /></ProtectedRoute>} />
            <Route path="/gorsellerim" element={<ProtectedRoute><Gallery /></ProtectedRoute>} />
            <Route path="/hesap" element={<ProtectedRoute><Account /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
