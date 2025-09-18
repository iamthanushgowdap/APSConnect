// src/app/faculty/student-management/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Faculty Student Management
 * - List students in assigned branches/semesters
 * - Search, filter, pagination
 * - Approve / Reject (with remark) for pending students in faculty's assigned classes
 * - View student profile preview
 * - Bulk actions (approve selected)
 */

type Student = {
  id: string;
  name: string;
  usn?: string;
  branch?: string;
  semester?: string;
  status?: string; // pending, approved, rejected
  remark?: string | null;
  email?: string;
};

export default function FacultyStudentManagement() {
  const [faculty, setFaculty] = useState<any | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setMessage("Login required.");
          return;
        }
        const { data: f } = await supabase.from("users").select("id,name,assigned_branches,assigned_semesters").eq("auth_id", auth.user.id).single();
        setFaculty(f || null);
        await loadStudents(f);
      } catch (err) {
        console.error("init error", err);
        setMessage("Failed.");
      } finally {
        setLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStudents(fac?: any) {
    setLoading(true);
    setMessage(null);
    try {
      // Build query: faculty can view students in their assigned branches only
      let q = supabase.from("users").select("id,name,usn,branch,semester,status,remark,email", { count: "exact" }).eq("role", "student");
      if (fac?.assigned_branches && fac.assigned_branches.length) {
        q = q.in("branch", fac.assigned_branches);
      }
      if (search) {
        q = q.ilike("name", `%${search}%`);
      }
      if (filterStatus !== "all") {
        q = q.eq("status", filterStatus);
      }
      q = q.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      setStudents(data || []);
      setTotal(count || 0);
      // reset selections
      setSelected({});
    } catch (err: any) {
      console.error("loadStudents err", err);
      setMessage("Failed to load students.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((p) => ({ ...p, [id]: !p[id] }));
  }

  async function approveStudent(id: string) {
    const remark = prompt("Optional remark for approval (leave blank if none):", "");
    try {
      const { error } = await supabase.from("users").update({ status: "approved", remark: remark || null }).eq("id", id);
      if (error) throw error;
      setMessage("Student approved.");
      await loadStudents(faculty);
    } catch (err: any) {
      console.error(err);
      setMessage("Approve failed.");
    }
  }

  async function rejectStudent(id: string) {
    const remark = prompt("Enter remark for rejection (required):", "");
    if (!remark) {
      alert("Rejection remark required.");
      return;
    }
    try {
      const { error } = await supabase.from("users").update({ status: "rejected", remark }).eq("id", id);
      if (error) throw error;
      setMessage("Student rejected.");
      await loadStudents(faculty);
    } catch (err: any) {
      console.error(err);
      setMessage("Reject failed.");
    }
  }

  async function bulkApprove() {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) return alert("No students selected.");
    if (!confirm(`Approve ${ids.length} students?`)) return;
    try {
      const { error } = await supabase.from("users").update({ status: "approved", remark: null }).in("id", ids);
      if (error) throw error;
      setMessage(`Approved ${ids.length} students.`);
      await loadStudents(faculty);
    } catch (err: any) {
      console.error(err);
      setMessage("Bulk approve failed.");
    }
  }

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Student Management</h1>
      {message && <div className="mb-3 text-sm text-red-600">{message}</div>}

      <div className="bg-white p-3 rounded shadow mb-4">
        <div className="flex gap-2 mb-3">
          <input placeholder="Search student name" value={search} onChange={(e) => setSearch(e.target.value)} className="border p-2 rounded flex-1" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border p-2 rounded">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button onClick={() => loadStudents(faculty)} className="bg-blue-600 text-white px-3 py-1 rounded">Search</button>
          <button onClick={bulkApprove} className="bg-green-600 text-white px-3 py-1 rounded">Bulk Approve</button>
        </div>

        {loading ? <p>Loading students…</p> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border"><input type="checkbox" onChange={(e) => { const on = e.target.checked; const map: Record<string, boolean> = {}; students.forEach(s => map[s.id] = on); setSelected(map); }} /></th>
                    <th className="p-2 border">Name</th>
                    <th className="p-2 border">USN</th>
                    <th className="p-2 border">Branch</th>
                    <th className="p-2 border">Sem</th>
                    <th className="p-2 border">Status</th>
                    <th className="p-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-2 border text-center"><input type="checkbox" checked={!!selected[s.id]} onChange={() => toggleSelect(s.id)} /></td>
                      <td className="p-2 border">{s.name}<div className="text-xs text-gray-500">{s.email}</div></td>
                      <td className="p-2 border">{s.usn}</td>
                      <td className="p-2 border">{s.branch}</td>
                      <td className="p-2 border">{s.semester}</td>
                      <td className="p-2 border">{s.status}{s.status === "rejected" && s.remark ? <div className="text-xs text-red-600">Remark: {s.remark}</div> : null}</td>
                      <td className="p-2 border">
                        {s.status === "pending" && <button onClick={() => approveStudent(s.id)} className="text-sm bg-green-600 text-white px-2 py-1 rounded mr-2">Approve</button>}
                        {s.status === "pending" && <button onClick={() => rejectStudent(s.id)} className="text-sm bg-red-600 text-white px-2 py-1 rounded">Reject</button>}
                        <button onClick={() => { alert(JSON.stringify(s, null, 2)); }} className="text-sm bg-gray-300 px-2 py-1 rounded ml-2">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-gray-600">Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}</div>
              <div className="flex gap-2">
                <button onClick={() => { if (page > 1) { setPage(p => p - 1); loadStudents(faculty); } }} className="px-3 py-1 border rounded">Prev</button>
                <button onClick={() => { setPage(p => p + 1); loadStudents(faculty); }} className="px-3 py-1 border rounded">Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
