// src/app/layout.tsx
import "./globals.css";
import type { ReactNode } from "react";
import ClientShell from "@/components/clientshell";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
