// src/app/splash/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SplashPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        // Check if user session exists
        const { data } = await supabase.auth.getSession();
        const session = data?.session;

        if (session?.user) {
          // Fetch role to decide dashboard
          const { data: u } = await supabase
            .from("users")
            .select("role")
            .eq("auth_id", session.user.id)
            .maybeSingle();

          if (u?.role === "admin") router.push("/admin/dashboard");
          else if (u?.role === "faculty") router.push("/faculty/dashboard");
          else router.push("/student/dashboard");
        } else {
          router.push("/login");
        }
      } catch (err) {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }, 2000); // splash visible for 2s

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
      <div className="text-center animate-fadeIn">
        <h1 className="text-4xl font-extrabold mb-2">APSConnect</h1>
        <p className="text-lg opacity-80">Connecting Students, Faculty & Alumni</p>
        {loading && (
          <div className="mt-6 flex justify-center">
            <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </main>
  );
}
