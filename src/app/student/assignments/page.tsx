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
};

type Submission = {
  id: string;
  assignment_id: string;
  file_url: string;
  submitted_at: string;
  feedback?: string;
  grade?: string;
};

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    const { data: student } = await supabase
      .from("users")
      .select("id,branch,semester")
      .eq("auth_id", auth.user.id)
      .maybeSingle();

    if (!student) return;

    const { data: ass } = await supabase
      .from("assignments")
      .select("*")
      .eq("branch", student.branch)
      .eq("semester", student.semester)
      .order("due_date", { ascending: true });

    setAssignments(ass ?? []);

    const { data: subs } = await supabase
      .from("assignment_submissions")
      .select("*")
      .eq("student_id", student.id);

    const map: Record<string, Submission> = {};
    (subs ?? []).forEach((s) => (map[s.assignment_id] = s));
    setSubmissions(map);
  }

  async function submitWork(assignmentId: string) {
    const fileUrl = prompt("Enter file URL:") || "";
    if (!fileUrl) return;

    const { error } = await supabase.from("assignment_submissions").upsert([
      { assignment_id: assignmentId, file_url: fileUrl },
    ]);
    if (error) {
      setMessage("Submit error: " + error.message);
    } else {
      setMessage("Submitted ✅");
      load();
    }
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">Student — Assignments</h1>
      {message && <div className="bg-green-100 p-2 rounded">{message}</div>}

      <ul className="bg-white shadow rounded divide-y">
        {assignments.map((a) => (
          <li key={a.id} className="p-3">
            <div className="font-semibold">{a.title}</div>
            <div className="text-sm text-gray-700">{a.description}</div>
            <div className="text-xs text-gray-600">
              Due: {a.due_date}
            </div>
            {a.file_url && (
              <a
                href={a.file_url}
                target="_blank"
                className="text-blue-600 underline text-sm"
              >
                Download Assignment
              </a>
            )}

            {/* Submission status */}
            {submissions[a.id] ? (
              <div className="mt-2 p-2 bg-green-50 rounded">
                <p className="text-sm">
                  ✅ Submitted at{" "}
                  {new Date(
                    submissions[a.id].submitted_at
                  ).toLocaleString()}
                </p>
                {submissions[a.id].feedback && (
                  <p className="text-xs text-gray-800">
                    Feedback: {submissions[a.id].feedback} (
                    {submissions[a.id].grade})
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={() => submitWork(a.id)}
                className="mt-2 bg-blue-600 text-white px-3 py-1 rounded"
              >
                Submit Work
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
