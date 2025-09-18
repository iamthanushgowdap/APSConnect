"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminDashboard() {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [remark, setRemark] = useState<{ [key: string]: string }>({});

  // Load pending users
  async function loadPending() {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("status", "pending")
      .eq("role", "student");

    if (error) console.error(error);
    else setPendingUsers(data || []);
  }

  useEffect(() => {
    loadPending();
  }, []);

  // Approve student
  async function handleApprove(id: string) {
    setLoading(true);
    await supabase.from("users").update({ status: "approved", admin_remark: null }).eq("id", id);
    await loadPending();
    setLoading(false);
  }

  // Reject student
  async function handleReject(id: string) {
    if (!remark[id]) {
      alert("Please enter a remark before rejecting.");
      return;
    }
    setLoading(true);
    await supabase
      .from("users")
      .update({ status: "rejected", admin_remark: remark[id] })
      .eq("id", id);
    await loadPending();
    setLoading(false);
  }

  return (
    <main className="min-h-screen p-6 bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <h2 className="text-xl font-semibold mb-4">Pending Student Approvals</h2>

      {pendingUsers.length === 0 ? (
        <p>No pending students 🎉</p>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map((user) => (
            <div key={user.id} className="bg-white shadow rounded p-4">
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>USN:</strong> {user.usn}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Branch:</strong> {user.branch}</p>
              <p><strong>Semester:</strong> {user.semester}</p>

              {/* Remark box */}
              <textarea
                placeholder="Enter rejection remark"
                value={remark[user.id] || ""}
                onChange={(e) => setRemark({ ...remark, [user.id]: e.target.value })}
                className="w-full border rounded p-2 mt-2"
              />

              {/* Action buttons */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleApprove(user.id)}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(user.id)}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
