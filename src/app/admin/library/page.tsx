"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminLibraryPage() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: books } = await supabase.from("library").select("*").order("book_title");
    setCatalog(books ?? []);
    const { data: active } = await supabase.from("library_active_loans").select("*").order("due_date");
    setLoans(active ?? []);
  }

  async function adjustCopies(bookId: string) {
    const delta = parseInt(prompt("Enter change in total copies (use negative to reduce):", "1") || "0", 10);
    if (!delta) return;
    // fetch then update
    const { data: b } = await supabase.from("library").select("*").eq("id", bookId).maybeSingle();
    if (!b) return;
    const newTotal = Math.max(0, (b.total_copies || 0) + delta);
    const newAvailable = Math.max(0, (b.available_copies || 0) + delta);
    const { error } = await supabase.from("library").update({ total_copies: newTotal, available_copies: newAvailable }).eq("id", bookId);
    if (error) setMessage("Update failed: " + error.message);
    else { setMessage("Updated"); load(); }
    setTimeout(() => setMessage(""), 3000);
  }

  async function forceReturn(txId: string) {
    const res = await fetch("/api/library/return", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: txId })
    });
    const json = await res.json();
    if (!res.ok) setMessage("Return failed: " + (json.error || res.status));
    else { setMessage("Returned"); load(); }
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Library (Admin)</h1>
      {message && <div className="bg-green-100 p-2 rounded">{message}</div>}

      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold">Catalog</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {catalog.map(b => (
            <div key={b.id} className="border p-3 rounded flex justify-between">
              <div>
                <div className="font-semibold">{b.book_title}</div>
                <div className="text-sm text-gray-600">{b.author}</div>
                <div className="text-sm">Available: {b.available_copies}/{b.total_copies}</div>
              </div>
              <div className="space-y-2">
                <button onClick={() => adjustCopies(b.id)} className="px-3 py-1 bg-blue-600 text-white rounded">Adjust Copies</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold">Active Loans</h2>
        <ul>
          {loans.map(l => (
            <li key={l.id} className="border-b py-2 flex justify-between">
              <div>
                <div className="font-semibold">{l.book_title}</div>
                <div className="text-sm text-gray-600">Student ID: {l.student_id} — Due: {l.due_date}</div>
              </div>
              <div>
                <button onClick={() => forceReturn(l.id)} className="bg-green-600 text-white px-3 py-1 rounded">Force Return</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
