// src/app/faculty/assignments/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

type Assignment = {
  id: string;
  title: string;
  description?: string | null;
  branch?: string | null;
  semester?: string | null;
  due_date?: string | null;
  file_url?: string | null;
  file_path?: string | null; // storage path used for deletion
  faculty_id?: string | null;
  status?: "draft" | "published";
  created_at?: string | null;
};

type User = {
  id: string;
  name?: string;
  assigned_branches?: string[] | null;
  assigned_semesters?: string[] | null;
  role?: string;
};

/* ---------- component ---------- */
export default function FacultyAssignments() {
  const [user, setUser] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    branch: "",
    semester: "I",
    due_date: "",
    file: null as File | null,
    status: "draft" as "draft" | "published",
  });

  // search/pagination
  const [query, setQuery] = useState("");
  const [filterBranch, setFilterBranch] = useState<string>("");
  const [filterSemester, setFilterSemester] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const pageSize = 12;
  const [totalCount, setTotalCount] = useState<number>(0);

  const channelRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoading(true);
      try {
        // get logged-in user info
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setMessage("Please login to manage assignments.");
          setLoading(false);
          return;
        }

        const { data: userRow } = await supabase
          .from("users")
          .select("id,name,assigned_branches,assigned_semesters,role")
          .eq("auth_id", auth.user.id)
          .single();

        if (!mounted) return;

        setUser(userRow || null);

        // load online branches
        const { data: branchesData } = await supabase
          .from("branches")
          .select("name")
          .eq("status", "online")
          .order("name");
        setBranches((branchesData || []).map((b: any) => b.name));

        // initial load assignments
        await fetchAssignments(1, query, filterBranch, filterSemester, userRow);

        // setup realtime subscription - listen to INSERT/UPDATE/DELETE on assignments
        channelRef.current = supabase
          .channel("public:assignments")
          .on(
  "postgres_changes",
  { event: "*", schema: "public", table: "assignments" },
  (payload) => {
    const evt = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
    const rec = (payload.new ?? payload.old) as Assignment; // ✅ cast to type

    if (!rec) return;

    setAssignments((prev) => {
      // now rec.branch, rec.id, rec.faculty_id are all valid
      if (evt === "INSERT") {
        return [rec, ...prev];
      } else if (evt === "UPDATE") {
        return prev.map((a) => (a.id === rec.id ? rec : a));
      } else if (evt === "DELETE") {
        return prev.filter((a) => a.id !== rec.id);
      }
      return prev;
    });
  }
)

          .subscribe();
      } catch (err: any) {
        console.error("init assignments err", err);
        setMessage("Failed to initialize assignments page.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
      // unsubscribe channel
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {
          /* no-op */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- fetch with paging and filters ---------- */
  async function fetchAssignments(
    pageToLoad = 1,
    q = "",
    b = "",
    sem = "",
    userRowProp: any = null
  ) {
    setLoading(true);
    setMessage(null);

    try {
      // build base query
      let builder = supabase
        .from("assignments")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      // faculty sees only their assignments OR assignments for their assigned branches OR admin sees all
      const userRow = userRowProp ?? user;
      if (userRow && userRow.role !== "admin") {
        // allow either assignments created by this faculty or assignments assigned to their branches
        if (userRow.assigned_branches && userRow.assigned_branches.length > 0) {
          builder = builder.in("branch", userRow.assigned_branches);
        } else {
          // if no assigned branches, restrict to those created by faculty
          builder = builder.eq("faculty_id", userRow?.id ?? "");
        }
      }

      if (q) {
        // search in title or description
        builder = builder.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
      }
      if (b) {
        builder = builder.eq("branch", b);
      }
      if (sem) {
        builder = builder.eq("semester", sem);
      }

      const from = (pageToLoad - 1) * pageSize;
      const to = pageToLoad * pageSize - 1;
      const { data, count, error } = await builder.range(from, to);
      if (error) throw error;

      setAssignments(data || []);
      setTotalCount(count ?? 0);
      setPage(pageToLoad);
    } catch (err: any) {
      console.error("fetchAssignments err", err);
      setMessage("Failed to load assignments: " + (err.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  /* ---------- helpers: upload / delete file ---------- */
  async function uploadFileToStorage(assignmentId: string, file: File) {
    // bucket 'assignments'
    const bucket = "assignments";
    const path = `${assignmentId}/${Date.now()}_${file.name}`;
    setUploadProgress(0);
    try {
      // Supabase client storage upload
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      // get public URL
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setUploadProgress(null);
      return { publicUrl: data.publicUrl, path };
    } catch (err: any) {
      setUploadProgress(null);
      console.error("uploadFile err", err);
      throw err;
    }
  }

  async function removeFileFromStorage(path: string | null | undefined) {
    if (!path) return;
    try {
      await supabase.storage.from("assignments").remove([path]);
    } catch (err) {
      console.warn("removeFileFromStorage failed", err);
    }
  }

  /* ---------- create / update handler ---------- */
  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setMessage(null);

    // validation
    if (!form.title || form.title.trim().length < 3) {
      setMessage("Title must be at least 3 characters.");
      return;
    }
    if (!form.branch) {
      setMessage("Please select branch.");
      return;
    }
    if (!form.semester) {
      setMessage("Please select semester.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // update existing
        const updatePayload: Partial<Assignment> = {
          title: form.title.trim(),
          description: form.description.trim() || null,
          branch: form.branch || null,
          semester: form.semester || null,
          due_date: form.due_date || null,
          status: form.status,
        };

        // update record
        const { error: updErr } = await supabase.from("assignments").update(updatePayload).eq("id", editingId);
        if (updErr) throw updErr;

        // if file attached -> upload and update file_url & file_path
        if (form.file) {
          const { publicUrl, path } = await uploadFileToStorage(editingId, form.file);
          const { error: fileUpdErr } = await supabase.from("assignments").update({ file_url: publicUrl, file_path: path }).eq("id", editingId);
          if (fileUpdErr) throw fileUpdErr;
        }

        setMessage("Assignment updated.");
      } else {
        // create assignment (insert)
        const payload: Partial<Assignment> = {
          title: form.title.trim(),
          description: form.description.trim() || null,
          branch: form.branch || null,
          semester: form.semester || null,
          due_date: form.due_date || null,
          faculty_id: user?.id ?? null,
          status: form.status,
          created_at: new Date().toISOString(),
        };

        const { data: created, error: createErr } = await supabase.from("assignments").insert([payload]).select().single();
        if (createErr) throw createErr;
        const assignmentId = created.id;

        // upload file if present
        if (form.file) {
          const { publicUrl, path } = await uploadFileToStorage(assignmentId, form.file);
          const { error: fileUpdErr } = await supabase.from("assignments").update({ file_url: publicUrl, file_path: path }).eq("id", assignmentId);
          if (fileUpdErr) throw fileUpdErr;
        }

        setMessage("Assignment created.");
      }

      // refresh list (stay on current page)
      await fetchAssignments(page, query, filterBranch, filterSemester, user);
      // reset form
      setEditingId(null);
      setForm({ title: "", description: "", branch: user?.assigned_branches?.[0] ?? "", semester: "I", due_date: "", file: null, status: "draft" });
    } catch (err: any) {
      console.error("handleSubmit err", err);
      setMessage("Save failed: " + (err.message ?? String(err)));
    } finally {
      setSaving(false);
    }
  }

  /* ---------- edit / delete ---------- */
  function startEdit(a: Assignment) {
    setEditingId(a.id);
    setForm({
      title: a.title ?? "",
      description: a.description ?? "",
      branch: a.branch ?? "",
      semester: a.semester ?? "I",
      due_date: a.due_date ?? "",
      file: null,
      status: (a.status as "draft" | "published") ?? "draft",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteAssignment(a: Assignment) {
    if (!confirm("Delete assignment? This will remove the assignment and its file (if any).")) return;
    try {
      // try delete file from storage first
      if (a.file_path) {
        await removeFileFromStorage(a.file_path);
      }
      const { error } = await supabase.from("assignments").delete().eq("id", a.id);
      if (error) throw error;
      // optimistic update
      setAssignments((p) => p.filter((x) => x.id !== a.id));
      setMessage("Assignment deleted.");
    } catch (err: any) {
      console.error("deleteAssignment err", err);
      setMessage("Delete failed: " + (err.message ?? String(err)));
    }
  }

  /* ---------- export CSV ---------- */
  function exportCsvCurrent() {
    const rows = [
      ["Title", "Branch", "Semester", "Due Date", "Status", "File URL", "Created At"],
      ...assignments.map((a) => [
        a.title ?? "",
        a.branch ?? "",
        a.semester ?? "",
        a.due_date ?? "",
        a.status ?? "",
        a.file_url ?? "",
        a.created_at ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assignments_export_page${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- UI ---------- */
  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Assignments — Manage</h1>

      {message && <div className="mb-4 text-sm text-red-600">{message}</div>}

      {/* FORM */}
      <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="border p-2 rounded md:col-span-2"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select
            value={form.branch}
            onChange={(e) => setForm({ ...form, branch: e.target.value })}
            className="border p-2 rounded"
          >
            <option value="">Select Branch</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={form.semester}
            onChange={(e) => setForm({ ...form, semester: e.target.value })}
            className="border p-2 rounded"
          >
            {["I", "II", "III", "IV", "V", "VI", "VII", "VIII"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <textarea
            className="col-span-1 md:col-span-3 border p-2 rounded"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className="border p-2 rounded"
          />

          <div className="flex items-center gap-2">
            <input
              type="file"
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              className="border p-2 rounded"
            />
            {uploadProgress !== null && (
              <div className="text-sm text-gray-600">Uploading... {Math.round(uploadProgress)}%</div>
            )}
          </div>

          <div className="flex items-center gap-3 md:col-span-3">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="status"
                checked={form.status === "draft"}
                onChange={() => setForm({ ...form, status: "draft" })}
              />
              <span className="text-sm">Save as Draft</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="status"
                checked={form.status === "published"}
                onChange={() => setForm({ ...form, status: "published" })}
              />
              <span className="text-sm">Publish</span>
            </label>

            <div className="flex-1 text-right">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded mr-2"
              >
                {saving ? "Saving..." : editingId ? "Update Assignment" : "Create Assignment"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm({ title: "", description: "", branch: "", semester: "I", due_date: "", file: null, status: "draft" });
                    setMessage(null);
                  }}
                  className="bg-gray-200 px-3 py-2 rounded"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* FILTERS & ACTIONS */}
      <div className="bg-white p-4 rounded shadow mb-4 flex flex-col md:flex-row gap-3 items-center md:items-end justify-between">
        <div className="flex gap-2 items-center flex-wrap">
          <input placeholder="Search title/description" value={query} onChange={(e) => setQuery(e.target.value)} className="border p-2 rounded" />
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="border p-2 rounded">
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} className="border p-2 rounded">
            <option value="">All Semesters</option>
            {["I","II","III","IV","V","VI","VII","VIII"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <button onClick={() => fetchAssignments(1, query, filterBranch, filterSemester, user)} className="bg-indigo-600 text-white px-3 py-1 rounded">Search</button>
          <button onClick={() => { setQuery(""); setFilterBranch(""); setFilterSemester(""); fetchAssignments(1, "", "", "", user); }} className="bg-gray-300 px-3 py-1 rounded">Reset</button>
        </div>

        <div className="flex gap-2 items-center">
          <button onClick={exportCsvCurrent} className="bg-gray-700 text-white px-3 py-1 rounded">Export CSV</button>
          <div className="text-sm text-gray-600">Showing {assignments.length} / {totalCount}</div>
        </div>
      </div>

      {/* LIST */}
      <section className="bg-white p-4 rounded shadow">
        {loading ? (
          <div className="p-6 text-center">Loading assignments…</div>
        ) : assignments.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No assignments found.</div>
        ) : (
          <ul className="space-y-3">
            {assignments.map((a) => (
              <li key={a.id} className="border p-3 rounded flex flex-col md:flex-row justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-lg">{a.title}</div>
                      <div className="text-sm text-gray-600">{a.branch} • Sem {a.semester} • {a.status}</div>
                    </div>
                    <div className="text-right text-xs text-gray-500">{a.created_at ? new Date(a.created_at).toLocaleString() : ""}</div>
                  </div>

                  <div className="mt-2 text-sm text-gray-700">{a.description}</div>

                  {a.due_date && <div className="mt-2 text-sm text-gray-600">Due: {new Date(a.due_date).toLocaleDateString()}</div>}

                  {a.file_url && (
                    <div className="mt-2">
                      <a href={a.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">Download Attachment</a>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 items-end">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(a)} className="px-3 py-1 bg-yellow-400 rounded">Edit</button>
                    <button onClick={() => deleteAssignment(a)} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
                  </div>
                  <div className="text-xs text-gray-500">Faculty: {a.faculty_id || "Unknown"}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">Page {page} • {totalCount} results</div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => fetchAssignments(page - 1, query, filterBranch, filterSemester, user)} className="px-3 py-1 border rounded">Prev</button>
            <button disabled={page * pageSize >= (totalCount || 0)} onClick={() => fetchAssignments(page + 1, query, filterBranch, filterSemester, user)} className="px-3 py-1 border rounded">Next</button>
          </div>
        </div>
      </section>
    </main>
  );
}
