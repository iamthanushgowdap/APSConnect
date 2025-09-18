"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function FacultyDashboard() {
  const [faculty, setFaculty] = useState<any>(null);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  const [remark, setRemark] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);

  // Fetch faculty details from logged-in user
  useEffect(() => {
    async function loadFaculty() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Get faculty record
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", user.id)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setFaculty(data);

      if (data.role === "faculty") {
        loadPendingStudents(data.assigned_branch, data.assigned_semester);
      }
    }

    async function loadPendingStudents(branch: string, semester: number) {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("role", "student")
        .eq("status", "pending")
        .eq("branch", branch)
        .eq("semester", semester);

      if (error) console.error(error);
      else setPendingStudents(data || []);
    }

    loadFaculty();
  }, []);

  // Approve student
  async function handleApprove(id: string) {
    setLoading(true);
    await supabase.from("users").update({ status: "approved", faculty_remark: null }).eq("id", id);
    reload();
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
      .update({ status: "rejected", faculty_remark: remark[id] })
      .eq("id", id);
    reload();
    setLoading(false);
  }

  // Reload pending list
  async function reload() {
    if (!faculty) return;
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "student")
      .eq("status", "pending")
      .eq("branch", faculty.assigned_branch)
      .eq("semester", faculty.assigned_semester);

    if (error) console.error(error);
    else setPendingStudents(data || []);
  }

  return (
    <main className="min-h-screen p-6 bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">Faculty Dashboard</h1>
      <h2 className="text-xl font-semibold mb-4">Pending Student Approvals</h2>

      {pendingStudents.length === 0 ? (
        <p>No pending students 🎉</p>
      ) : (
        <div className="space-y-4">
          {pendingStudents.map((student) => (
            <div key={student.id} className="bg-white shadow rounded p-4">
              <p><strong>Name:</strong> {student.name}</p>
              <p><strong>USN:</strong> {student.usn}</p>
              <p><strong>Email:</strong> {student.email}</p>
              <p><strong>Branch:</strong> {student.branch}</p>
              <p><strong>Semester:</strong> {student.semester}</p>

              {/* Remark box */}
              <textarea
                placeholder="Enter rejection remark"
                value={remark[student.id] || ""}
                onChange={(e) => setRemark({ ...remark, [student.id]: e.target.value })}
                className="w-full border rounded p-2 mt-2"
              />

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleApprove(student.id)}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(student.id)}
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
