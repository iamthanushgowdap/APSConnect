"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function StudentFees() {
  const [fees, setFees] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    async function loadFees() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: student } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();
      if (!student) return;

      const { data } = await supabase
        .from("fees")
        .select("*")
        .eq("student_id", student.id)
        .order("created_at", { ascending: false });

      setFees(data || []);
    }
    loadFees();
  }, []);

  async function uploadScreenshot(feeId: string) {
    if (!file) return;
    const filePath = `fees/${feeId}_${Date.now()}.png`;

    const { error } = await supabase.storage
      .from("fees")
      .upload(filePath, file);

    if (!error) {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fees/${filePath}`;
      await supabase
        .from("fees")
        .update({ payment_screenshot: url })
        .eq("id", feeId);
      alert("✅ Screenshot uploaded! Awaiting verification.");
    } else {
      alert("❌ Upload failed: " + error.message);
    }
  }

  const total = fees.reduce((sum, f) => sum + Number(f.amount), 0);
  const paid = fees
    .filter((f) => f.status === "paid")
    .reduce((sum, f) => sum + Number(f.amount), 0);
  const pending = total - paid;

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">My Fees</h1>

      <div className="bg-white p-4 rounded shadow mb-6">
        <p><strong>Total Fees:</strong> ₹{total}</p>
        <p><strong>Paid:</strong> ₹{paid}</p>
        <p><strong>Pending:</strong> ₹{pending}</p>
      </div>

      <h2 className="text-xl font-semibold mb-2">Fee Details</h2>
      <ul>
        {fees.map((f) => (
          <li key={f.id} className="bg-white p-3 rounded shadow mb-2">
            <p>Amount: ₹{f.amount}</p>
            <p>Status: {f.status}</p>
            <p>Due: {f.due_date}</p>

            {f.payment_screenshot ? (
              <a
                href={f.payment_screenshot}
                target="_blank"
                className="text-blue-600 underline"
              >
                📷 View Uploaded Screenshot
              </a>
            ) : (
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="border p-2 rounded w-full"
                />
                <button
                  onClick={() => uploadScreenshot(f.id)}
                  className="bg-blue-600 text-white px-4 py-2 rounded mt-2"
                >
                  Upload Payment Screenshot
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
