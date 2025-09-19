"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function AdminAttendancePage() {
  const [summary, setSummary] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    // fetch sessions
    const { data: s } = await supabase.from("attendance_sessions").select("*").order("session_date", { ascending: false });
    setSessions(s ?? []);
    // fetch aggregated summary from view
    const { data: summ } = await supabase.from("attendance_summary_by_student").select("*").limit(200);
    setSummary(summ ?? []);
  }

  // build simple counts: % buckets
  const chartData = [
    { name: '>=75%', value: summary.filter((r:any) => r.percent_present >= 75).length },
    { name: '50-75%', value: summary.filter((r:any) => r.percent_present >= 50 && r.percent_present < 75).length },
    { name: '<50%', value: summary.filter((r:any) => r.percent_present < 50).length }
  ];
  

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Attendance Reports (Admin)</h1>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Attendance Distribution</h2>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100} label>
               {chartData.map((entry, index) => (
                 <Cell key={`cell-${index}`} fill={["#4caf50", "#ff9800", "#f44336"][index % 3]} />
                    ))}
               </Pie>

              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Recent Sessions</h2>
        <ul>
          {sessions.map(s => (
            <li key={s.id} className="border-b py-2">{s.subject} — {s.branch} Sem {s.semester} • {s.session_date}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
