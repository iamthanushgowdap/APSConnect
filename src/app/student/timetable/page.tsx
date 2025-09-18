"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ScheduleEntry = { time: string; subject: string; faculty: string; location: string };

export default function StudentTimetable() {
  const [student, setStudent] = useState<any>(null);
  const [schedule, setSchedule] = useState<Record<string, ScheduleEntry[]>>({});
  const [day, setDay] = useState<string>(new Date().toLocaleDateString("en-US", { weekday: "long" }));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) {
          setMessage("Login required");
          return;
        }
        const { data: studentData } = await supabase.from("users").select("*").eq("auth_id", auth.user.id).single();
        if (!studentData) {
          setMessage("Student not found");
          return;
        }
        setStudent(studentData);

        const { data: tt } = await supabase
          .from("timetables")
          .select("schedule")
          .eq("branch", studentData.branch)
          .eq("semester", studentData.semester)
          .single();
        if (!tt?.schedule) {
          setMessage("No timetable available");
          return;
        }
        setSchedule(tt.schedule);
      } catch (err: any) {
        setMessage("Error loading timetable: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (loading) return <p>Loading...</p>;
  if (message) return <p>{message}</p>;

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">My Timetable</h1>

      {/* Day Selector */}
      <div className="flex space-x-2">
        {days.map((d) => (
          <button
            key={d}
            className={`px-3 py-1 rounded ${day === d ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            onClick={() => setDay(d)}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Timetable Grid */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-xl font-semibold mb-2">{day}</h2>
        {!schedule[day] ? (
          <p>No classes scheduled</p>
        ) : (
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2">Time</th>
                <th className="border p-2">Subject</th>
                <th className="border p-2">Faculty</th>
                <th className="border p-2">Location</th>
              </tr>
            </thead>
            <tbody>
              {schedule[day].map((cls, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border p-2">{cls.time}</td>
                  <td className="border p-2">{cls.subject}</td>
                  <td className="border p-2">{cls.faculty}</td>
                  <td className="border p-2">{cls.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
