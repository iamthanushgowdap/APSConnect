"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import jsPDF from "jspdf";

/**
 * Faculty Skill Build Courses Page (Full featured)
 *
 * Features:
 * - Create / Edit / Delete courses
 * - Upload one or more course files to storage bucket 'courses'
 * - Enroll / Unenroll students (faculty or self-enroll)
 * - Students complete course -> certificate PDF is generated instantly
 * - Course progress table + per-student completion status
 * - Filters, search, pagination
 * - Realtime updates via Supabase channel
 * - Export enrollments/progress to CSV
 *
 * Required tables (recommended):
 * - courses (id uuid pk, title text, description text, duration text, modules jsonb, branch text, semester text, tags text[], file_url text, file_path text, faculty_id uuid, created_at timestamptz)
 * - course_progress (id uuid pk, course_id uuid, student_id uuid, completed bool, completed_at timestamptz)
 * - users (id uuid pk, auth_id text, name text, role text, branch text, semester text, achievements text[])
 * - course_enrollments (id uuid pk, course_id uuid, student_id uuid, enrolled_at timestamptz)
 *
 * Storage bucket: 'courses'
 */

/* -------------------- Types -------------------- */
type Course = {
  id: string;
  title: string;
  description?: string | null;
  duration?: string | null;
  modules?: any[] | null;
  branch?: string | null;
  semester?: string | null;
  tags?: string[] | null;
  file_url?: string | null;
  file_path?: string | null;
  faculty_id?: string | null;
  created_at?: string | null;
};

type User = {
  id: string;
  name?: string;
  role?: string;
  branch?: string;
  semester?: string;
  achievements?: string[] | null;
};

type Progress = {
  id?: string;
  course_id: string;
  student_id: string;
  completed: boolean;
  completed_at?: string | null;
};

