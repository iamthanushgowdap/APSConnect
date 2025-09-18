"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AlumniDirectory() {
  const [alumni, setAlumni] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");

  useEffect(() => {
    async function loadAlumni() {
      const { data } = await supabase
        .from("alumni")
        .select("*")
        .order("graduation_year", { ascending: false });
      setAlumni(data || []);
    }
    loadAlumni();
  }, []);

  const filtered = alumni.filter((a) => {
    return (
      (branch ? a.branch.toLowerCase().includes(branch.toLowerCase()) : true) &&
      (year ? a.graduation_year.toString() === year : true) &&
      (search
        ? `${a.name} ${a.company} ${a.job_title}`
            .toLowerCase()
            .includes(search.toLowerCase())
        : true)
    );
  });

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Alumni Directory</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded shadow mb-6 flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search by name, job, company..."
          className="border p-2 rounded flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="text"
          placeholder="Branch (e.g., CSE, ISE)"
          className="border p-2 rounded"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
        />
        <input
          type="number"
          placeholder="Graduation Year"
          className="border p-2 rounded"
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <p>No alumni found.</p>
      ) : (
        <ul>
          {filtered.map((a) => (
            <li key={a.id} className="bg-white p-4 rounded shadow mb-3">
              <h2 className="font-semibold">{a.name}</h2>
              <p>
                {a.job_title} at {a.company || "N/A"}
              </p>
              <p>
                {a.branch} — Class of {a.graduation_year}
              </p>
              <p className="text-sm text-gray-600">{a.email}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
