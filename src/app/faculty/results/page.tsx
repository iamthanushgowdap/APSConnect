"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Student = {
  id: string;
  name: string;
  usn: string;
  branch: string;
  semester: string;
};

type Result = {
  id?: string;
  student_id: string;
  subject: string;
  module_marks: number;
  lab_marks: number;
  internal_marks: number;
  total?: number;
  created_at?: string;
};

export default function FacultyResults() {
  const [faculty, setFaculty] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    student_id: "",
    subject: "",
    module_marks: 0,
    lab_marks: 0,
    internal_marks: 0,
  });

  const [analytics, setAnalytics] = useState<any[]>([]);

  useEffect(() => {
    async function loadFaculty() {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setMessage("Login required");
        return;
      }
      const { data: fac } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", auth.user.id)
        .single();
      if (!fac) {
        setMessage("Faculty not found");
        return;
      }
      setFaculty(fac);

      if (fac.assigned_branches?.length > 0) setBranch(fac.assigned_branches[0]);
      if (fac.assigned_semesters?.length > 0) setSemester(fac.assigned_semesters[0]);

      setLoading(false);
    }
    loadFaculty();
  }, []);

  useEffect(() => {
    async function fetchStudents() {
      if (!branch || !semester) return;
      const { data } = await supabase
        .from("users")
        .select("id,name,usn,branch,semester")
        .eq("branch", branch)
        .eq("semester", semester)
        .eq("role", "student")
        .order("usn");
      setStudents(data || []);
    }
    fetchStudents();
  }, [branch, semester]);

  useEffect(() => {
    async function fetchResults() {
      if (!branch || !semester || !subject) return;
      const { data } = await supabase
        .from("results")
        .select("*")
        .eq("subject", subject)
        .order("created_at", { ascending: false });
      setResults(data || []);
      computeAnalytics(data || []);
    }
    fetchResults();
  }, [branch, semester, subject]);

  function computeAnalytics(res: Result[]) {
    if (res.length === 0) {
      setAnalytics([]);
      return;
    }
    const totalStudents = res.length;
    const avg =
      res.reduce(
        (sum, r) => sum + (r.module_marks + r.lab_marks + r.internal_marks),
        0
      ) / totalStudents;

    const pass = res.filter(
      (r) => r.module_marks + r.lab_marks + r.internal_marks >= 40
    ).length;

    setAnalytics([
      { name: "Average Marks", value: Math.round(avg) },
      { name: "Pass %", value: Math.round((pass / totalStudents) * 100) },
    ]);
  }

  async function handleSave() {
    if (!form.student_id || !subject) {
      setMessage("Select student and subject");
      return;
    }
    try {
      const payload: Result = {
        ...form,
        subject,
        total: form.module_marks + form.lab_marks + form.internal_marks,
      };
      if (editingId) {
        await supabase.from("results").update(payload).eq("id", editingId);
        setMessage("Result updated");
      } else {
        await supabase.from("results").insert([payload]);
        setMessage("Result saved");
      }
      setForm({
        student_id: "",
        subject,
        module_marks: 0,
        lab_marks: 0,
        internal_marks: 0,
      });
      setEditingId(null);
      const { data: newData } = await supabase
        .from("results")
        .select("*")
        .eq("subject", subject);
      setResults(newData || []);
      computeAnalytics(newData || []);
    } catch (err: any) {
      setMessage("Error saving result: " + err.message);
    }
  }

  async function handleEdit(r: Result) {
    setEditingId(r.id!);
    setForm({
      student_id: r.student_id,
      subject: r.subject,
      module_marks: r.module_marks,
      lab_marks: r.lab_marks,
      internal_marks: r.internal_marks,
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete result?")) return;
    await supabase.from("results").delete().eq("id", id);
    setResults(results.filter((r) => r.id !== id));
    setMessage("Deleted result");
  }

  function exportCSV() {
    const rows = [
      ["USN", "Subject", "Module", "Lab", "Internal", "Total"],
      ...results.map((r) => {
        const student = students.find((s) => s.id === r.student_id);
        return [
          student?.usn || "",
          r.subject,
          r.module_marks,
          r.lab_marks,
          r.internal_marks,
          r.module_marks + r.lab_marks + r.internal_marks,
        ];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `results_${subject}_${branch}_${semester}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <p>Loading Faculty Results…</p>;

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">Faculty Results</h1>
      {message && <div className="p-2 bg-yellow-200 text-yellow-800">{message}</div>}

      {/* Filters */}
      <section className="bg-white p-4 rounded shadow grid grid-cols-2 md:grid-cols-4 gap-3">
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Branch</option>
          {faculty?.assigned_branches?.map((b: string) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={semester}
          onChange={(e) => setSemester(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Semester</option>
          {faculty?.assigned_semesters?.map((s: string) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="border p-2 rounded"
        />
        <button onClick={exportCSV} className="bg-gray-700 text-white px-3 py-1 rounded">
          Export CSV
        </button>
      </section>

      {/* Form */}
      <section className="bg-white p-4 rounded shadow space-y-3">
        <h2 className="font-semibold">Add / Edit Result</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select
            value={form.student_id}
            onChange={(e) => setForm({ ...form, student_id: e.target.value })}
            className="border p-2 rounded"
          >
            <option value="">Select Student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.usn} - {s.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Module Marks"
            value={form.module_marks}
            onChange={(e) => setForm({ ...form, module_marks: Number(e.target.value) })}
            className="border p-2 rounded"
          />
          <input
            type="number"
            placeholder="Lab Marks"
            value={form.lab_marks}
            onChange={(e) => setForm({ ...form, lab_marks: Number(e.target.value) })}
            className="border p-2 rounded"
          />
          <input
            type="number"
            placeholder="Internal Marks"
            value={form.internal_marks}
            onChange={(e) =>
              setForm({ ...form, internal_marks: Number(e.target.value) })
            }
            className="border p-2 rounded"
          />
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            {editingId ? "Update" : "Save"}
          </button>
        </div>
      </section>

      {/* Results Table */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Results</h2>
        {results.length === 0 ? (
          <p>No results entered yet.</p>
        ) : (
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">USN</th>
                <th className="border p-2">Subject</th>
                <th className="border p-2">Module</th>
                <th className="border p-2">Lab</th>
                <th className="border p-2">Internal</th>
                <th className="border p-2">Total</th>
                <th className="border p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const student = students.find((s) => s.id === r.student_id);
                return (
                  <tr key={r.id}>
                    <td className="border p-2">{student?.usn}</td>
                    <td className="border p-2">{r.subject}</td>
                    <td className="border p-2">{r.module_marks}</td>
                    <td className="border p-2">{r.lab_marks}</td>
                    <td className="border p-2">{r.internal_marks}</td>
                    <td className="border p-2 font-bold">
                      {r.module_marks + r.lab_marks + r.internal_marks}
                    </td>
                    <td className="border p-2 flex gap-2">
                      <button
                        onClick={() => handleEdit(r)}
                        className="bg-yellow-400 px-2 py-1 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(r.id!)}
                        className="bg-red-600 text-white px-2 py-1 rounded"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Analytics */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Analytics</h2>
        {analytics.length === 0 ? (
          <p>No analytics yet.</p>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={analytics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3182ce" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </main>
  );
}
