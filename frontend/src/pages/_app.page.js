import "@/index.css";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/contexts/AuthContext";

export default function App({ Component, pageProps }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <AuthProvider>
        <Navbar />
        <Component {...pageProps} />
      </AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#121212",
            border: "1px solid #27272A",
            color: "#FAFAFA",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "13px",
            borderRadius: "2px",
          },
        }}
      />
    </div>
  );
}
