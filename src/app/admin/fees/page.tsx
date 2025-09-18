"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminFees() {
  const [fees, setFees] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    async function loadFees() {
      const { data } = await supabase
        .from("fees")
        .select("*, users(name, usn)")
        .order("created_at", { ascending: false });
      setFees(data || []);
    }
    loadFees();
  }, []);

  async function addFee(e: React.FormEvent) {
    e.preventDefault();
    await supabase.from("fees").insert([
      {
        student_id: studentId,
        amount,
        due_date: dueDate,
      },
    ]);

    const { data } = await supabase
      .from("fees")
      .select("*, users(name, usn)")
      .order("created_at", { ascending: false });
    setFees(data || []);

    setStudentId("");
    setAmount("");
    setDueDate("");
  }

  async function markPaid(feeId: string) {
    await supabase.from("fees").update({ status: "paid" }).eq("id", feeId);

    const { data } = await supabase
      .from("fees")
      .select("*, users(name, usn)")
      .order("created_at", { ascending: false });
    setFees(data || []);
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Fee Management</h1>

      {/* Add Fee Form */}
      <form
        onSubmit={addFee}
        className="bg-white p-4 rounded shadow mb-6 space-y-2"
      >
        <input
          type="text"
          placeholder="Student ID"
          className="border p-2 rounded w-full"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount"
          className="border p-2 rounded w-full"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          type="date"
          className="border p-2 rounded w-full"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Add Fee
        </button>
      </form>

      {/* Fee List */}
      <h2 className="text-xl font-semibold mb-2">All Fees</h2>
      <ul>
        {fees.map((f) => (
          <li key={f.id} className="bg-white p-3 rounded shadow mb-2">
            <p>
              <strong>{f.users?.name} ({f.users?.usn})</strong>
            </p>
            <p>Amount: ₹{f.amount}</p>
            <p>Status: {f.status}</p>
            <p>Due: {f.due_date}</p>
            {f.status === "pending" && (
              <button
                onClick={() => markPaid(f.id)}
                className="bg-blue-600 text-white px-3 py-1 rounded mt-1"
              >
                Mark Paid
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
