"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/**
 * Faculty Announcements
 * Features:
 * - Create new announcement (title, content, target audience, attachment)
 * - Upload attachment to supabase storage bucket `announcements`
 * - Save metadata in table `announcements`
 * - List announcements with filters: branch, semester, search
 * - Realtime updates
 * - Edit / Delete announcements
 * - Download attachment
 * - Export CSV
 * - Analytics: how many announcements per branch
 */

type Announcement = {
  id?: string;
  title: string;
  content: string;
  branch?: string | null;
  semester?: string | null;
  file_url?: string | null;
  file_path?: string | null;
  created_at?: string;
  created_by?: string;
  created_by_name?: string;
};

export default function FacultyAnnouncements() {
  const [faculty, setFaculty] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [filterBranch, setFilterBranch] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [search, setSearch] = useState("");

  const [analytics, setAnalytics] = useState<any[]>([]);
  const channelRef = useRef<any>(null);

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
    async function fetchAnnouncements() {
      let query = supabase.from("announcements").select("*").order("created_at", { ascending: false });
      if (filterBranch) query = query.eq("branch", filterBranch);
      if (filterSemester) query = query.eq("semester", filterSemester);
      const { data } = await query;
      setAnnouncements(data || []);
      computeAnalytics(data || []);
    }
    fetchAnnouncements();

    // Realtime
    channelRef.current = supabase
      .channel("public:announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, (payload) => {
        fetchAnnouncements();
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [filterBranch, filterSemester]);

  function computeAnalytics(data: Announcement[]) {
    const map: Record<string, number> = {};
    data.forEach((a) => {
      const b = a.branch || "All";
      map[b] = (map[b] || 0) + 1;
    });
    setAnalytics(Object.entries(map).map(([k, v]) => ({ branch: k, count: v })));
  }

  async function handleSave() {
    if (!title || !content) {
      setMessage("Title and content required");
      return;
    }
    let fileUrl = null;
    let filePath = null;
    if (file) {
      const path = `${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("announcements").upload(path, file);
      if (upErr) {
        setMessage("File upload failed: " + upErr.message);
        return;
      }
      const { data } = supabase.storage.from("announcements").getPublicUrl(path);
      fileUrl = data.publicUrl;
      filePath = path;
    }

    const payload: Announcement = {
      title,
      content,
      branch: branch || null,
      semester: semester || null,
      file_url: fileUrl,
      file_path: filePath,
      created_at: new Date().toISOString(),
      created_by: faculty?.id,
      created_by_name: faculty?.name,
    };

    if (editingId) {
      await supabase.from("announcements").update(payload).eq("id", editingId);
      setMessage("Announcement updated");
    } else {
      await supabase.from("announcements").insert([payload]);
      setMessage("Announcement posted");
    }

    setTitle("");
    setContent("");
    setBranch("");
    setSemester("");
    setFile(null);
    setEditingId(null);
  }

  async function handleEdit(a: Announcement) {
    setTitle(a.title);
    setContent(a.content);
    setBranch(a.branch || "");
    setSemester(a.semester || "");
    setEditingId(a.id || null);
  }

  async function handleDelete(a: Announcement) {
    if (!confirm("Delete announcement?")) return;
    if (a.file_path) {
      try {
        await supabase.storage.from("announcements").remove([a.file_path]);
      } catch (err) {
        console.warn("file delete failed", err);
      }
    }
    await supabase.from("announcements").delete().eq("id", a.id);
    setMessage("Deleted announcement");
  }

  function exportCSV() {
    const rows = [
      ["Title", "Content", "Branch", "Semester", "Date", "By"],
      ...announcements.map((a) => [a.title, a.content, a.branch || "All", a.semester || "All", a.created_at, a.created_by_name]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "announcements.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = announcements.filter((a) => {
    if (!search) return true;
    return a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <p>Loading announcements…</p>;

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">Faculty Announcements</h1>
      {message && <div className="p-2 bg-yellow-200">{message}</div>}

      {/* New Announcement */}
      <section className="bg-white p-4 rounded shadow space-y-3">
        <h2 className="font-semibold">Create / Edit Announcement</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="border p-2 rounded" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content" className="border p-2 rounded col-span-2" />
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className="border p-2 rounded">
            <option value="">All Branches</option>
            {faculty?.assigned_branches?.map((b: string) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={semester} onChange={(e) => setSemester(e.target.value)} className="border p-2 rounded">
            <option value="">All Semesters</option>
            {faculty?.assigned_semesters?.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="col-span-2" />
          <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded col-span-2">
            {editingId ? "Update" : "Post"}
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white p-4 rounded shadow flex gap-2 items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="border p-2 rounded flex-1" />
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="border p-2 rounded">
          <option value="">All Branches</option>
          {faculty?.assigned_branches?.map((b: string) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} className="border p-2 rounded">
          <option value="">All Semesters</option>
          {faculty?.assigned_semesters?.map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={exportCSV} className="bg-gray-700 text-white px-3 py-1 rounded">Export CSV</button>
      </section>

      {/* List */}
      <section className="bg-white p-4 rounded shadow">
        {filtered.length === 0 ? (
          <p>No announcements</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((a) => (
              <li key={a.id} className="border p-3 rounded flex justify-between items-start gap-3">
                <div>
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="text-sm text-gray-600">{a.content}</p>
                  <div className="text-xs text-gray-500">Branch: {a.branch || "All"} • Sem: {a.semester || "All"}</div>
                  {a.file_url && (
                    <a href={a.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">Download Attachment</a>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(a)} className="bg-yellow-400 px-2 py-1 rounded">Edit</button>
                  <button onClick={() => handleDelete(a)} className="bg-red-600 text-white px-2 py-1 rounded">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Analytics */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Announcements Analytics</h2>
        {analytics.length === 0 ? (
          <p>No data</p>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={analytics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="branch" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3182ce" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </main>
  );
}
