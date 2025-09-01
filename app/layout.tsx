"use client";

import { useState, useEffect } from "react";
import Toast from "@/components/Toast";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export default function RootLayout({ children }) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const listener = (e) => setToast(e.detail);
    window.addEventListener("show-toast", listener);
    return () => window.removeEventListener("show-toast", listener);
  }, []);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#373737]">
        {children}
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#313131",
              color: "#fff",
              borderRadius: "8px",
            },
            duration: 5000,
          }}
        />
      </body>
    </html>
  );
}