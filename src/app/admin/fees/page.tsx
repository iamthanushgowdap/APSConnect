"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminFees() {
  const [fees, setFees] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadFees();
  }, []);

  async function loadFees() {
    const { data, error } = await supabase
      .from("fees")
      .select("*, users(name, usn, branch, semester)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading fees:", error);
      return;
    }
    setFees(data || []);
  }

  async function addFee(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("fees").insert([
      {
        student_id: studentId,
        amount,
        due_date: dueDate,
        status: "pending",
      },
    ]);

    if (error) {
      setMessage("Error adding fee: " + error.message);
      return;
    }

    setMessage("Fee record added.");
    setStudentId("");
    setAmount("");
    setDueDate("");
    loadFees();
  }

  async function updateStatus(feeId: string, status: "paid" | "verified" | "rejected") {
    const remark = prompt(`Enter remark for ${status}:`) || null;

    const { error } = await supabase
      .from("fees")
      .update({ status, remark, verified: status === "verified" })
      .eq("id", feeId);

    if (error) {
      setMessage("Error updating fee: " + error.message);
      return;
    }

    setMessage(`Fee ${status}`);
    loadFees();
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">Fee Management</h1>
      {message && <div className="bg-green-100 p-2 rounded">{message}</div>}

      {/* Add Fee Form */}
      <form onSubmit={addFee} className="bg-white p-4 rounded shadow space-y-2">
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
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          Add Fee
        </button>
      </form>

      {/* Fee List */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">All Fee Records</h2>
        <ul>
          {fees.map((f) => (
            <li key={f.id} className="border-b py-3">
              <p>
                <strong>{f.users?.name} ({f.users?.usn})</strong> — {f.users?.branch} (Sem {f.users?.semester})
              </p>
              <p>Amount: ₹{f.amount}</p>
              <p>Status: {f.status}</p>
              <p>Due: {f.due_date || "—"}</p>
              {f.remark && <p className="text-sm text-gray-600">Remark: {f.remark}</p>}
              <div className="space-x-2 mt-2">
                {f.status === "pending" && (
                  <button
                    onClick={() => updateStatus(f.id, "paid")}
                    className="bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    Mark Paid
                  </button>
                )}
                {f.status !== "verified" && (
                  <button
                    onClick={() => updateStatus(f.id, "verified")}
                    className="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Verify
                  </button>
                )}
                {f.status !== "rejected" && (
                  <button
                    onClick={() => updateStatus(f.id, "rejected")}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Reject
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
