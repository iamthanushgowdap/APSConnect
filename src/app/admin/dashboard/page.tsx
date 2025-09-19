"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>({});
  const [fees, setFees] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [library, setLibrary] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [newEvent, setNewEvent] = useState({ title: "", date: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      // Stats
      const { count: studentCount } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "student");
      const { count: facultyCount } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "faculty");
      const { count: pendingCount } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("status", "pending");

      setStats({ students: studentCount, faculty: facultyCount, pending: pendingCount });

      // Fees
      const { data: feeData } = await supabase.from("fees").select("*");
      setFees(feeData ?? []);

      // Attendance
      const { data: att } = await supabase.from("attendance").select("*");
      setAttendance(att ?? []);

      // Announcements
      const { data: ann } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(5);
      setAnnouncements(ann ?? []);

      // Events
      const { data: ev } = await supabase.from("events").select("*").order("date", { ascending: true }).limit(5);
      setEvents(ev ?? []);

      // Library
      const { data: lib } = await supabase.from("library").select("*").order("created_at", { ascending: false }).limit(5);
      setLibrary(lib ?? []);

      // Notifications
      const { data: notifs } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(5);
      setNotifications(notifs ?? []);
    } catch (err: any) {
      setMessage("Error loading dashboard: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createAnnouncement() {
    if (!newAnnouncement.trim()) return;
    await supabase.from("announcements").insert([{ title: newAnnouncement }]);
    setNewAnnouncement("");
    load();
  }

  async function createEvent() {
    if (!newEvent.title || !newEvent.date) return;
    await supabase.from("events").insert([newEvent]);
    setNewEvent({ title: "", date: "" });
    load();
  }

  // Charts
  const feeChartData = [
    { name: "Paid", value: fees.filter((f) => f.status === "paid").length },
    { name: "Pending", value: fees.filter((f) => f.status === "pending").length },
  ];

  const attendanceData = (() => {
    const grouped: Record<string, number> = {};
    attendance.forEach((a) => {
      if (!grouped[a.subject]) grouped[a.subject] = 0;
      if (a.present) grouped[a.subject]++;
    });
    return Object.entries(grouped).map(([subject, count]) => ({ subject, count }));
  })();

  const libraryData = (() => {
    const grouped: Record<string, number> = {};
    library.forEach((b) => {
      const key = b.branch || "Unknown";
      grouped[key] = (grouped[key] || 0) + 1;
    });
    return Object.entries(grouped).map(([branch, count]) => ({ branch, count }));
  })();

  // Export CSV
  function exportCSV(data: any[], filename: string) {
    const csv = [
      Object.keys(data[0]).join(","),
      ...data.map((row) => Object.values(row).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <p>Loading...</p>;

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {/* Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white shadow p-4 rounded">
          <h2 className="text-lg font-semibold">Total Students</h2>
          <p className="text-2xl font-bold">{stats.students ?? 0}</p>
        </div>
        <div className="bg-white shadow p-4 rounded">
          <h2 className="text-lg font-semibold">Total Faculty</h2>
          <p className="text-2xl font-bold">{stats.faculty ?? 0}</p>
        </div>
        <div className="bg-white shadow p-4 rounded">
          <h2 className="text-lg font-semibold">Pending Approvals</h2>
          <p className="text-2xl font-bold">{stats.pending ?? 0}</p>
        </div>
      </section>

      {/* Fees */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Fee Management</h2>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={feeChartData} dataKey="value" nameKey="name" outerRadius={80} label>
              {feeChartData.map((entry, index) => (
                <Cell key={index} fill={index === 0 ? "#00C49F" : "#FF8042"} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <button
          onClick={() => exportCSV(fees, "fees.csv")}
          className="mt-2 bg-blue-600 text-white px-3 py-1 rounded"
        >
          Export Fees CSV
        </button>
      </section>

      {/* Attendance */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Attendance Summary</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={attendanceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="subject" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#0088FE" />
          </BarChart>
        </ResponsiveContainer>
        <button
          onClick={() => exportCSV(attendance, "attendance.csv")}
          className="mt-2 bg-green-600 text-white px-3 py-1 rounded"
        >
          Export Attendance CSV
        </button>
      </section>

      {/* Announcements */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Announcements</h2>
        <div className="flex space-x-2 mb-3">
          <input
            value={newAnnouncement}
            onChange={(e) => setNewAnnouncement(e.target.value)}
            placeholder="New announcement..."
            className="border p-2 rounded flex-1"
          />
          <button
            onClick={createAnnouncement}
            className="bg-blue-600 text-white px-3 py-1 rounded"
          >
            Post
          </button>
        </div>
        <ul>
          {announcements.map((a) => (
            <li key={a.id} className="border-b py-1">
              {a.title} <span className="text-sm text-gray-500">({a.created_at})</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Events */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Event Calendar</h2>
        <div className="flex space-x-2 mb-3">
          <input
            value={newEvent.title}
            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            placeholder="Event title"
            className="border p-2 rounded flex-1"
          />
          <input
            type="date"
            value={newEvent.date}
            onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
            className="border p-2 rounded"
          />
          <button
            onClick={createEvent}
            className="bg-green-600 text-white px-3 py-1 rounded"
          >
            Add
          </button>
        </div>
        <ul>
          {events.map((ev) => (
            <li key={ev.id} className="border-b py-1">
              {ev.title} — {ev.date}
            </li>
          ))}
        </ul>
      </section>

      {/* Library */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Library Summary</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={libraryData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="branch" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#FFBB28" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Notifications */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Latest Notifications</h2>
        <ul>
          {notifications.map((n) => (
            <li key={n.id} className="border-b py-1">
              {n.title}: {n.message}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
