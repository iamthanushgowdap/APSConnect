// src/app/faculty/resources/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Faculty Resource Sharing Page
 *
 * Features:
 * - Upload 1..N files into bucket 'resources' with metadata saved in table `resources`
 * - Metadata: title, description, type (notes|syllabus|slides|lab|practice), branch, semester, tags[]
 * - Versioning: each upload creates a new record; file_path stored for deletion and version tracking
 * - List with search / filters / pagination
 * - Realtime updates via supabase channel
 * - Download / preview files (public URL)
 * - Delete (storage + DB)
 *
 * Requirements:
 * - Supabase table `resources` with columns:
 *   id (uuid, pk), title text, description text, type text, branch text, semester text,
 *   tags text[], file_url text, file_path text, uploaded_by uuid, uploaded_by_name text, uploaded_at timestamptz
 * - Storage bucket named 'resources' (public or private depending on your access rules)
 */

/* -------------------- Types -------------------- */
type ResourceRow = {
  id: string;
  title: string;
  description?: string | null;
  type: string; // notes | syllabus | slides | lab | practice
  branch?: string | null;
  semester?: string | null;
  tags?: string[] | null;
  file_url?: string | null;
  file_path?: string | null;
  uploaded_by?: string | null;
  uploaded_by_name?: string | null;
  uploaded_at?: string | null;
};

type User = {
  id: string;
  name?: string;
  assigned_branches?: string[] | null;
  assigned_semesters?: string[] | null;
  role?: string;
};

