"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import jsPDF from "jspdf";

/**
 * Faculty Reports Page
 * Features:
 * - Attendance & Results analytics
 * - Filters: branch, semester, subject, date range
 * - Stats: average %, pass rate, top students
 * - Charts: attendance distribution, performance trend
 * - Export CSV & PDF
 * - Realtime updates
 */

type Attendance = {
  student_id: string;
  subject: string;
  date: string;
  present: boolean;
};

type Result = {
  student_id: string;
  subject: string;
  module_marks: number;
  lab_marks: number;
  internal_marks: number;
};

type Student = {
  id: string;
  name: string;
  usn: string;
};

export default function FacultyReports() {
  const [faculty, setFaculty] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [subject, setSubject] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stats, setStats] = useState<any>({});
  const [message, setMessage] = useState("");
  const channelRef = useRef<any>(null);

  useEffect(() => {
    async function loadFaculty() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      const { data: fac } = await supabase.from("users").select("*").eq("auth_id", auth.user.id).single();
      if (fac) setFaculty(fac);
    }
    loadFaculty();
  }, []);

  useEffect(() => {
    if (!branch || !semester || !subject) return;
    fetchData();
    channelRef.current = supabase
      .channel("public:attendance_results")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "results" }, fetchData)
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [branch, semester, subject, dateFrom, dateTo]);

  async function fetchData() {
    try {
      const { data: studs } = await supabase.from("users").select("id,name,usn").eq("branch", branch).eq("semester", semester).eq("role", "student");
      setStudents(studs || []);

      let attQuery = supabase.from("attendance").select("*").eq("branch", branch).eq("semester", semester).eq("subject", subject);
      if (dateFrom) attQuery = attQuery.gte("date", dateFrom);
      if (dateTo) attQuery = attQuery.lte("date", dateTo);
      const { data: att } = await attQuery;
      setAttendance(att || []);

      const { data: res } = await supabase.from("results").select("*").eq("subject", subject);
      setResults(res || []);

      computeStats(studs || [], att || [], res || []);
    } catch (err: any) {
      setMessage("Error loading reports: " + err.message);
    }
  }

  function computeStats(studs: Student[], att: Attendance[], res: Result[]) {
    if (!studs.length) return;
    const totalClasses = new Set(att.map((a) => a.date)).size || 1;
    const attendanceMap: Record<string, number> = {};
    studs.forEach((s) => {
      attendanceMap[s.id] = att.filter((a) => a.student_id === s.id && a.present).length;
    });

    const avgAttendance = Math.round(
      (Object.values(attendanceMap).reduce((sum, v) => sum + v, 0) / (studs.length * totalClasses)) * 100
    );

    const resultTotals = res.map((r) => r.module_marks + r.lab_marks + r.internal_marks);
    const pass = resultTotals.filter((t) => t >= 40).length;
    const passRate = Math.round((pass / (resultTotals.length || 1)) * 100);

    setStats({ avgAttendance, passRate, totalStudents: studs.length });
  }

  function exportCSV() {
    const rows = [
      ["USN", "Name", "Attendance %", "Total Marks"],
      ...students.map((s) => {
        const attCount = attendance.filter((a) => a.student_id === s.id && a.present).length;
        const classes = new Set(attendance.map((a) => a.date)).size || 1;
        const attPct = Math.round((attCount / classes) * 100);
        const res = results.find((r) => r.student_id === s.id);
        const marks = res ? res.module_marks + res.lab_marks + res.internal_marks : 0;
        return [s.usn, s.name, attPct, marks];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${branch}_${semester}_${subject}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Faculty Report", 20, 20);
    doc.text(`Branch: ${branch}, Semester: ${semester}, Subject: ${subject}`, 20, 30);
    doc.text(`Avg Attendance: ${stats.avgAttendance || 0}%`, 20, 40);
    doc.text(`Pass Rate: ${stats.passRate || 0}%`, 20, 50);
    doc.save(`report_${branch}_${semester}_${subject}.pdf`);
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">Faculty Reports</h1>
      {message && <div className="p-2 bg-yellow-100">{message}</div>}

      {/* Filters */}
      <section className="bg-white p-4 rounded shadow grid grid-cols-2 md:grid-cols-5 gap-3">
        <select value={branch} onChange={(e) => setBranch(e.target.value)} className="border p-2 rounded">
          <option value="">Branch</option>
          {faculty?.assigned_branches?.map((b: string) => <option key={b}>{b}</option>)}
        </select>
        <select value={semester} onChange={(e) => setSemester(e.target.value)} className="border p-2 rounded">
          <option value="">Semester</option>
          {faculty?.assigned_semesters?.map((s: string) => <option key={s}>{s}</option>)}
        </select>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="border p-2 rounded" />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border p-2 rounded" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border p-2 rounded" />
      </section>

      {/* Stats */}
      <section className="bg-white p-4 rounded shadow grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 bg-gray-50 rounded">Avg Attendance: {stats.avgAttendance || 0}%</div>
        <div className="p-3 bg-gray-50 rounded">Pass Rate: {stats.passRate || 0}%</div>
        <div className="p-3 bg-gray-50 rounded">Total Students: {stats.totalStudents || 0}</div>
      </section>

      {/* Attendance Chart */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Attendance Distribution</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={students.map((s) => {
            const attCount = attendance.filter((a) => a.student_id === s.id && a.present).length;
            const classes = new Set(attendance.map((a) => a.date)).size || 1;
            return { name: s.usn, attendance: Math.round((attCount / classes) * 100) };
          })}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="attendance" fill="#4a90e2" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Performance Chart */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Performance Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={students.map((s) => {
            const res = results.find((r) => r.student_id === s.id);
            return { name: s.usn, marks: res ? res.module_marks + res.lab_marks + res.internal_marks : 0 };
          })}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="marks" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Export */}
      <section className="bg-white p-4 rounded shadow flex gap-3">
        <button onClick={exportCSV} className="bg-blue-600 text-white px-4 py-2 rounded">Export CSV</button>
        <button onClick={exportPDF} className="bg-green-600 text-white px-4 py-2 rounded">Export PDF</button>
      </section>
    </main>
  );
}
