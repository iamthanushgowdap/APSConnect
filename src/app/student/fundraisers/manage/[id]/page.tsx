"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ManageFundraiser() {
  const { id } = useParams();
  const [contributions, setContributions] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from("fundraiser_contributions")
        .select("*, users(name, usn)")
        .eq("fundraiser_id", id)
        .order("created_at", { ascending: false });
      setContributions(data || []);
    }
    loadData();
  }, [id]);

  async function verifyContribution(cid: string, status: "success" | "failed") {
    const { error } = await supabase
      .from("fundraiser_contributions")
      .update({ verified: status })
      .eq("id", cid);

    if (error) setMessage("❌ " + error.message);
    else {
      setMessage(`✅ Contribution marked as ${status}`);
      setContributions((prev) =>
        prev.map((c) => (c.id === cid ? { ...c, verified: status } : c))
      );
    }
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Manage Contributions</h1>
      {message && <p className="mb-4">{message}</p>}

      {contributions.length === 0 ? (
        <p>No contributions yet.</p>
      ) : (
        <ul className="space-y-4">
          {contributions.map((c) => (
            <li key={c.id} className="bg-white p-4 rounded shadow">
              <p>
                <strong>{c.users?.name} ({c.users?.usn})</strong> contributed ₹{c.amount}
              </p>
              {c.screenshot_url && (
                <img
                  src={c.screenshot_url}
                  alt="proof"
                  className="mt-2 w-40 border"
                />
              )}
              <p>Status: {c.verified}</p>
              {c.verified === "pending" && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => verifyContribution(c.id, "success")}
                    className="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Mark Success
                  </button>
                  <button
                    onClick={() => verifyContribution(c.id, "failed")}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Mark Failed
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
