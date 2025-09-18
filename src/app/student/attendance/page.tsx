"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function StudentAttendance() {
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setMessage("Login required");
          return;
        }

        const { data: studentData } = await supabase
          .from("users")
          .select("*")
          .eq("auth_id", auth.user.id)
          .single();
        if (!studentData) {
          setMessage("Student not found");
          return;
        }
        setStudent(studentData);

        const { data: att } = await supabase
          .from("attendance")
          .select("*")
          .eq("student_id", studentData.id);
        setAttendance(att ?? []);
      } catch (err: any) {
        setMessage("Error: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const grouped = (() => {
    const g: Record<string, { present: number; total: number }> = {};
    attendance.forEach((a) => {
      if (!g[a.subject]) g[a.subject] = { present: 0, total: 0 };
      g[a.subject].total++;
      if (a.present) g[a.subject].present++;
    });
    return g;
  })();

  const chartData = Object.keys(grouped).map((subj) => {
    const p = grouped[subj].present;
    const t = grouped[subj].total;
    return { subject: subj, percentage: Math.round((p / t) * 100) };
  });

  const overall = (() => {
    let p = 0,
      t = 0;
    Object.values(grouped).forEach((v) => {
      p += v.present;
      t += v.total;
    });
    return t > 0 ? Math.round((p / t) * 100) : 0;
  })();

  if (loading) return <p>Loading...</p>;
  if (message) return <p>{message}</p>;

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">My Attendance</h1>

      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Overall</h2>
        <p
          className={
            overall < 75 ? "text-red-600 font-bold" : "text-green-600 font-bold"
          }
        >
          {overall}% {overall < 75 && "(Shortage!)"}
        </p>
      </section>

      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">By Subject</h2>
        {chartData.length === 0 ? (
          <p>No attendance data</p>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="percentage" fill="#3182ce" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </main>
  );
}
