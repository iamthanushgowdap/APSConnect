// src/components/ClientShell.tsx
"use client";

import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { ReactNode } from "react";

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Topbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4">{children}</main>
      </div>
    </>
  );
}
