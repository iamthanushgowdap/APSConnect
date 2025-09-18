"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sendNotification } from "@/lib/notify";

interface Payment {
  id: string;
  amount: number;
  status: string;
  screenshot_url: string | null;
  users?: { name: string; usn: string };
  fundraisers?: { title: string; created_by: string };
}

export default function ManageFundraiser() {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: creator } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      if (!creator) return;

      const { data } = await supabase
        .from("fundraiser_payments")
        .select("*, users(name, usn), fundraisers(title, created_by)")
        .order("created_at", { ascending: false });

      if (data) {
        const mine = data.filter((p: any) => p.fundraisers?.created_by === creator.id);
        setPayments(mine);
      }
    }
    load();
  }, []);

  async function mark(id: string, status: "success" | "failed") {
    await supabase.from("fundraiser_payments").update({ status }).eq("id", id);

    const { data: pay } = await supabase
      .from("fundraiser_payments")
      .select("student_id, fundraiser_id")
      .eq("id", id)
      .single();

    if (!pay) return;

    const { data: f } = await supabase
      .from("fundraisers")
      .select("title")
      .eq("id", pay.fundraiser_id)
      .single();

    if (pay.student_id && f) {
      await sendNotification(
        pay.student_id,
        "📢 Payment Verification Update",
        `Your contribution for "${f.title}" was marked as ${status.toUpperCase()}.`
      );
    }

    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status } : p))
    );
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">My Fundraiser Payments</h1>
      <ul>
        {payments.map((p) => (
          <li key={p.id} className="bg-white p-4 rounded shadow mb-3">
            <h2 className="font-semibold">{p.fundraisers?.title || "Untitled"}</h2>
            <p>
              <strong>{p.users?.name || "Unknown"} ({p.users?.usn || "N/A"})</strong> paid ₹{p.amount}
            </p>
            {p.screenshot_url && (
              <a
                href={p.screenshot_url}
                target="_blank"
                className="text-blue-600 underline block mt-1"
              >
                📷 View Screenshot
              </a>
            )}
            <p>Status: {p.status}</p>
            {p.status === "pending" && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => mark(p.id, "success")}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  ✅ Mark Success
                </button>
                <button
                  onClick={() => mark(p.id, "failed")}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  ❌ Mark Failed
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
