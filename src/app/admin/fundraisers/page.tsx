"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { sendNotification } from "@/lib/notify";

export default function AdminFundraisers() {
  const [fundraisers, setFundraisers] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("fundraisers")
        .select("*, users(name)")
        .order("created_at", { ascending: false });
      setFundraisers(data || []);
    }
    load();
  }, []);

  async function approve(id: string, success: boolean) {
    await supabase
      .from("fundraisers")
      .update({
        approved: success,
        remarks: success ? null : "❌ Rejected by Admin",
      })
      .eq("id", id);

    // Notify students when approved
    if (success) {
      const { data: students } = await supabase
        .from("users")
        .select("id")
        .eq("role", "student");

      students?.forEach(async (s) => {
        await sendNotification(
          s.id,
          "📢 New Fundraiser Approved",
          "A new fundraiser has been approved. Check Fundraisers section to contribute!"
        );
      });
    }

    const { data } = await supabase
      .from("fundraisers")
      .select("*, users(name)")
      .order("created_at", { ascending: false });
    setFundraisers(data || []);
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Fundraiser Approvals</h1>
      <ul>
        {fundraisers.map((f) => (
          <li key={f.id} className="bg-white p-4 rounded shadow mb-3">
            <h2 className="font-semibold">{f.title}</h2>
            <p>{f.description}</p>
            <p>Target: ₹{f.target_amount}</p>
            <p>Created by: {f.users?.name}</p>
            {f.qr_image && (
              <img src={f.qr_image} alt="QR" className="w-32 h-32 mt-2" />
            )}
            <p>Status: {f.approved ? "✅ Approved" : "⏳ Pending"}</p>
            {f.remarks && <p className="text-red-600">Remark: {f.remarks}</p>}
            {!f.approved && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => approve(f.id, true)}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  ✅ Approve
                </button>
                <button
                  onClick={() => approve(f.id, false)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  ❌ Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
