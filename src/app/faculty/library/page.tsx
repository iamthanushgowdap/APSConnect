"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FacultyLibraryPage() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: books } = await supabase.from("library").select("*").order("book_title");
    setCatalog(books ?? []);
    const { data: loans } = await supabase.from("library_active_loans").select("*").order("due_date");
    setActiveLoans(loans ?? []);
  }

  async function markReturned(txId: string) {
    const res = await fetch("/api/library/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: txId }),
    });
    const json = await res.json();
    if (!res.ok) setMessage("Return failed: " + (json.error || res.status));
    else {
      setMessage("Marked returned");
      load();
    }
    setTimeout(() => setMessage(""), 3000);
  }

  async function addBook() {
    const title = prompt("Book title");
    if (!title) return;
    const author = prompt("Author (optional)") || null;
    const copies = parseInt(prompt("Total copies (default 1)") || "1", 10) || 1;
    const { error } = await supabase.from("library").insert([{ book_title: title, author, total_copies: copies, available_copies: copies }]);
    if (error) setMessage("Add failed: " + error.message);
    else { setMessage("Book added"); load(); }
    setTimeout(() => setMessage(""), 3000);
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Library Management (Faculty)</h1>
      {message && <div className="bg-green-100 p-2 rounded">{message}</div>}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Catalog</h2>
        <div>
          <button onClick={addBook} className="bg-green-600 text-white px-3 py-1 rounded">Add Book</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {catalog.map(b => (
          <div key={b.id} className="border p-3 rounded">
            <div className="font-semibold">{b.book_title}</div>
            <div className="text-sm text-gray-600">{b.author}</div>
            <div className="text-sm">Available: {b.available_copies}/{b.total_copies}</div>
          </div>
        ))}
      </div>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold">Active Loans</h2>
        {activeLoans.length === 0 ? <p>No active loans</p> : (
          <ul>
            {activeLoans.map(l => (
              <li key={l.id} className="border-b py-2 flex justify-between">
                <div>
                  <div className="font-semibold">{l.book_title}</div>
                  <div className="text-sm text-gray-600">Student: {l.student_id} • Due: {l.due_date}</div>
                </div>
                <div>
                  <button onClick={() => markReturned(l.id)} className="bg-blue-600 text-white px-3 py-1 rounded">Mark Returned</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
