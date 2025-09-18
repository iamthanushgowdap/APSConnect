"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type Meeting = {
  id?: string;
  faculty_id: string;
  topic: string;
  branch: string;
  semester: string;
  date: string;
  time: string;
  duration: number;
  password: string;
  created_at?: string;
};

export default function FacultyZoom() {
  const [faculty, setFaculty] = useState<any>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [form, setForm] = useState<Partial<Meeting>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [analytics, setAnalytics] = useState<any[]>([]);

  useEffect(() => {
    async function loadFaculty() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const { data: fac } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", auth.user.id)
        .single();
      if (fac) setFaculty(fac);
    }
    loadFaculty();
  }, []);

  useEffect(() => {
    async function fetchMeetings() {
      if (!faculty) return;
      const { data } = await supabase
        .from("meetings")
        .select("*")
        .eq("faculty_id", faculty.id)
        .order("date", { ascending: true });
      setMeetings(data || []);
      computeAnalytics(data || []);
    }
    fetchMeetings();
  }, [faculty]);

  function computeAnalytics(data: Meeting[]) {
    const now = new Date();
    const upcoming = data.filter((m) => new Date(m.date + "T" + m.time) > now);
    const past = data.filter((m) => new Date(m.date + "T" + m.time) <= now);
    setAnalytics([
      { name: "Upcoming", value: upcoming.length },
      { name: "Past", value: past.length },
    ]);
  }

  async function handleSave() {
    if (!form.topic || !form.branch || !form.semester || !form.date || !form.time) {
      setMessage("Fill all required fields");
      return;
    }
    const payload: Meeting = {
      faculty_id: faculty.id,
      topic: form.topic!,
      branch: form.branch!,
      semester: form.semester!,
      date: form.date!,
      time: form.time!,
      duration: form.duration || 60,
      password: form.password || "12345",
    };

    if (editingId) {
      await supabase.from("meetings").update(payload).eq("id", editingId);
      setMessage("Meeting updated");
    } else {
      await supabase.from("meetings").insert([payload]);
      setMessage("Meeting created");
    }

    setForm({});
    setEditingId(null);

    const { data } = await supabase.from("meetings").select("*").eq("faculty_id", faculty.id);
    setMeetings(data || []);
    computeAnalytics(data || []);
  }

  async function handleEdit(m: Meeting) {
    setEditingId(m.id!);
    setForm(m);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete meeting?")) return;
    await supabase.from("meetings").delete().eq("id", id);
    setMeetings(meetings.filter((m) => m.id !== id));
    setMessage("Meeting deleted");
  }

  function exportCSV() {
    const rows = [
      ["Topic", "Branch", "Semester", "Date", "Time", "Duration", "Password"],
      ...meetings.map((m) => [m.topic, m.branch, m.semester, m.date, m.time, m.duration, m.password]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meetings.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">Faculty Zoom Integration</h1>
      {message && <div className="p-2 bg-yellow-200 text-yellow-800">{message}</div>}

      {/* Meeting Form */}
      <section className="bg-white p-4 rounded shadow space-y-3">
        <h2 className="font-semibold">Create / Edit Meeting</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            placeholder="Topic"
            value={form.topic || ""}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            className="border p-2 rounded"
          />
          <select
            value={form.branch || ""}
            onChange={(e) => setForm({ ...form, branch: e.target.value })}
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
            value={form.semester || ""}
            onChange={(e) => setForm({ ...form, semester: e.target.value })}
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
            type="date"
            value={form.date || ""}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="border p-2 rounded"
          />
          <input
            type="time"
            value={form.time || ""}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            className="border p-2 rounded"
          />
          <input
            type="number"
            placeholder="Duration (mins)"
            value={form.duration || 60}
            onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
            className="border p-2 rounded"
          />
          <input
            type="text"
            placeholder="Password"
            value={form.password || ""}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border p-2 rounded"
          />
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            {editingId ? "Update" : "Create"}
          </button>
        </div>
      </section>

      {/* Meetings Table */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Scheduled Meetings</h2>
        {meetings.length === 0 ? (
          <p>No meetings yet.</p>
        ) : (
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Topic</th>
                <th className="border p-2">Date</th>
                <th className="border p-2">Time</th>
                <th className="border p-2">Duration</th>
                <th className="border p-2">Password</th>
                <th className="border p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id}>
                  <td className="border p-2">{m.topic}</td>
                  <td className="border p-2">{m.date}</td>
                  <td className="border p-2">{m.time}</td>
                  <td className="border p-2">{m.duration} mins</td>
                  <td className="border p-2">{m.password}</td>
                  <td className="border p-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(m)}
                      className="bg-yellow-400 px-2 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(m.id!)}
                      className="bg-red-600 text-white px-2 py-1 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          onClick={exportCSV}
          className="mt-3 bg-gray-700 text-white px-3 py-1 rounded"
        >
          Export CSV
        </button>
      </section>

      {/* Analytics */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Meeting Analytics</h2>
        {analytics.length === 0 ? (
          <p>No data yet.</p>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={analytics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#4a90e2" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </main>
  );
}
