// src/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Sidebar() {
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) return;
      const { data } = await supabase.from("users").select("role, name").eq("auth_id", userId).single();
      setRole(data?.role || null);
      setName(data?.name || null);
    }
    load();
  }, []);

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 h-screen px-4 py-6 border-r hidden md:block">
      <div className="mb-6">
        <h1 className="text-lg font-bold">APSConnect</h1>
        {name && <p className="text-sm text-gray-500">Hi, {name}</p>}
      </div>

      <nav className="space-y-2">
        <Link href="/"><a className="block p-2 rounded hover:bg-gray-100">Home</a></Link>
        {role === "admin" && (
          <>
            <Link href="/admin/dashboard"><a className="block p-2 rounded hover:bg-gray-100">Dashboard</a></Link>
            <Link href="/admin/announcements"><a className="block p-2 rounded hover:bg-gray-100">Announcements</a></Link>
            <Link href="/admin/clubs"><a className="block p-2 rounded hover:bg-gray-100">Clubs</a></Link>
            <Link href="/admin/exams"><a className="block p-2 rounded hover:bg-gray-100">Exams</a></Link>
            <Link href="/admin/library"><a className="block p-2 rounded hover:bg-gray-100">Library</a></Link>
            <Link href="/admin/resumes"><a className="block p-2 rounded hover:bg-gray-100">Resumes</a></Link>
            <Link href="/admin/fundraisers"><a className="block p-2 rounded hover:bg-gray-100">Fundraisers</a></Link>
            <Link href="/admin/fees"><a className="block p-2 rounded hover:bg-gray-100">Fees</a></Link>
          </>
        )}
        {role === "faculty" && (
          <>
            <Link href="/faculty/dashboard"><a className="block p-2 rounded hover:bg-gray-100">Dashboard</a></Link>
            <Link href="/faculty/assignments"><a className="block p-2 rounded hover:bg-gray-100">Assignments</a></Link>
            <Link href="/faculty/clubs"><a className="block p-2 rounded hover:bg-gray-100">Clubs</a></Link>
            <Link href="/faculty/courses"><a className="block p-2 rounded hover:bg-gray-100">Courses</a></Link>
            <Link href="/faculty/results"><a className="block p-2 rounded hover:bg-gray-100">Results</a></Link>
            <Link href="/faculty/resumes"><a className="block p-2 rounded hover:bg-gray-100">Resumes</a></Link>
            <Link href="/faculty/zoom"><a className="block p-2 rounded hover:bg-gray-100">Zoom</a></Link>
          </>
        )}
        {role === "student" && (
          <>
            <Link href="/student/dashboard"><a className="block p-2 rounded hover:bg-gray-100">Dashboard</a></Link>
            <Link href="/student/assignments"><a className="block p-2 rounded hover:bg-gray-100">Assignments</a></Link>
            <Link href="/student/clubs"><a className="block p-2 rounded hover:bg-gray-100">Clubs</a></Link>
            <Link href="/student/contributions"><a className="block p-2 rounded hover:bg-gray-100">Contributions</a></Link>
            <Link href="/student/exams"><a className="block p-2 rounded hover:bg-gray-100">Exams</a></Link>
            <Link href="/student/library"><a className="block p-2 rounded hover:bg-gray-100">Library</a></Link>
            <Link href="/student/notifications"><a className="block p-2 rounded hover:bg-gray-100">Notifications</a></Link>
            <Link href="/student/results"><a className="block p-2 rounded hover:bg-gray-100">Results</a></Link>
            <Link href="/student/resume"><a className="block p-2 rounded hover:bg-gray-100">Resume</a></Link>
            <Link href="/student/scan"><a className="block p-2 rounded hover:bg-gray-100">Scan (QR)</a></Link>
            <Link href="/student/zoom"><a className="block p-2 rounded hover:bg-gray-100">Zoom</a></Link>
          </>
        )}

        <Link href="/alumni"><a className="block p-2 rounded hover:bg-gray-100">Alumni</a></Link>
        <Link href="/logout"><a className="block p-2 rounded hover:bg-gray-100">Logout</a></Link>
      </nav>
    </aside>
  );
}
