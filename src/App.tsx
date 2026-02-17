import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AuthCallback from "./pages/AuthCallback";
import Login from "./pages/Login";
import AccessDenied from "./pages/AccessDenied";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import ContactForm from "./pages/ContactForm";
import NotFound from "./pages/NotFound";
import GoogleCallback from "./pages/GoogleCallback";
import Portal from "./pages/Portal";
import Families from "./pages/Families";
import Discovery from "./pages/Discovery";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<AuthCallback />} />
            <Route path="/login" element={<Login />} />
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route path="/discovery" element={<Discovery />} />
            <Route path="/portal" element={<Portal />} />
            <Route path="/portal/:token" element={<Portal />} />
            <Route path="/google-callback" element={<ProtectedRoute><GoogleCallback /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/families" element={<ProtectedRoute><Families /></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
            <Route path="/contacts/new" element={<ProtectedRoute><ContactForm /></ProtectedRoute>} />
            <Route path="/contacts/:id" element={<ProtectedRoute><ContactDetail /></ProtectedRoute>} />
            <Route path="/contacts/:id/edit" element={<ProtectedRoute><ContactForm /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
