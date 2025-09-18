"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    async function loadBranches() {
      const { data, error } = await supabase.from("branches").select("*");
      if (error) console.error(error);
      else setBranches(data);
    }
    loadBranches();
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-6">APSConnect</h1>
      <h2 className="text-lg font-semibold mb-2">Branches from Supabase:</h2>
      <pre className="bg-gray-100 p-4 rounded w-full max-w-lg overflow-x-auto">
        {JSON.stringify(branches, null, 2)}
      </pre>
    </main>
  );
}
