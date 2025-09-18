"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function StudentDashboard() {
  const [student, setStudent] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);
  const [fees, setFees] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setMessage("Login required.");
          return;
        }

        const { data: studentData } = await supabase
          .from("users")
          .select("*")
          .eq("auth_id", auth.user.id)
          .single();
        if (!studentData) {
          setMessage("Student not found.");
          return;
        }
        setStudent(studentData);

        // Assignments
        const { data: ass } = await supabase
          .from("assignments")
          .select("*")
          .eq("branch", studentData.branch)
          .eq("semester", studentData.semester)
          .order("due_date", { ascending: true })
          .limit(3);
        setAssignments(ass ?? []);

        // Attendance
        const { data: att } = await supabase
          .from("attendance")
          .select("*")
          .eq("student_id", studentData.id);
        setAttendance(att ?? []);

        // Timetable → filter today
        const today = new Date().toLocaleDateString("en-US", {
          weekday: "long",
        });
        const { data: tt } = await supabase
          .from("timetables")
          .select("schedule")
          .eq("branch", studentData.branch)
          .eq("semester", studentData.semester)
          .maybeSingle();
        if (tt?.schedule && tt.schedule[today]) {
          setTodaySchedule(tt.schedule[today]);
        }

        // Fees
        const { data: fee } = await supabase
          .from("fees")
          .select("*")
          .eq("student_id", studentData.id)
          .single();
        setFees(fee);

        // Notifications
        const { data: notifs } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", studentData.id)
          .order("created_at", { ascending: false })
          .limit(5);
        setNotifications(notifs ?? []);
      } catch (err: any) {
        setMessage("Error loading dashboard: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

  const attendanceChartData = (() => {
    const grouped: Record<string, number> = {};
    attendance.forEach((a) => {
      if (!grouped[a.subject]) grouped[a.subject] = 0;
      if (a.present) grouped[a.subject]++;
    });
    return Object.keys(grouped).map((subj, idx) => ({
      subject: subj,
      value: grouped[subj],
      fill: COLORS[idx % COLORS.length],
    }));
  })();

  if (loading) return <p>Loading...</p>;
  if (message) return <p>{message}</p>;

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">Welcome, {student?.name}</h1>

      {/* Today Schedule */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Today’s Schedule</h2>
        {todaySchedule.length === 0 ? (
          <p>No classes today 🎉</p>
        ) : (
          <ul>
            {todaySchedule.map((cls: any, i: number) => (
              <li key={i} className="border-b py-1">
                {cls.time} → {cls.subject} ({cls.faculty})
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Assignments */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Upcoming Assignments</h2>
        {assignments.length === 0 ? (
          <p>No upcoming assignments</p>
        ) : (
          <ul>
            {assignments.map((a) => (
              <li key={a.id} className="border-b py-2">
                <strong>{a.title}</strong> — Due: {a.due_date}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Attendance Summary */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Attendance Summary</h2>
        {attendanceChartData.length === 0 ? (
          <p>No attendance records</p>
        ) : (
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={attendanceChartData}
                  dataKey="value"
                  nameKey="subject"
                  outerRadius={80}
                  label
                >
                  {attendanceChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Fees */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Fee Details</h2>
        {fees ? (
          <div>
            <p>Total: ₹{fees.total}</p>
            <p>Paid: ₹{fees.paid}</p>
            <p>Pending: ₹{fees.pending}</p>
          </div>
        ) : (
          <p>No fee record available</p>
        )}
      </section>

      {/* Notifications */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">Latest Notifications</h2>
        {notifications.length === 0 ? (
          <p>No notifications yet</p>
        ) : (
          <ul>
            {notifications.map((n) => (
              <li key={n.id} className="border-b py-1">
                {n.title}: {n.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
