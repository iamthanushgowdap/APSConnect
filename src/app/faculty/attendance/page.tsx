"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { QRCodeSVG } from "qrcode.react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Student = {
  id: string;
  name: string;
  usn: string;
  branch: string;
  semester: string;
};

type AttendanceRecord = {
  id?: string;
  student_id: string;
  branch: string;
  semester: string;
  subject: string;
  date: string;
  present: boolean;
};

export default function FacultyAttendance() {
  const [faculty, setFaculty] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subject, setSubject] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [qrCode, setQrCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setMessage("Please login as Faculty");
          return;
        }

        const { data: fac } = await supabase
          .from("users")
          .select("*")
          .eq("auth_id", auth.user.id)
          .single();
        if (!fac) {
          setMessage("Faculty record not found");
          return;
        }
        setFaculty(fac);

        // set default branch/semester
        if (fac.assigned_branches?.length > 0) setBranch(fac.assigned_branches[0]);
        if (fac.assigned_semesters?.length > 0) setSemester(fac.assigned_semesters[0]);
      } catch (err: any) {
        setMessage("Error loading faculty: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function fetchStudents() {
      if (!branch || !semester) return;
      const { data, error } = await supabase
        .from("users")
        .select("id,name,usn,branch,semester")
        .eq("branch", branch)
        .eq("semester", semester)
        .eq("role", "student")
        .order("usn");
      if (error) {
        setMessage("Error fetching students");
        return;
      }
      setStudents(data || []);
      // initialize attendance state
      const init: Record<string, boolean> = {};
      (data || []).forEach((s) => (init[s.id] = true));
      setAttendance(init);
    }
    fetchStudents();
  }, [branch, semester]);

  async function saveAttendance() {
    if (!subject || !branch || !semester) {
      setMessage("Please select subject, branch, and semester");
      return;
    }
    try {
      const records: AttendanceRecord[] = students.map((s) => ({
        student_id: s.id,
        branch,
        semester,
        subject,
        date,
        present: attendance[s.id] || false,
      }));

      const { error } = await supabase.from("attendance").upsert(records, {
        onConflict: "student_id,branch,semester,subject,date",
      });
      if (error) throw error;

      setMessage("Attendance saved successfully ✅");
      await fetchAnalytics();
    } catch (err: any) {
      setMessage("Error saving attendance: " + err.message);
    }
  }

  function generateQr() {
    if (!subject || !branch || !semester) {
      setMessage("Select subject/branch/semester before QR");
      return;
    }
    const qrPayload = JSON.stringify({ branch, semester, subject, date });
    setQrCode(qrPayload);
    setMessage("QR Code generated. Students can scan to mark attendance.");
  }

  async function fetchAnalytics() {
    if (!subject || !branch || !semester) return;
    const { data } = await supabase
      .from("attendance")
      .select("present,student_id")
      .eq("branch", branch)
      .eq("semester", semester)
      .eq("subject", subject)
      .eq("date", date);
    if (!data) return;

    const total = students.length;
    const present = data.filter((r: any) => r.present).length;
    const absent = total - present;
    setAnalytics([
      { name: "Present", value: present },
      { name: "Absent", value: absent },
    ]);
  }

  if (loading) return <div className="p-6">Loading Faculty Attendance…</div>;

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">Faculty Attendance</h1>
      {message && <div className="p-2 bg-yellow-100 text-yellow-800">{message}</div>}

      {/* Filters */}
      <section className="bg-white p-4 rounded shadow space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border p-2 rounded"
          />
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className="border p-2 rounded">
            <option value="">Select Branch</option>
            {faculty?.assigned_branches?.map((b: string) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select value={semester} onChange={(e) => setSemester(e.target.value)} className="border p-2 rounded">
            <option value="">Select Semester</option>
            {faculty?.assigned_semesters?.map((s: string) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border p-2 rounded" />
        </div>

        <div className="flex gap-3">
          <button onClick={saveAttendance} className="bg-blue-600 text-white px-4 py-2 rounded">
            Save Attendance
          </button>
          <button onClick={generateQr} className="bg-green-600 text-white px-4 py-2 rounded">
            Generate QR
          </button>
        </div>
      </section>

      {/* QR Code */}
      {qrCode && (
        <section className="bg-white p-4 rounded shadow text-center">
          <QRCodeSVG value={qrCode} size={180} />
          <p className="mt-2 text-sm text-gray-600">Ask students to scan this QR</p>
        </section>
      )}

      {/* Student List */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Students</h2>
        {students.length === 0 ? (
          <p>No students found for this branch/semester.</p>
        ) : (
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2">USN</th>
                <th className="border p-2">Name</th>
                <th className="border p-2">Present</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="border p-2">{s.usn}</td>
                  <td className="border p-2">{s.name}</td>
                  <td className="border p-2 text-center">
                    <input
                      type="checkbox"
                      checked={attendance[s.id]}
                      onChange={(e) => setAttendance({ ...attendance, [s.id]: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Analytics */}
      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-2">Analytics</h2>
        {analytics.length === 0 ? (
          <p>No analytics yet.</p>
        ) : (
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={analytics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3182ce" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </main>
  );
}
