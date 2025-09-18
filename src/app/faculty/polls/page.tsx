"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/**
 * Faculty Polls & Feedback
 * - Create poll (question + options)
 * - Target branch/semester
 * - Students vote once
 * - Realtime results
 * - Charts for analytics
 * - Export CSV
 */

type Poll = {
  id?: string;
  faculty_id: string;
  question: string;
  options: string[];
  branch?: string | null;
  semester?: string | null;
  active: boolean;
  created_at?: string;
};

type Response = {
  id?: string;
  poll_id: string;
  student_id: string;
  option: string;
  created_at?: string;
};

export default function FacultyPolls() {
  const [faculty, setFaculty] = useState<any>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Form state
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>([""]);
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

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
    async function fetchPolls() {
      const { data } = await supabase.from("polls").select("*").order("created_at", { ascending: false });
      setPolls(data || []);
    }
    fetchPolls();

    channelRef.current = supabase
      .channel("public:polls_responses")
      .on("postgres_changes", { event: "*", schema: "public", table: "responses" }, fetchPolls)
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  async function handleSave() {
    if (!question || options.length < 2) {
      setMessage("Enter question and at least 2 options");
      return;
    }
    const payload: Poll = {
      faculty_id: faculty.id,
      question,
      options,
      branch: branch || null,
      semester: semester || null,
      active: true,
    };

    if (editingId) {
      await supabase.from("polls").update(payload).eq("id", editingId);
      setMessage("Poll updated");
    } else {
      await supabase.from("polls").insert([payload]);
      setMessage("Poll created");
    }

    setQuestion("");
    setOptions([""]);
    setBranch("");
    setSemester("");
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete poll?")) return;
    await supabase.from("polls").delete().eq("id", id);
    setPolls(polls.filter((p) => p.id !== id));
  }

  async function handleClose(id: string) {
    await supabase.from("polls").update({ active: false }).eq("id", id);
    setMessage("Poll closed");
  }

  function exportCSV(poll: Poll) {
    const pollResponses = responses.filter((r) => r.poll_id === poll.id);
    const rows = [
      ["Poll Question", "Student ID", "Option", "Date"],
      ...pollResponses.map((r) => [poll.question, r.student_id, r.option, r.created_at]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poll_${poll.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function optionVotes(poll: Poll) {
    const pollResponses = responses.filter((r) => r.poll_id === poll.id);
    return poll.options.map((opt) => ({
      option: opt,
      count: pollResponses.filter((r) => r.option === opt).length,
    }));
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen space-y-6">
      <h1 className="text-2xl font-bold">Faculty Polls & Feedback</h1>
      {message && <div className="p-2 bg-yellow-200">{message}</div>}

      {/* New Poll */}
      <section className="bg-white p-4 rounded shadow space-y-3">
        <h2 className="font-semibold">Create Poll</h2>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Poll question" className="border p-2 rounded w-full" />
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={opt}
              onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
              placeholder={`Option ${i + 1}`}
              className="border p-2 rounded flex-1"
            />
            <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="bg-red-500 text-white px-2 rounded">X</button>
          </div>
        ))}
        <button onClick={() => setOptions([...options, ""])} className="bg-gray-300 px-3 py-1 rounded">+ Add Option</button>
        <div className="flex gap-2">
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className="border p-2 rounded">
            <option value="">All Branches</option>
            {faculty?.assigned_branches?.map((b: string) => <option key={b}>{b}</option>)}
          </select>
          <select value={semester} onChange={(e) => setSemester(e.target.value)} className="border p-2 rounded">
            <option value="">All Semesters</option>
            {faculty?.assigned_semesters?.map((s: string) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded">{editingId ? "Update Poll" : "Create Poll"}</button>
      </section>

      {/* Poll List */}
      <section className="bg-white p-4 rounded shadow space-y-3">
        <h2 className="font-semibold">My Polls</h2>
        {polls.length === 0 ? <p>No polls yet</p> : (
          <ul className="space-y-4">
            {polls.map((p) => (
              <li key={p.id} className="border p-3 rounded">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{p.question}</h3>
                    <div className="text-xs text-gray-600">Branch: {p.branch || "All"} • Sem: {p.semester || "All"} • {p.active ? "Active" : "Closed"}</div>
                  </div>
                  <div className="flex gap-2">
                    {p.active && <button onClick={() => handleClose(p.id!)} className="bg-yellow-400 px-2 py-1 rounded">Close</button>}
                    <button onClick={() => handleDelete(p.id!)} className="bg-red-600 text-white px-2 py-1 rounded">Delete</button>
                    <button onClick={() => exportCSV(p)} className="bg-gray-700 text-white px-2 py-1 rounded">Export</button>
                  </div>
                </div>

                {/* Chart */}
                <div style={{ width: "100%", height: 250 }} className="mt-3">
                  <ResponsiveContainer>
                    <BarChart data={optionVotes(p)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="option" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3182ce" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
