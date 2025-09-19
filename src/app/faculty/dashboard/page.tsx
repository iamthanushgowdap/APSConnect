"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function FacultyDashboardPage() {
  const [stats, setStats] = useState<any>({});
  const [students, setStudents] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any | null>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [zoomMeetings, setZoomMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [newAssignment, setNewAssignment] = useState({ title: "", description: "", due_date: "" });
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [newPoll, setNewPoll] = useState("");
  const [newZoom, setNewZoom] = useState({ title: "", date: "", start_time: "", link: "" });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      // Stats: count assigned students, pending approvals
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) return;

      const faculty = await supabase.from("users").select("*").eq("auth_id", user.user.id).single();
      const branch = faculty.data?.assigned_branch || faculty.data?.branch;
      const semester = faculty.data?.assigned_semester || faculty.data?.semester;

      // Students
      const { data: stud } = await supabase.from("users").select("*").eq("branch", branch).eq("semester", semester).eq("role", "student");
      setStudents(stud ?? []);

      // Pending
      const { data: pend } = await supabase.from("users").select("*").eq("branch", branch).eq("semester", semester).eq("status", "pending");
      setPending(pend ?? []);

      setStats({
        students: stud?.length ?? 0,
        pending: pend?.length ?? 0,
      });

      // Assignments
      const { data: ass } = await supabase.from("assignments").select("*").eq("branch", branch).eq("semester", semester).order("due_date");
      setAssignments(ass ?? []);

      // Attendance
      const { data: att } = await supabase.from("attendance").select("*").eq("branch", branch).eq("semester", semester);
      setAttendance(att ?? []);

      // Timetable
      const { data: tt } = await supabase.from("timetables").select("schedule").eq("branch", branch).eq("semester", semester).maybeSingle();
      setTimetable(tt?.schedule ?? null);

      // Resources
      const { data: res } = await supabase.from("resources").select("*").eq("branch", branch).eq("semester", semester);
      setResources(res ?? []);

      // Announcements
      const { data: ann } = await supabase.from("announcements").select("*").eq("branch", branch).eq("semester", semester).order("created_at", { ascending: false }).limit(5);
      setAnnouncements(ann ?? []);

      // Polls
      const { data: pol } = await supabase.from("polls").select("*").eq("branch", branch).eq("semester", semester);
      setPolls(pol ?? []);

      // Reports (simplified → attendance counts)
      setReports(att ?? []);

      // Zoom
      const { data: zoom } = await supabase.from("zoom_meetings").select("*").eq("faculty_id", faculty.data?.id);
      setZoomMeetings(zoom ?? []);

    } catch (err: any) {
      setMessage("Error loading: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createAssignment() {
    if (!newAssignment.title || !newAssignment.due_date) return;
    await supabase.from("assignments").insert([newAssignment]);
    setNewAssignment({ title: "", description: "", due_date: "" });
    load();
  }

  async function postAnnouncement() {
    if (!newAnnouncement.trim()) return;
    await supabase.from("announcements").insert([{ title: newAnnouncement }]);
    setNewAnnouncement("");
    load();
  }

  async function createPoll() {
    if (!newPoll.trim()) return;
    await supabase.from("polls").insert([{ question: newPoll }]);
    setNewPoll("");
    load();
  }

  async function scheduleZoom() {
    if (!newZoom.title || !newZoom.date) return;
    await supabase.from("zoom_meetings").insert([newZoom]);
    setNewZoom({ title: "", date: "", start_time: "", link: "" });
    load();
  }

  if (loading) return <p>Loading...</p>;

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">Faculty Dashboard</h1>

      {message && <div className="bg-red-100 text-red-800 p-3 rounded">{message}</div>}

      {/* Stats */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white shadow p-4 rounded">
          <h2 className="text-lg font-semibold">Assigned Students</h2>
          <p className="text-2xl font-bold">{stats.students}</p>
        </div>
        <div className="bg-white shadow p-4 rounded">
          <h2 className="text-lg font-semibold">Pending Approvals</h2>
          <p className="text-2xl font-bold">{stats.pending}</p>
        </div>
      </section>

      {/* Student Approvals */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Pending Student Approvals</h2>
        {pending.length === 0 ? <p>No pending students</p> : (
          <ul>
            {pending.map((p) => (
              <li key={p.id} className="border-b py-2 flex justify-between">
                {p.name} ({p.email})
                <div>
                  <button className="bg-green-600 text-white px-2 py-1 mr-2 rounded">Approve</button>
                  <button className="bg-red-600 text-white px-2 py-1 rounded">Reject</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Assignments */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Assignments</h2>
        <div className="flex space-x-2 mb-3">
          <input
            value={newAssignment.title}
            onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
            placeholder="Title"
            className="border p-2 rounded flex-1"
          />
          <input
            type="date"
            value={newAssignment.due_date}
            onChange={(e) => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
            className="border p-2 rounded"
          />
          <button onClick={createAssignment} className="bg-blue-600 text-white px-3 py-1 rounded">Create</button>
        </div>
        <ul>
          {assignments.map((a) => (
            <li key={a.id} className="border-b py-2">
              {a.title} — Due: {a.due_date}
            </li>
          ))}
        </ul>
      </section>

      {/* Attendance Chart */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Attendance Summary</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={attendance}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="subject" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="present" fill="#00C49F" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Timetable */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Timetable</h2>
        {timetable ? (
          <pre className="bg-gray-50 p-2 rounded">{JSON.stringify(timetable, null, 2)}</pre>
        ) : <p>No timetable uploaded</p>}
      </section>

      {/* Resources */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Shared Resources</h2>
        <ul>
          {resources.map((r) => (
            <li key={r.id} className="border-b py-1">
              {r.title} — <a href={r.file_url} className="text-blue-600 underline">Download</a>
            </li>
          ))}
        </ul>
      </section>

      {/* Announcements */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Announcements</h2>
        <div className="flex space-x-2 mb-3">
          <input value={newAnnouncement} onChange={(e) => setNewAnnouncement(e.target.value)} placeholder="New announcement..." className="border p-2 rounded flex-1" />
          <button onClick={postAnnouncement} className="bg-green-600 text-white px-3 py-1 rounded">Post</button>
        </div>
        <ul>
          {announcements.map((a) => (
            <li key={a.id} className="border-b py-1">{a.title}</li>
          ))}
        </ul>
      </section>

      {/* Polls */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Polls</h2>
        <div className="flex space-x-2 mb-3">
          <input value={newPoll} onChange={(e) => setNewPoll(e.target.value)} placeholder="New poll question" className="border p-2 rounded flex-1" />
          <button onClick={createPoll} className="bg-purple-600 text-white px-3 py-1 rounded">Create</button>
        </div>
        <ul>
          {polls.map((p) => (
            <li key={p.id} className="border-b py-1">{p.question}</li>
          ))}
        </ul>
      </section>

      {/* Zoom */}
      <section className="bg-white shadow p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Zoom Classes</h2>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input value={newZoom.title} onChange={(e) => setNewZoom({ ...newZoom, title: e.target.value })} placeholder="Meeting title" className="border p-2 rounded" />
          <input type="date" value={newZoom.date} onChange={(e) => setNewZoom({ ...newZoom, date: e.target.value })} className="border p-2 rounded" />
          <input type="time" value={newZoom.start_time} onChange={(e) => setNewZoom({ ...newZoom, start_time: e.target.value })} className="border p-2 rounded" />
          <input value={newZoom.link} onChange={(e) => setNewZoom({ ...newZoom, link: e.target.value })} placeholder="Zoom link" className="border p-2 rounded col-span-2" />
          <button onClick={scheduleZoom} className="bg-indigo-600 text-white px-3 py-1 rounded col-span-2">Schedule</button>
        </div>
        <ul>
          {zoomMeetings.map((z) => (
            <li key={z.id} className="border-b py-1">
              {z.title} — {z.date} at {z.start_time} → <a href={z.link} className="text-blue-600 underline">Join</a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
