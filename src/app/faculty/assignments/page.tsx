"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Assignment = {
  id: string;
  title: string;
  description: string;
  branch: string;
  semester: number;
  file_url?: string;
  due_date: string;
  created_at: string;
};

type Submission = {
  id: string;
  student_id: string;
  file_url: string;
  submitted_at: string;
  feedback?: string;
  grade?: string;
  users?: { name: string; usn: string };
};

export default function FacultyAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [message, setMessage] = useState("");

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {
    const { data } = await supabase
      .from("assignments")
      .select("*")
      .order("created_at", { ascending: false });
    setAssignments(data ?? []);
  }

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("assignments").insert([
      { title, description, branch, semester, due_date: dueDate, file_url: fileUrl },
    ]);
    if (error) {
      setMessage("Error creating assignment: " + error.message);
    } else {
      setMessage("Assignment created ✅");
      setTitle("");
      setDescription("");
      setBranch("");
      setSemester(1);
      setDueDate("");
      setFileUrl("");
      loadAssignments();
    }
  }

  async function openSubmissions(a: Assignment) {
    setSelected(a);
    const { data } = await supabase
      .from("assignment_submissions")
      .select("*, users(name, usn)")
      .eq("assignment_id", a.id)
      .order("submitted_at", { ascending: false });
    setSubmissions(data ?? []);
  }

  async function giveFeedback(id: string, feedback: string, grade: string) {
    const { error } = await supabase
      .from("assignment_submissions")
      .update({ feedback, grade })
      .eq("id", id);
    if (error) setMessage("Feedback error: " + error.message);
    else setMessage("Feedback saved ✅");
    openSubmissions(selected!);
  }

  return (
    <main className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold">Faculty — Assignments</h1>
      {message && <div className="bg-green-100 p-2 rounded">{message}</div>}

      {/* Create Assignment */}
      <form
        onSubmit={createAssignment}
        className="bg-white shadow rounded p-4 space-y-3"
      >
        <h2 className="font-semibold text-lg">Create Assignment</h2>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <input
          placeholder="Branch"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <input
          type="number"
          placeholder="Semester"
          value={semester}
          onChange={(e) => setSemester(parseInt(e.target.value))}
          className="border p-2 rounded w-full"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <input
          placeholder="File URL (optional)"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <button className="bg-blue-600 text-white px-3 py-1 rounded">
          Create
        </button>
      </form>

      {/* Assignments list */}
      <section>
        <h2 className="font-semibold text-lg mb-2">My Assignments</h2>
        <ul className="bg-white shadow rounded divide-y">
          {assignments.map((a) => (
            <li key={a.id} className="p-3 flex justify-between">
              <div>
                <div className="font-semibold">{a.title}</div>
                <div className="text-sm">
                  {a.branch} — Sem {a.semester}
                </div>
                <div className="text-xs text-gray-600">
                  Due: {a.due_date}
                </div>
              </div>
              <button
                onClick={() => openSubmissions(a)}
                className="bg-indigo-600 text-white px-2 py-1 rounded"
              >
                View Submissions
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Submissions */}
      {selected && (
        <section className="bg-white shadow rounded p-4 space-y-3">
          <h2 className="font-semibold">
            Submissions for {selected.title}
          </h2>
          {submissions.length === 0 ? (
            <p>No submissions yet.</p>
          ) : (
            <ul className="divide-y">
              {submissions.map((s) => (
                <li key={s.id} className="py-2 flex justify-between items-center">
                  <div>
                    <div className="font-semibold">
                      {s.users?.name} ({s.users?.usn})
                    </div>
                    <a
                      href={s.file_url}
                      target="_blank"
                      className="text-blue-600 underline text-sm"
                    >
                      Download
                    </a>
                    <div className="text-xs text-gray-600">
                      Submitted: {new Date(s.submitted_at).toLocaleString()}
                    </div>
                    {s.feedback && (
                      <div className="text-green-700 text-sm">
                        Feedback: {s.feedback} ({s.grade})
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const fb = prompt("Feedback:", s.feedback || "") || "";
                      const gr = prompt("Grade:", s.grade || "") || "";
                      giveFeedback(s.id, fb, gr);
                    }}
                    className="bg-gray-200 px-2 py-1 rounded"
                  >
                    Feedback
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
