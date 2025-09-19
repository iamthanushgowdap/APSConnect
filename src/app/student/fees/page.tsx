"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function StudentFeesPage() {
  const [fees, setFees] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("fees").select("*").order("created_at", { ascending: false });
    setFees(data ?? []);
  }

  async function submitFee() {
    const res = await fetch("/api/fees/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, screenshot_url: screenshot }),
    });
    const json = await res.json();
    if (!res.ok) setMessage("Error: " + json.error);
    else {
      setMessage("Fee payment submitted");
      load();
    }
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">My Fee Records</h1>
      {message && <div className="bg-green-100 p-2">{message}</div>}

      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Submit Payment</h2>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="border p-2 mb-2 w-full" />
        <input value={screenshot} onChange={(e) => setScreenshot(e.target.value)} placeholder="Screenshot URL" className="border p-2 mb-2 w-full" />
        <button onClick={submitFee} className="bg-blue-600 text-white px-3 py-1 rounded">Submit</button>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">History</h2>
        <ul>
          {fees.map((f) => (
            <li key={f.id} className="border-b py-2">
              ₹{f.amount} — {f.status}
              {f.remark && <span className="text-sm text-gray-600"> ({f.remark})</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
