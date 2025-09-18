"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Result = {
  id: string;
  subject: string;
  module_marks: number;
  lab_marks: number;
  internal_marks: number;
  branch?: string | null;
  semester?: string | null;
};

export default function StudentResults() {
  const [student, setStudent] = useState<any>(null);
  const [results, setResults] = useState<Result[]>([]);
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

        const { data: res, error } = await supabase
          .from("results")
          .select("*")
          .eq("student_id", studentRow.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setResults(res || []);
      } catch (err: any) {
        setMessage("Error loading results: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalMarks = results.reduce(
    (sum, r) => sum + r.module_marks + r.lab_marks + r.internal_marks,
    0
  );
  const maxMarks = results.length * 100; // assume each subject max 100
  const percentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;

  if (loading) return <div className="p-6">Loading results…</div>;
  if (message) return <div className="p-6">{message}</div>;

  return (
    <main className="p-6 bg-gray-50 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">My Results</h1>

      {results.length === 0 ? (
        <p>No results uploaded yet.</p>
      ) : (
        <>
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">Subject</th>
                <th className="border p-2">Module</th>
                <th className="border p-2">Lab</th>
                <th className="border p-2">Internal</th>
                <th className="border p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="border p-2">{r.subject}</td>
                  <td className="border p-2">{r.module_marks}</td>
                  <td className="border p-2">{r.lab_marks}</td>
                  <td className="border p-2">{r.internal_marks}</td>
                  <td className="border p-2 font-bold">
                    {r.module_marks + r.lab_marks + r.internal_marks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary */}
          <section className="bg-white shadow p-4 rounded">
            <h2 className="text-lg font-semibold">Summary</h2>
            <p>Total Marks: {totalMarks}</p>
            <p>Percentage: {percentage}%</p>
            <p>
              Status:{" "}
              {percentage >= 40 ? (
                <span className="text-green-600 font-bold">PASS</span>
              ) : (
                <span className="text-red-600 font-bold">FAIL</span>
              )}
            </p>
          </section>
        </>
      )}
    </main>
  );
}
