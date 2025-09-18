// src/app/student/assignments/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Assignment = {
  id: string;
  title: string;
  description?: string;
  due_date?: string | null;
  file_url?: string | null;
  branch?: string | null;
  semester?: string | null;
  created_at?: string;
};

export default function StudentAssignments() {
  const [student, setStudent] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setLoading(false);
        return;
      }

      const { data: studentRow } = await supabase
        .from("users")
        .select("id,branch,semester,name,email")
        .eq("auth_id", auth.user.id)
        .single();

      if (!studentRow) {
        setLoading(false);
        return;
      }

      setStudent(studentRow);

      const { data: assignmentData } = await supabase
        .from("assignments")
        .select("*")
        .eq("branch", studentRow.branch)
        .eq("semester", studentRow.semester)
        .order("due_date", { ascending: true });

      setAssignments(assignmentData || []);
      setLoading(false);
    }
    load();
    // realtime updates (optional)
    const channel = supabase
      .channel("assignments-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assignments" },
        () => {
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return <div className="p-6">Loading assignments…</div>;

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">My Assignments</h1>
      {student && (
        <p className="text-sm text-gray-600 mb-4">
          Showing assignments for <strong>{student.branch}</strong> — Sem{" "}
          <strong>{student.semester}</strong>
        </p>
      )}

      {assignments.length === 0 ? (
        <p>No assignments found for your branch & semester.</p>
      ) : (
        <ul className="space-y-4">
          {assignments.map((a) => {
            const due = a.due_date ? new Date(a.due_date) : null;
            const dueStr = due ? due.toLocaleDateString() : "No due date";
            return (
              <li key={a.id} className="bg-white p-4 rounded shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-semibold">{a.title}</h2>
                    <p className="text-sm text-gray-600 mt-1">{a.description}</p>
                    <p className="text-xs text-gray-500 mt-2">Due: {dueStr}</p>
                  </div>
                  <div className="text-right">
                    {a.file_url && (
                      <a
                        href={a.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Download
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
