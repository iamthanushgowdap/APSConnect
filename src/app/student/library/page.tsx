"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Book = {
  id: string;
  book_title: string;
  author?: string;
  isbn?: string;
  available_copies: number;
  total_copies: number;
};

type Loan = {
  id: string;
  library_id: string;
  book_title: string;
  due_date: string;
  issued_at: string;
  status: string;
  fine_amount?: number;
};

export default function StudentLibraryPage() {
  const [catalog, setCatalog] = useState<Book[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedDue, setSelectedDue] = useState<string>("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: books } = await supabase.from("library").select("*").order("book_title");
    setCatalog(books ?? []);
    // user loans
   const { data, error } = await supabase.auth.getUser();
const user = data?.user;
if (!user) return;

const { data: uRow } = await supabase
  .from("users")
  .select("id")
  .eq("auth_id", user.id)   // ✅ use user.id
  .maybeSingle();
if (!uRow) return;

    const { data: myLoans } = await supabase.from("library_transactions").select("*, library(book_title)").eq("student_id", uRow.id).order("issued_at", { ascending: false });
    setLoans((myLoans ?? []).map((l: any) => ({ id: l.id, library_id: l.library_id, book_title: l.library.book_title, due_date: l.due_date, issued_at: l.issued_at, status: l.status, fine_amount: l.fine_amount })));
  }

  async function requestIssue(bookId: string) {
    // default due 14 days from now if not chosen
    const due = selectedDue || new Date(Date.now() + 14*24*60*60*1000).toISOString().slice(0,10);
    const res = await fetch("/api/library/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ library_id: bookId, due_date: due }),
    });
    const json = await res.json();
    if (!res.ok) setMessage("Issue failed: " + (json.error || res.status));
    else {
      setMessage("Book issued successfully");
      load();
    }
    setTimeout(() => setMessage(""), 3500);
  }

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Library</h1>
      {message && <div className="bg-green-100 p-2 rounded">{message}</div>}

      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold">Search & Request</h2>
        <div className="flex items-center space-x-2 mb-3">
          <input type="date" value={selectedDue} onChange={(e) => setSelectedDue(e.target.value)} className="border p-2 rounded" />
          <p className="text-sm text-gray-600">Select due date (optional). Default 14 days.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {catalog.map((b) => (
            <div key={b.id} className="border p-3 rounded flex justify-between items-center">
              <div>
                <div className="font-semibold">{b.book_title}</div>
                <div className="text-sm text-gray-600">{b.author} {b.isbn && `• ${b.isbn}`}</div>
                <div className="text-sm">Available: {b.available_copies}/{b.total_copies}</div>
              </div>
              <div>
                <button disabled={b.available_copies < 1} onClick={() => requestIssue(b.id)} className={`px-3 py-1 rounded ${b.available_copies < 1 ? 'bg-gray-300' : 'bg-blue-600 text-white'}`}>
                  Request
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold">My Loans</h2>
        {loans.length === 0 ? <p>No active loans.</p> : (
          <ul>
            {loans.map(l => (
              <li key={l.id} className="border-b py-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{l.book_title}</div>
                    <div className="text-sm text-gray-600">Due: {l.due_date} • Status: {l.status}</div>
  {(l.fine_amount ?? 0) > 0 && (
  <div className="text-sm text-red-600">Fine: ₹{l.fine_amount}</div>
)}
                  </div>
                  <div>
                    {/* Student cannot directly mark returned; usually faculty/admin will return, but you can provide a request flow */}
                    <button disabled className="px-3 py-1 bg-gray-300 rounded">Request Return</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
