"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FacultyFeesPage() {
  const [fees, setFees] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("fees").select("*, users(name, branch, semester)").order("created_at", { ascending: false });
    setFees(data ?? []);
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Branch Fee Records</h1>
      <ul>
        {fees.map((f) => (
          <li key={f.id} className="border-b py-2">
            {f.users?.name} — ₹{f.amount} — {f.status}
          </li>
        ))}
      </ul>
    </main>
  );
}
