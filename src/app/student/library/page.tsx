// src/app/student/library/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Book = {
  id: string;
  title: string;
  author?: string;
  issued_to?: string | null;
  due_date?: string | null;
  created_at?: string;
};

export default function StudentLibrary() {
  const [books, setBooks] = useState<Book[]>([]);
  const [myIssued, setMyIssued] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setLoading(false);
        return;
      }
      const { data: student } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", auth.user.id)
        .single();
      if (!student?.id) {
        setLoading(false);
        return;
      }

      const { data: allBooks } = await supabase.from("library").select("*").order("created_at", { ascending: false });
      setBooks(allBooks || []);

      const { data: issued } = await supabase.from("library").select("*").eq("issued_to", student.id).order("due_date", { ascending: true });
      setMyIssued(issued || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="p-6">Loading library…</div>;

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Library</h1>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Books issued to you</h2>
        {myIssued.length === 0 ? (
          <p>No books currently issued.</p>
        ) : (
          <ul className="space-y-2">
            {myIssued.map((b) => (
              <li key={b.id} className="bg-white p-3 rounded shadow flex justify-between">
                <div>
                  <strong>{b.title}</strong>
                  <div className="text-sm text-gray-600">{b.author}</div>
                  <div className="text-xs text-gray-500">Due: {b.due_date ? new Date(b.due_date).toLocaleDateString() : "N/A"}</div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs ${b.due_date && new Date(b.due_date) < new Date() ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                    {b.due_date && new Date(b.due_date) < new Date() ? "Overdue" : "On time"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">All Library Books</h2>
        <ul className="space-y-2">
          {books.map((b) => (
            <li key={b.id} className="bg-white p-3 rounded shadow flex justify-between">
              <div>
                <strong>{b.title}</strong>
                <div className="text-sm text-gray-600">{b.author}</div>
              </div>
              <div className="text-right">
                {b.issued_to ? <span className="text-sm text-gray-500">Issued</span> : <span className="text-sm text-green-600">Available</span>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
