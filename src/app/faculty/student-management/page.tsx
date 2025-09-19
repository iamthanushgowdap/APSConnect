"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import clsx from "clsx";

type UserRow = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  branch?: string;
  semester?: string;
  auth_id?: string;
  remarks?: string | null;
};

export default function FacultyStudentManagementPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<UserRow[]>([]);
  const [pending, setPending] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      // Fetch approved/other students for management
      const { data: studentsData, error: studErr } = await supabase
        .from("users")
        .select("id,name,email,role,status,branch,semester,remarks")
        .in("role", ["student"])
        .neq("status", "pending") // show approved/rejected in main list; pending in top section
        .order("name", { ascending: true });

      if (studErr) throw studErr;
      setStudents(studentsData ?? []);

      // Fetch pending users separately
      const { data: pendingData, error: pendErr } = await supabase
        .from("users")
        .select("id,name,email,role,status,branch,semester,remarks")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (pendErr) throw pendErr;
      setPending(pendingData ?? []);
    } catch (err: any) {
      console.error("fetchAll error", err);
      setMessage("Error loading students: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  function filteredStudents() {
    if (!search) return students;
    const s = search.toLowerCase();
    return students.filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(s) ||
        (u.email ?? "").toLowerCase().includes(s) ||
        (u.branch ?? "").toLowerCase().includes(s)
    );
  }

  // Approve or Reject helpers calling the API routes
  async function handleAction(userId: string, type: "approve" | "reject") {
    try {
      setActionLoading(true);
      const remarks = prompt(`Enter remarks for ${type === "approve" ? "approval" : "rejection"} (optional):`) || "";
      const res = await fetch(`/api/approvals/${userId}/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Server error");
      }

      // Refresh lists
      await fetchAll();
      setMessage(`${type === "approve" ? "Approved" : "Rejected"} successfully`);
    } catch (err: any) {
      console.error("action error", err);
      setMessage("Action failed: " + (err.message || err));
    } finally {
      setActionLoading(false);
      setTimeout(() => setMessage(null), 3500);
    }
  }

  if (loading) return <p className="p-4">Loading...</p>;
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Student Management</h1>

      {message && (
        <div className="bg-green-100 text-green-800 p-3 rounded">
          {message}
        </div>
      )}

      {/* Pending Approvals */}
      <section className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-semibold mb-3">Pending Approvals</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-600">No pending approvals.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead>
                <tr className="text-left">
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Email</th>
                  <th className="px-2 py-1">Branch</th>
                  <th className="px-2 py-1">Semester</th>
                  <th className="px-2 py-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-2 py-2">{u.name ?? "—"}</td>
                    <td className="px-2 py-2">{u.email}</td>
                    <td className="px-2 py-2">{u.branch ?? "—"}</td>
                    <td className="px-2 py-2">{u.semester ?? "—"}</td>
                    <td className="px-2 py-2">
                      <button
                        disabled={actionLoading}
                        onClick={() => handleAction(u.id, "approve")}
                        className="mr-2 px-3 py-1 rounded bg-green-600 text-white"
                      >
                        Approve
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() => handleAction(u.id, "reject")}
                        className="px-3 py-1 rounded bg-red-600 text-white"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Search & Student List */}
      <section className="bg-white shadow rounded p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Students</h2>
          <div className="flex items-center space-x-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name / email / branch"
              className="border px-3 py-1 rounded"
            />
            <button onClick={() => fetchAll()} className="px-3 py-1 rounded bg-gray-200">
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="text-left">
                <th className="px-2 py-1">Name</th>
                <th className="px-2 py-1">Email</th>
                <th className="px-2 py-1">Branch</th>
                <th className="px-2 py-1">Semester</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents().map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-2 py-2">{u.name ?? "—"}</td>
                  <td className="px-2 py-2">{u.email}</td>
                  <td className="px-2 py-2">{u.branch ?? "—"}</td>
                  <td className="px-2 py-2">{u.semester ?? "—"}</td>
                  <td className="px-2 py-2">
                    <span
                      className={clsx("px-2 py-0.5 rounded text-sm", {
                        "bg-green-100 text-green-800": u.status === "approved",
                        "bg-yellow-100 text-yellow-800": u.status === "pending",
                        "bg-red-100 text-red-800": u.status === "rejected",
                      })}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {/* Quick approve/reject from main list too */}
                    {u.status !== "approved" && (
                      <button
                        onClick={() => handleAction(u.id, "approve")}
                        disabled={actionLoading}
                        className="mr-2 px-2 py-1 rounded bg-green-600 text-white text-sm"
                      >
                        Approve
                      </button>
                    )}
                    {u.status !== "rejected" && (
                      <button
                        onClick={() => handleAction(u.id, "reject")}
                        disabled={actionLoading}
                        className="px-2 py-1 rounded bg-red-600 text-white text-sm"
                      >
                        Reject
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {students.length === 0 && (
            <p className="text-sm text-gray-500 mt-3">No students found.</p>
          )}
        </div>
      </section>
    </main>
  );
}