/* -------------------- Component -------------------- */
export default function FacultyCourses() {
  const [faculty, setFaculty] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [modulesInput, setModulesInput] = useState<string>(""); // CSV or newline modules
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("I");
  const [tagsInput, setTagsInput] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // enrollments & progress
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [progressList, setProgressList] = useState<Progress[]>([]);

  // search / filters / pagination
  const [query, setQuery] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [totalCourses, setTotalCourses] = useState(0);

  const [branches, setBranches] = useState<string[]>([]);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      try {
        // get auth user
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setMessage("Please login to manage courses.");
          setLoading(false);
          return;
        }

        // fetch user record
        const { data: u } = await supabase
          .from("users")
          .select("id,name,role,branch,semester,achievements")
          .eq("auth_id", auth.user.id)
          .single();

        if (!mounted) return;
        setFaculty(u || null);

        // fetch online branches
        const { data: bdata } = await supabase.from("branches").select("name").eq("status", "online").order("name");
        setBranches((bdata || []).map((b: any) => b.name));

        // load courses
        await fetchCourses(1, query, filterBranch, filterSemester, u);

        // realtime updates for courses and progress
        channelRef.current = supabase
          .channel("public:courses_progress")
          .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, (payload: any) => {
            // refetch page
            fetchCourses(page, query, filterBranch, filterSemester, u);
          })
          .on("postgres_changes", { event: "*", schema: "public", table: "course_progress" }, (payload: any) => {
            // refresh progress/enrollments for selected course
            if (selectedCourse) {
              loadCourseDetails(selectedCourse.id);
            }
          })
          .subscribe();
      } catch (err: any) {
        console.error("init courses err", err);
        setMessage("Initialization error: " + (err?.message ?? String(err)));
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
          // noop
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------- fetch courses with pagination & filters -------------------- */
  async function fetchCourses(pageToLoad = 1, q = "", fBranch = "", fSem = "", userRow: any = null) {
    setLoading(true);
    setMessage(null);
    try {
      let builder = supabase.from("courses").select("*", { count: "exact" }).order("created_at", { ascending: false });

      // faculty sees courses they created OR courses for their branch (or admin sees all)
      const userRowVal = userRow ?? faculty;
      if (userRowVal && userRowVal.role !== "admin") {
        builder = builder.or(`faculty_id.eq.${userRowVal.id},branch.eq.${userRowVal.branch}`);
      }

      if (q) {
        builder = builder.ilike("title", `%${q}%`);
      }
      if (fBranch) builder = builder.eq("branch", fBranch);
      if (fSem) builder = builder.eq("semester", fSem);

      const from = (pageToLoad - 1) * pageSize;
      const to = pageToLoad * pageSize - 1;
      const { data, count, error } = await builder.range(from, to);
      if (error) throw error;
      setCourses(data || []);
      setTotalCourses(count ?? 0);
      setPage(pageToLoad);
    } catch (err: any) {
      console.error("fetchCourses err", err);
      setMessage("Failed to load courses: " + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- course upload helpers -------------------- */
  async function uploadFileToStorage(courseId: string, file: File) {
    setUploadProgress(0);
    const bucket = "courses";
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${courseId}/${Date.now()}_${safeName}`;

    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setUploadProgress(null);
      return { publicUrl: data.publicUrl, path };
    } catch (err: any) {
      setUploadProgress(null);
      console.error("uploadFileToStorage err", err);
      throw err;
    }
  }

  /* -------------------- create / update course -------------------- */
  async function handleSaveCourse(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setMessage(null);

    if (!title || title.trim().length < 3) {
      setMessage("Title is required (min 3 chars).");
      return;
    }
    if (!branch) {
      setMessage("Select a branch.");
      return;
    }

    setSaving(true);
    try {
      const modules = modulesInput
        .split(/\r?\n|,/)
        .map((m) => m.trim())
        .filter(Boolean);
      const tagList = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

      if (selectedCourse) {
        // update
        const payload: Partial<Course> = {
          title: title.trim(),
          description: description.trim() || null,
          duration: duration.trim() || null,
          modules: modules.length ? modules : null,
          branch: branch || null,
          semester: semester || null,
          tags: tagList.length ? tagList : null,
        };
        const { error: updErr } = await supabase.from("courses").update(payload).eq("id", selectedCourse.id);
        if (updErr) throw updErr;

        if (file) {
          const { publicUrl, path } = await uploadFileToStorage(selectedCourse.id, file);
          const { error: fUpd } = await supabase.from("courses").update({ file_url: publicUrl, file_path: path }).eq("id", selectedCourse.id);
          if (fUpd) throw fUpd;
        }
        setMessage("Course updated.");
      } else {
        // create
        const payload: Partial<Course> = {
          title: title.trim(),
          description: description.trim() || null,
          duration: duration.trim() || null,
          modules: modules.length ? modules : null,
          branch: branch || null,
          semester: semester || null,
          tags: tagList.length ? tagList : null,
          faculty_id: faculty?.id ?? null,
          created_at: new Date().toISOString(),
        };

        const { data: created, error: createErr } = await supabase.from("courses").insert([payload]).select().single();
        if (createErr) throw createErr;
        const courseId = created.id;

        if (file) {
          const { publicUrl, path } = await uploadFileToStorage(courseId, file);
          const { error: fUpd } = await supabase.from("courses").update({ file_url: publicUrl, file_path: path }).eq("id", courseId);
          if (fUpd) throw fUpd;
        }

        setMessage("Course created.");
      }

      // refresh list & reset form
      await fetchCourses(page, query, filterBranch, filterSemester, faculty);
      resetForm();
    } catch (err: any) {
      console.error("handleSaveCourse err", err);
      setMessage("Save failed: " + (err?.message ?? String(err)));
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setSelectedCourse(null);
    setTitle("");
    setDescription("");
    setDuration("");
    setModulesInput("");
    setBranch("");
    setSemester("I");
    setTagsInput("");
    setFile(null);
  }

  /* -------------------- load course details (enrollments + progress) -------------------- */
  async function loadCourseDetails(courseId: string) {
    setMessage(null);
    try {
      // enrollments
      const { data: enrollData } = await supabase
        .from("course_enrollments")
        .select("id,student_id,student:users(id,name,usn,branch,semester),enrolled_at")
        .eq("course_id", courseId)
        .order("enrolled_at", { ascending: false });

      const enrollmentsNormalized = (enrollData || []).map((r: any) => ({
        id: r.id,
        student_id: r.student_id,
        name: r.student?.name ?? "Unknown",
        usn: r.student?.usn ?? "",
        branch: r.student?.branch ?? "",
        semester: r.student?.semester ?? "",
        enrolled_at: r.enrolled_at,
      }));

      setEnrollments(enrollmentsNormalized);

      // progress
      const { data: prog } = await supabase.from("course_progress").select("*").eq("course_id", courseId);
      setProgressList(prog || []);
    } catch (err: any) {
      console.error("loadCourseDetails err", err);
      setMessage("Failed to load course details: " + (err?.message ?? String(err)));
    }
  }

  /* -------------------- enroll / unenroll students -------------------- */
  async function enrollStudent(courseId: string, studentId: string) {
    try {
      const { error } = await supabase.from("course_enrollments").insert([{ course_id: courseId, student_id: studentId, enrolled_at: new Date().toISOString() }]);
      if (error) throw error;
      await loadCourseDetails(courseId);
      setMessage("Student enrolled.");
    } catch (err: any) {
      console.error("enrollStudent err", err);
      setMessage("Enroll failed: " + (err?.message ?? String(err)));
    }
  }

  async function unenrollStudent(courseId: string, studentId: string) {
    if (!confirm("Unenroll student from course?")) return;
    try {
      const { error } = await supabase.from("course_enrollments").delete().eq("course_id", courseId).eq("student_id", studentId);
      if (error) throw error;
      await loadCourseDetails(courseId);
      setMessage("Student unenrolled.");
    } catch (err: any) {
      console.error("unenrollStudent err", err);
      setMessage("Unenroll failed: " + (err?.message ?? String(err)));
    }
  }

  /* -------------------- mark course completed for student (faculty action) -------------------- */
  async function markStudentCompleted(courseId: string, studentId: string) {
    try {
      const { data: existing } = await supabase
        .from("course_progress")
        .select("*")
        .eq("course_id", courseId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (existing && existing.id) {
        await supabase.from("course_progress").update({ completed: true, completed_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await supabase.from("course_progress").insert([{ course_id: courseId, student_id: studentId, completed: true, completed_at: new Date().toISOString() }]);
      }

      // add achievement to student profile & generate certificate file
      await addAchievementAndCertificate(courseId, studentId);
      await loadCourseDetails(courseId);
      setMessage("Student marked completed and certificate generated.");
    } catch (err: any) {
      console.error("markStudentCompleted err", err);
      setMessage("Operation failed: " + (err?.message ?? String(err)));
    }
  }

  /* -------------------- student-side completion (function to call) -------------------- */
  async function studentCompleteCourse(courseId: string) {
    // This function could be used from student UI; included here for completeness
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      setMessage("Please login.");
      return;
    }
    const studentAuthId = auth.user.id;
    const { data: studentRow } = await supabase.from("users").select("id").eq("auth_id", studentAuthId).single();
    if (!studentRow) {
      setMessage("Student record not found.");
      return;
    }
    const studentId = studentRow.id;
    // reuse markStudentCompleted logic (faculty)
    await markStudentCompleted(courseId, studentId);
  }

  /* -------------------- generate certificate PDF, upload to storage, and add achievement -------------------- */
  async function addAchievementAndCertificate(courseId: string, studentId: string) {
    try {
      // fetch student + course details
      const { data: studentRow } = await supabase.from("users").select("id,name,email,achievements").eq("id", studentId).single();
      const { data: courseRow } = await supabase.from("courses").select("title,description").eq("id", courseId).single();
      const stud = (studentRow as any) || {};
      const c = (courseRow as any) || {};

      // create PDF certificate with jsPDF
      const doc = new jsPDF({
        orientation: "landscape",
        format: "a4",
      });
      doc.setFontSize(28);
      doc.text("Certificate of Completion", 105, 40, { align: "center" });
      doc.setFontSize(18);
      doc.text(`This is to certify that`, 105, 70, { align: "center" });
      doc.setFontSize(22);
      doc.text(stud.name || "Student", 105, 90, { align: "center" });
      doc.setFontSize(16);
      doc.text(`has successfully completed the course`, 105, 110, { align: "center" });
      doc.setFontSize(20);
      doc.text(c.title || "Course", 105, 130, { align: "center" });
      doc.setFontSize(12);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 105, 160, { align: "center" });
      // generate blob
      const pdfBlob = doc.output("blob");

      // upload to storage under path: certificates/{studentId}/{courseId}/{timestamp}.pdf
      const path = `certificates/${studentId}/${courseId}/${Date.now()}_certificate.pdf`;
      const { error: upErr } = await supabase.storage.from("courses").upload(path, pdfBlob as any, { contentType: "application/pdf", upsert: true });
      if (upErr) console.warn("certificate upload warning", upErr);

      // get public url
      const { data: urlData } = supabase.storage.from("courses").getPublicUrl(path);
      const certUrl = urlData?.publicUrl ?? null;

      // update student achievements array (avoid duplicates)
      const achievementText = `Completed course: ${c.title || courseId}`;
      const currentAchievements = Array.isArray(stud.achievements) ? stud.achievements : [];
      if (!currentAchievements.includes(achievementText)) {
        const newAchievements = [...currentAchievements, achievementText];
        await supabase.from("users").update({ achievements: newAchievements }).eq("id", studentId);
      }

      // Optionally store certificate reference somewhere (e.g., student_certificates table) - simplified here as a user achievement link appended
      if (certUrl) {
        const { error: certRecErr } = await supabase.from("course_progress").update({ certificate_url: certUrl }).eq("course_id", courseId).eq("student_id", studentId);
        if (certRecErr) {
          // It's okay if update fails because column may not exist; ignore
        }
      }

      // send notification or email (not implemented here; hook notifications)
    } catch (err: any) {
      console.error("addAchievementAndCertificate err", err);
    }
  }

  /* -------------------- delete course (and remove storage file if any) -------------------- */
  async function deleteCourse(course: Course) {
    if (!confirm("Delete course and all associated data?")) return;
    setMessage(null);
    try {
      // delete stored file if exists
      if (course.file_path) {
        try {
          await supabase.storage.from("courses").remove([course.file_path]);
        } catch (err) {
          console.warn("failed remove file:", err);
        }
      }
      // delete enrollments & progress first (optional)
      await supabase.from("course_enrollments").delete().eq("course_id", course.id);
      await supabase.from("course_progress").delete().eq("course_id", course.id);
      // delete course record
      const { error } = await supabase.from("courses").delete().eq("id", course.id);
      if (error) throw error;
      setMessage("Course deleted.");
      await fetchCourses(page, query, filterBranch, filterSemester, faculty);
      setSelectedCourse(null);
    } catch (err: any) {
      console.error("deleteCourse err", err);
      setMessage("Delete failed: " + (err?.message ?? String(err)));
    }
  }

  /* -------------------- export enrollments/progress CSV -------------------- */
  function exportEnrollmentsCSV(courseId: string) {
    const rows = [
      ["USN", "Student Name", "Branch", "Semester", "Enrolled At", "Completed", "Completed At"],
      ...enrollments.map((en) => {
        const prog = progressList.find((p) => p.course_id === courseId && p.student_id === en.student_id);
        return [en.usn || "", en.name || "", en.branch || "", en.semester || "", en.enrolled_at || "", prog?.completed ? "Yes" : "No", prog?.completed_at || ""];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `course_${courseId}_enrollments.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* -------------------- UI rendering -------------------- */
  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Skill Build — Courses (Faculty)</h1>

      {message && <div className="mb-4 p-3 rounded bg-yellow-100 text-yellow-800">{message}</div>}

      {/* Course Form */}
      <section className="bg-white p-4 rounded shadow mb-6">
        <h2 className="font-semibold mb-2">{selectedCourse ? "Edit Course" : "Create Course"}</h2>
        <form onSubmit={handleSaveCourse} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course Title" className="border p-2 rounded md:col-span-2" />
          <input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration (e.g., 4 weeks / 10 hours)" className="border p-2 rounded" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="col-span-1 md:col-span-3 border p-2 rounded" />
          <textarea value={modulesInput} onChange={(e) => setModulesInput(e.target.value)} placeholder="Modules (newline or comma separated)" className="col-span-1 md:col-span-2 border p-2 rounded" />
          <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="Tags (comma separated)" className="border p-2 rounded" />
          <div className="flex gap-2 items-center">
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="border p-2 rounded">
              <option value="">Select Branch</option>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="border p-2 rounded">
              {["I","II","III","IV","V","VI","VII","VIII"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="border p-2 rounded" />
          </div>

          <div className="md:col-span-3 flex gap-2 justify-end">
            {selectedCourse && (
              <button type="button" onClick={() => { resetForm(); setSelectedCourse(null); }} className="px-3 py-2 rounded bg-gray-200">
                Cancel Edit
              </button>
            )}
            <button type="submit" disabled={saving} className="px-4 py-2 rounded bg-blue-600 text-white">
              {saving ? "Saving..." : selectedCourse ? "Update Course" : "Create Course"}
            </button>
          </div>
        </form>
      </section>

      {/* Search & Filters */}
      <section className="bg-white p-3 rounded shadow mb-4 flex items-center gap-2 flex-wrap">
        <input placeholder="Search courses" value={query} onChange={(e) => setQuery(e.target.value)} className="border p-2 rounded" />
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="border p-2 rounded">
          <option value="">All Branches</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterSemester} onChange={(e) => setFilterSemester(e.target.value)} className="border p-2 rounded">
          <option value="">All Semesters</option>
          {["I","II","III","IV","V","VI","VII","VIII"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => fetchCourses(1, query, filterBranch, filterSemester, faculty)} className="bg-indigo-600 text-white px-3 py-1 rounded">Search</button>
        <button onClick={() => { setQuery(""); setFilterBranch(""); setFilterSemester(""); fetchCourses(1, "", "", ""); }} className="bg-gray-200 px-3 py-1 rounded">Reset</button>
        <div className="ml-auto text-sm text-gray-600">Showing {courses.length} / {totalCourses}</div>
      </section>

      {/* Course List */}
      <section className="bg-white p-4 rounded shadow mb-6">
        {loading ? (
          <div className="p-6">Loading courses…</div>
        ) : courses.length === 0 ? (
          <div className="p-6 text-gray-600">No courses found.</div>
        ) : (
          <ul className="space-y-3">
            {courses.map((c) => (
              <li key={c.id} className="border p-3 rounded flex flex-col md:flex-row md:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-lg">{c.title}</h3>
                      <div className="text-sm text-gray-600">{c.branch || "All branches"} • Sem {c.semester || "All"}</div>
                      <div className="text-xs text-gray-500">{c.duration || ""} • Created: {c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</div>
                    </div>
                    <div className="text-sm text-gray-500">By: {c.faculty_id === faculty?.id ? "You" : c.faculty_id}</div>
                  </div>

                  {c.description && <p className="mt-2 text-sm text-gray-700">{c.description}</p>}
                  {c.file_url && <div className="mt-2"><a href={c.file_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open Course File</a></div>}
                  {c.tags && c.tags.length > 0 && <div className="mt-2 text-xs text-gray-600">Tags: {c.tags.join(", ")}</div>}
                </div>

                <div className="flex flex-col gap-2 items-end">
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedCourse(c); setTitle(c.title); setDescription(c.description || ""); setDuration(c.duration || ""); setModulesInput((c.modules || []).join("\n")); setBranch(c.branch || ""); setSemester(c.semester || "I"); setTagsInput((c.tags || []).join(",")); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="px-3 py-1 bg-yellow-400 rounded">Edit</button>
                    <button onClick={() => { loadCourseDetails(c.id); setSelectedCourse(c); }} className="px-3 py-1 bg-blue-600 text-white rounded">Manage</button>
                    <button onClick={() => deleteCourse(c)} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>
                  </div>
                  <div className="text-xs text-gray-500">Course ID: {c.id}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">Page {page}</div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => fetchCourses(page - 1, query, filterBranch, filterSemester, faculty)} className="px-3 py-1 border rounded">Prev</button>
            <button disabled={page * pageSize >= (totalCourses || 0)} onClick={() => fetchCourses(page + 1, query, filterBranch, filterSemester, faculty)} className="px-3 py-1 border rounded">Next</button>
          </div>
        </div>
      </section>

      {/* Selected Course Management */}
      {selectedCourse && (
        <section className="bg-white p-4 rounded shadow">
          <h2 className="font-semibold">Manage Course — {selectedCourse.title}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div className="md:col-span-2">
              <h3 className="font-medium">Enrollments</h3>
              {enrollments.length === 0 ? (
                <p className="text-sm text-gray-600">No students enrolled yet.</p>
              ) : (
                <table className="w-full border mt-2">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2">USN</th>
                      <th className="border p-2">Name</th>
                      <th className="border p-2">Branch</th>
                      <th className="border p-2">Semester</th>
                      <th className="border p-2">Enrolled At</th>
                      <th className="border p-2">Completed</th>
                      <th className="border p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((en) => {
                      const prog = progressList.find((p) => p.course_id === selectedCourse.id && p.student_id === en.student_id);
                      return (
                        <tr key={en.student_id}>
                          <td className="border p-2 text-xs">{en.usn}</td>
                          <td className="border p-2 text-sm">{en.name}</td>
                          <td className="border p-2 text-xs">{en.branch}</td>
                          <td className="border p-2 text-xs">{en.semester}</td>
                          <td className="border p-2 text-xs">{en.enrolled_at ? new Date(en.enrolled_at).toLocaleString() : ""}</td>
                          <td className="border p-2 text-center">{prog?.completed ? "✅" : "—"}</td>
                          <td className="border p-2 text-right">
                            {!prog?.completed && <button onClick={() => markStudentCompleted(selectedCourse.id, en.student_id)} className="px-2 py-1 bg-green-600 text-white rounded text-xs mr-2">Mark Complete</button>}
                            <button onClick={() => unenrollStudent(selectedCourse.id, en.student_id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs">Unenroll</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div className="mt-3 flex gap-2">
                <button onClick={() => exportEnrollmentsCSV(selectedCourse.id)} className="bg-gray-700 text-white px-3 py-1 rounded">Export Enrollments</button>
                <button onClick={() => { /* optionally refresh */ loadCourseDetails(selectedCourse.id); }} className="bg-gray-200 px-3 py-1 rounded">Refresh</button>
              </div>
            </div>

            <div>
              <h3 className="font-medium">Course Analytics</h3>
              <div className="mt-2 text-sm">
                <div>Total Enrolled: <strong>{enrollments.length}</strong></div>
                <div>Completed: <strong>{progressList.filter(p => p.course_id === selectedCourse.id && p.completed).length}</strong></div>
                <div>Completion %: <strong>{enrollments.length ? Math.round((progressList.filter(p => p.course_id === selectedCourse.id && p.completed).length / enrollments.length) * 100) : 0}%</strong></div>
                <div className="mt-2">
                  <label className="text-xs">Enroll a student (by user ID):</label>
                  <div className="flex gap-2 mt-1">
                    <input id="enrollStudentId" placeholder="student_id" className="border p-2 rounded flex-1" />
                    <button onClick={async () => {
                      const input = (document.getElementById("enrollStudentId") as HTMLInputElement).value.trim();
                      if (!input) { setMessage("Enter student id"); return; }
                      await enrollStudent(selectedCourse.id, input);
                      (document.getElementById("enrollStudentId") as HTMLInputElement).value = "";
                    }} className="px-3 py-1 bg-blue-600 text-white rounded">Enroll</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
