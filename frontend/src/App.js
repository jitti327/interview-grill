import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import LandingPage from "@/pages/LandingPage";
import SetupPage from "@/pages/SetupPage";
import InterviewRoom from "@/pages/InterviewRoom";
import Dashboard from "@/pages/Dashboard";
import HistoryPage from "@/pages/HistoryPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ComparisonPage from "@/pages/ComparisonPage";
import ReportPage from "@/pages/ReportPage";

function App() {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <BrowserRouter>
        <AuthProvider>
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/interview/:sessionId" element={<InterviewRoom />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/compare" element={<ComparisonPage />} />
            <Route path="/report/:sessionId" element={<ReportPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#121212',
            border: '1px solid #27272A',
            color: '#FAFAFA',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            borderRadius: '2px',
          },
        }}
      />
    </div>
  );
}

export default App;