/* -------------------- Component -------------------- */
export default function FacultyResources() {
  const [user, setUser] = useState<User | null>(null);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("notes");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("I");
  const [tagsInput, setTagsInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  // filters / pagination
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [total, setTotal] = useState<number>(0);

  const [branches, setBranches] = useState<string[]>([]);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      setLoading(true);
      try {
        // auth
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setMessage("Please login to manage resources.");
          setLoading(false);
          return;
        }

        // load user info
        const { data: u } = await supabase
          .from("users")
          .select("id,name,assigned_branches,assigned_semesters,role")
          .eq("auth_id", auth.user.id)
          .single();
        if (!mounted) return;
        setUser(u || null);

        // load branches (online only)
        const { data: bdata } = await supabase.from("branches").select("name").eq("status", "online").order("name");
        setBranches((bdata || []).map((b: any) => b.name));

        // initial fetch
        await fetchResources(1, "", "", "", "", u);

        // realtime subscription - resources table
        channelRef.current = supabase
          .channel("public:resources")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "resources" },
            (payload: any) => {
              // payload.eventType -> "INSERT" | "UPDATE" | "DELETE"
              const evt = (payload.eventType || payload.event) as string;
              const rec = (payload.new ?? payload.old) as ResourceRow | undefined;
              if (!rec) return;

              setResources((prev) => {
                // permission: admin sees all; others only if branch match or uploaded_by is user.id
                if (u?.role !== "admin") {
                  const branchMatch = !rec.branch || (u?.assigned_branches && u.assigned_branches.includes(rec.branch));
                  const owned = rec.uploaded_by === u?.id;
                  if (!(branchMatch || owned)) return prev;
                }

                if (evt === "INSERT") {
                  // avoid duplicate
                  if (prev.some((p) => p.id === rec.id)) return prev;
                  return [rec, ...prev].slice(0, pageSize * 3);
                } else if (evt === "UPDATE") {
                  return prev.map((p) => (p.id === rec.id ? rec : p));
                } else if (evt === "DELETE") {
                  return prev.filter((p) => p.id !== rec.id);
                }
                return prev;
              });
            }
          )
          .subscribe();
      } catch (err: any) {
        console.error("init resources err", err);
        setMessage("Initialization failed: " + (err?.message ?? String(err)));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    init();

    return () => {
      mounted = false;
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------- fetch resources -------------------- */
  async function fetchResources(
    pageToLoad = 1,
    q = "",
    fType = "",
    fBranch = "",
    fSem = "",
    userRowProp: any = null
  ) {
    setLoading(true);
    setMessage(null);
    try {
      const userRow = userRowProp ?? user;
      // base query
      let builder = supabase.from("resources").select("*", { count: "exact" }).order("uploaded_at", { ascending: false });

      // permission scope: admin => all; faculty => their assigned branches only OR items they uploaded
      if (userRow && userRow.role !== "admin") {
        if (userRow.assigned_branches && userRow.assigned_branches.length) {
          builder = builder.in("branch", userRow.assigned_branches);
        } else {
          builder = builder.eq("uploaded_by", userRow?.id ?? "");
        }
      }

      if (q) {
        // search title, description, tags
        builder = builder.or(`title.ilike.%${q}%,description.ilike.%${q}%,tags.cs.{${q}}`);
      }
      if (fType) builder = builder.eq("type", fType);
      if (fBranch) builder = builder.eq("branch", fBranch);
      if (fSem) builder = builder.eq("semester", fSem);

      const from = (pageToLoad - 1) * pageSize;
      const to = pageToLoad * pageSize - 1;
      const { data, count, error } = await builder.range(from, to);
      if (error) throw error;
      setResources(data || []);
      setTotal(count ?? 0);
      setPage(pageToLoad);
    } catch (err: any) {
      console.error("fetchResources err", err);
      setMessage("Failed to load resources: " + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- upload helpers -------------------- */
  async function uploadFile(file: File) {
    // Upload to bucket 'resources' with path like: {branch}/{semester}/{timestamp}_{filename}
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const folder = `${branch || "general"}/${semester || "all"}`;
    const path = `${folder}/${timestamp}_${safeName}`;

    setUploadProgress(0);
    try {
      const { error } = await supabase.storage.from("resources").upload(path, file, { upsert: false });
      if (error) {
        // if file exists, try with upsert true as fallback
        if (error.message && error.message.includes("already exists")) {
          const { error: upErr } = await supabase.storage.from("resources").upload(path, file, { upsert: true });
          if (upErr) throw upErr;
        } else {
          throw error;
        }
      }

      // get public url
      const { data } = supabase.storage.from("resources").getPublicUrl(path);
      setUploadProgress(null);
      return { publicUrl: data.publicUrl, path };
    } catch (err: any) {
      setUploadProgress(null);
      console.error("uploadFile err", err);
      throw err;
    }
  }

  /* -------------------- create resource record(s) -------------------- */
  async function handleUpload(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!files || files.length === 0) {
      setMessage("Choose at least one file to upload.");
      return;
    }
    if (!title || title.trim().length < 2) {
      setMessage("Please provide a title for the resource (applies to all files uploaded here).");
      return;
    }
    setSaving(true);
    setMessage(null);

    try {
      const tagList = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const uploaderId = user?.id ?? null;
      const uploaderName = user?.name ?? "Unknown";

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // upload each file (sequential to keep progress)
        const { publicUrl, path } = await uploadFile(file);

        // insert DB record
        const payload = {
          title: title.trim(),
          description: description.trim() || null,
          type,
          branch: branch || null,
          semester: semester || null,
          tags: tagList.length ? tagList : null,
          file_url: publicUrl,
          file_path: path,
          uploaded_by: uploaderId,
          uploaded_by_name: uploaderName,
          uploaded_at: new Date().toISOString(),
        };

        const { error } = await supabase.from("resources").insert([payload]);
        if (error) throw error;

        // small delay (smooth UX) - optional
        await new Promise((res) => setTimeout(res, 250));
      }

      setMessage(`Uploaded ${files.length} file(s) successfully.`);
      setFiles([]);
      setTitle("");
      setDescription("");
      setTagsInput("");
      setType("notes");
      // refresh
      await fetchResources(1, query, filterType, filterBranch, filterSemester, user);
    } catch (err: any) {
      console.error("handleUpload err", err);
      setMessage("Upload failed: " + (err?.message ?? String(err)));
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  }

  /* -------------------- delete helpers -------------------- */
  async function handleDeleteResource(r: ResourceRow) {
    if (!confirm(`Delete resource "${r.title}"? This removes DB record and storage file.`)) return;
    try {
      // remove storage file if path present
      if (r.file_path) {
        try {
          await supabase.storage.from("resources").remove([r.file_path]);
        } catch (err) {
          console.warn("error deleting storage file", err);
        }
      }
      const { error } = await supabase.from("resources").delete().eq("id", r.id);
      if (error) throw error;
      setResources((p) => p.filter((x) => x.id !== r.id));
      setMessage("Resource deleted.");
    } catch (err: any) {
      console.error("delete resource err", err);
      setMessage("Delete failed: " + (err?.message ?? String(err)));
    }
  }

  /* -------------------- helpers: download / preview -------------------- */
  function openResource(url?: string | null) {
    if (!url) {
      setMessage("No URL available.");
      return;
    }
    window.open(url, "_blank");
  }

  /* -------------------- UI -------------------- */
  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Resource Sharing — Faculty</h1>

      {message && (
        <div className="mb-4 p-3 rounded bg-yellow-100 text-yellow-800">
          {message}
        </div>
      )}

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="bg-white p-4 rounded shadow mb-6 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Common Title for uploads" className="border p-2 rounded md:col-span-2" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="border p-2 rounded">
            <option value="notes">Notes</option>
            <option value="syllabus">Syllabus</option>
            <option value="slides">Slides</option>
            <option value="lab">Lab Manual</option>
            <option value="practice">Practice Papers</option>
            <option value="other">Other</option>
          </select>

          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="border p-2 rounded md:col-span-3" />

          <div className="flex gap-2 items-center">
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="border p-2 rounded">
              <option value="">Branch (optional)</option>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>

            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="border p-2 rounded">
              {["I","II","III","IV","V","VI","VII","VIII"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Tags (comma separated)" className="border p-2 rounded flex-1" />
          </div>

          <div className="md:col-span-3 flex flex-col gap-2">
            <label className="text-sm text-gray-600">Choose files (multiple allowed)</label>
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="border p-2 rounded" />
            {files.length > 0 && (
              <div className="text-sm">
                Selected files:
                <ul className="list-disc pl-5">
                  {files.map((f, i) => <li key={i}>{f.name} — {(f.size/1024/1024).toFixed(2)} MB</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="md:col-span-3 flex justify-between items-center">
            <div className="text-sm text-gray-600">Uploading progress: {uploadProgress !== null ? `${Math.round(uploadProgress)}%` : "—"}</div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded">{saving ? "Uploading..." : "Upload"}</button>
              <button type="button" onClick={() => { setFiles([]); setTitle(""); setDescription(""); setTagsInput(""); }} className="bg-gray-200 px-3 py-2 rounded">Reset</button>
            </div>
          </div>
        </div>
      </form>

      {/* Filters */}
      <div className="bg-white p-3 rounded shadow mb-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex gap-2 items-center flex-wrap">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title/description/tags" className="border p-2 rounded" />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border p-2 rounded">
            <option value="">All Types</option>
            <option value="notes">Notes</option>
            <option value="syllabus">Syllabus</option>
            <option value="slides">Slides</option>
            <option value="lab">Lab</option>
            <option value="practice">Practice</option>
          </select>
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="border p-2 rounded">
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} className="border p-2 rounded">
            <option value="">All Semesters</option>
            {["I","II","III","IV","V","VI","VII","VIII"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <button onClick={() => fetchResources(1, query, filterType, filterBranch, filterSemester)} className="bg-indigo-600 text-white px-3 py-1 rounded">Apply</button>
          <button onClick={() => { setQuery(""); setFilterType(""); setFilterBranch(""); setFilterSemester(""); fetchResources(1, "", "", "", ""); }} className="bg-gray-200 px-3 py-1 rounded">Reset</button>
        </div>

        <div className="flex gap-2 items-center">
          <div className="text-sm text-gray-600">Showing {resources.length} of {total}</div>
        </div>
      </div>

      {/* Resources List */}
      <section className="bg-white p-4 rounded shadow">
        {loading ? (
          <div className="p-6">Loading resources…</div>
        ) : resources.length === 0 ? (
          <div className="p-6 text-gray-600">No resources found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((r) => (
              <article key={r.id} className="border p-3 rounded space-y-2 flex flex-col">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-semibold">{r.title}</h3>
                    <div className="text-xs text-gray-500">{r.type} • {r.branch || "All Branches"} • Sem {r.semester || "All"}</div>
                  </div>
                  <div className="text-xs text-gray-400">{r.uploaded_at ? new Date(r.uploaded_at).toLocaleString() : ""}</div>
                </div>

                {r.description && <div className="text-sm text-gray-700">{r.description}</div>}

                {r.tags && r.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {r.tags.map((t, i) => <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">{t}</span>)}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <button onClick={() => openResource(r.file_url)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Open</button>
                    <a href={r.file_url || "#"} download className="px-3 py-1 bg-gray-200 rounded text-sm">Download</a>
                  </div>

                  <div className="flex gap-2 items-center">
                    <div className="text-xs text-gray-600">By {r.uploaded_by_name || "Unknown"}</div>
                    {(user?.role === "admin" || user?.id === r.uploaded_by) && (
                      <button onClick={() => handleDeleteResource(r)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">Page {page}</div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => fetchResources(page - 1, query, filterType, filterBranch, filterSemester)} className="px-3 py-1 border rounded">Prev</button>
            <button disabled={page * pageSize >= (total || 0)} onClick={() => fetchResources(page + 1, query, filterType, filterBranch, filterSemester)} className="px-3 py-1 border rounded">Next</button>
          </div>
        </div>
      </section>
    </main>
  );
}
