// src/app/faculty/timetable/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Faculty Timetable
 * - Pick branch & semester (faculty's assigned)
 * - Show weekly grid (Mon-Sat) with timeslots
 * - Add / Update / Delete class entries: subject, time, faculty (self), location
 * - Save timetable object into 'timetables' table with document structure schedule: { Monday: [{time,subject,faculty,location}], ...}
 */

type ClassEntry = { id?: string; time: string; subject: string; faculty?: string; location?: string };

export default function FacultyTimetable() {
  const [faculty, setFaculty] = useState<any | null>(null);
  const [branch, setBranch] = useState<string>("");
  const [semester, setSemester] = useState<string>("I");
  const [schedule, setSchedule] = useState<Record<string, ClassEntry[]>>({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) return setMessage("Login required.");
        const { data: f } = await supabase.from("users").select("id,name,assigned_branches,assigned_semesters").eq("auth_id", auth.user.id).single();
        setFaculty(f || null);
        // if faculty assigned, preselect
        if (f?.assigned_branches?.length) setBranch(f.assigned_branches[0]);
        if (f?.assigned_semesters?.length) setSemester(f.assigned_semesters[0]);
      } catch (err) {
        console.error(err);
        setMessage("Failed to initialize timetable page.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // load timetable whenever branch/semester changes
  useEffect(() => {
    async function load() {
      if (!branch || !semester) return;
      setLoading(true);
      try {
        const { data } = await supabase.from("timetables").select("schedule").eq("branch", branch).eq("semester", semester).maybeSingle();
        if (data?.schedule) {
          setSchedule(data.schedule);
        } else {
          // default empty schedule
          setSchedule({ Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] });
        }
      } catch (err) {
        console.error("load timetable err", err);
        setMessage("Unable to load timetable.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [branch, semester]);

  function addClass(day: string) {
    const time = prompt("Enter time (e.g., 09:00-10:00):", "09:00-10:00");
    if (!time) return;
    const subject = prompt("Subject name:");
    if (!subject) return;
    const location = prompt("Location (e.g., Room 101):", "");
    const newEntry: ClassEntry = { time, subject, faculty: faculty?.name ?? "", location: location || "" };
    setSchedule((prev) => ({ ...prev, [day]: [...(prev[day] || []), newEntry] }));
  }

  function editClass(day: string, index: number) {
    const entry = schedule[day][index];
    const time = prompt("Edit time:", entry.time) || entry.time;
    const subject = prompt("Edit subject:", entry.subject) || entry.subject;
    const location = prompt("Edit location:", entry.location || "") || entry.location;
    const newEntry = { ...entry, time, subject, location };
    setSchedule((prev) => {
      const arr = [...(prev[day] || [])];
      arr[index] = newEntry;
      return { ...prev, [day]: arr };
    });
  }

  function deleteClass(day: string, index: number) {
    if (!confirm("Delete this class?")) return;
    setSchedule((prev) => {
      const arr = [...(prev[day] || [])];
      arr.splice(index, 1);
      return { ...prev, [day]: arr };
    });
  }

  async function saveTimetable() {
    if (!branch || !semester) {
      setMessage("Select branch & semester");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      // upsert timetable doc
      const payload = { branch, semester, schedule, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("timetables").upsert([payload], { onConflict: "branch,semester" } );
      if (error) throw error;
      setMessage("Timetable saved.");
    } catch (err: any) {
      console.error("save timetable err", err);
      setMessage("Failed to save timetable: " + (err.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Loading timetable…</div>;

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <main className="p-6 bg-gray-50 min-h-screen space-y-4">
      <h1 className="text-2xl font-bold">Timetable Manager</h1>
      {message && <div className="text-sm text-red-600">{message}</div>}

      <div className="bg-white p-4 rounded shadow mb-4">
        <div className="flex gap-3">
          <input className="border p-2 rounded" placeholder="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
          <select className="border p-2 rounded" value={semester} onChange={(e) => setSemester(e.target.value)}>
            {["I","II","III","IV","V","VI","VII","VIII"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <button onClick={saveTimetable} className="bg-green-600 text-white px-3 py-1 rounded">Save Timetable</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {days.map((d) => (
          <div key={d} className="bg-white p-3 rounded shadow">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">{d}</h3>
              <button onClick={() => addClass(d)} className="text-sm bg-blue-600 text-white px-2 py-1 rounded">Add</button>
            </div>
            {(!schedule[d] || schedule[d].length === 0) ? <p className="text-sm text-gray-500">No classes</p> : (
              <ul className="space-y-2">
                {schedule[d].map((c, i) => (
                  <li key={i} className="border p-2 rounded flex justify-between items-start">
                    <div>
                      <div className="font-medium">{c.subject}</div>
                      <div className="text-sm text-gray-600">{c.time} • {c.location}</div>
                      <div className="text-xs text-gray-500">Faculty: {c.faculty}</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => editClass(d, i)} className="text-sm bg-yellow-400 px-2 py-1 rounded">Edit</button>
                      <button onClick={() => deleteClass(d, i)} className="text-sm bg-red-600 text-white px-2 py-1 rounded">Del</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
