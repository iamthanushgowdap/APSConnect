"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/login"); // redirect to login after 2s
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-600 to-purple-700">
      <div className="text-center animate-fadeIn">
        <h1 className="text-4xl font-bold text-white mb-4">APSConnect</h1>
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-white mt-4 text-sm">Loading...</p>
      </div>
    </main>
  );
}
