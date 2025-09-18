"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Exam = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string | null;
  branch?: string | null;
  semester?: string | null;
  location?: string | null;
};

function countdownText(dateIso: string) {
  const now = new Date();
  const target = new Date(dateIso);
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return "Started / Passed";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  return `${days}d ${hours}h ${minutes}m`;
}

export default function StudentExams() {
  const [student, setStudent] = useState<any | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setMessage("Please login.");
          return;
        }
        const { data: studentRow } = await supabase
          .from("users")
          .select("id,branch,semester")
          .eq("auth_id", auth.user.id)
          .single();
        if (!studentRow) {
          setMessage("Student not found.");
          return;
        }
        setStudent(studentRow);

        const { data: examData, error } = await supabase
          .from("exams")
          .select("*")
          .or(
            `and(branch.eq.${studentRow.branch},semester.eq.${studentRow.semester}),branch.is.null,semester.is.null`
          )
          .order("date", { ascending: true });

        if (error) throw error;
        setExams(examData || []);
      } catch (err: any) {
        setMessage("Error loading exams: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6">Loading exams…</div>;
  if (message) return <div className="p-6">{message}</div>;

  return (
    <main className="p-6 bg-gray-50 min-h-screen space-y-4">
      <h1 className="text-2xl font-bold mb-4">Exam Timetable</h1>

      {exams.length === 0 ? (
        <p>No exams scheduled yet.</p>
      ) : (
        <ul className="space-y-3">
          {exams.map((e) => {
            const dateTime = e.time ? `${e.date}T${e.time}` : e.date;
            return (
              <li
                key={e.id}
                className="bg-white p-4 rounded shadow flex justify-between items-center"
              >
                <div>
                  <h3 className="font-semibold">{e.title}</h3>
                  <p className="text-sm text-gray-600">
                    Date: {new Date(e.date).toLocaleDateString()}{" "}
                    {e.time && `• ${e.time}`}
                  </p>
                  {e.location && (
                    <p className="text-sm text-gray-600">Venue: {e.location}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Countdown: {countdownText(dateTime)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-700">
                    {e.branch || "All branches"} • Sem {e.semester || "All"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
