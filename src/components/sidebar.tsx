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
      const { data } = await supabase
        .from("users")
        .select("role, name")
        .eq("auth_id", userId)
        .single();
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
        <Link href="/" className="block p-2 rounded hover:bg-gray-100">
          Home
        </Link>

        {role === "admin" && (
          <>
            <Link href="/admin/dashboard" className="block p-2 rounded hover:bg-gray-100">Dashboard</Link>
            <Link href="/admin/announcements" className="block p-2 rounded hover:bg-gray-100">Announcements</Link>
            <Link href="/admin/clubs" className="block p-2 rounded hover:bg-gray-100">Clubs</Link>
            <Link href="/admin/exams" className="block p-2 rounded hover:bg-gray-100">Exams</Link>
            <Link href="/admin/library" className="block p-2 rounded hover:bg-gray-100">Library</Link>
            <Link href="/admin/resumes" className="block p-2 rounded hover:bg-gray-100">Resumes</Link>
            <Link href="/admin/fundraisers" className="block p-2 rounded hover:bg-gray-100">Fundraisers</Link>
            <Link href="/admin/fees" className="block p-2 rounded hover:bg-gray-100">Fees</Link>
          </>
        )}

        {role === "faculty" && (
          <>
            <Link href="/faculty/dashboard" className="block p-2 rounded hover:bg-gray-100">Dashboard</Link>
            <Link href="/faculty/assignments" className="block p-2 rounded hover:bg-gray-100">Assignments</Link>
            <Link href="/faculty/clubs" className="block p-2 rounded hover:bg-gray-100">Clubs</Link>
            <Link href="/faculty/courses" className="block p-2 rounded hover:bg-gray-100">Courses</Link>
            <Link href="/faculty/results" className="block p-2 rounded hover:bg-gray-100">Results</Link>
            <Link href="/faculty/resumes" className="block p-2 rounded hover:bg-gray-100">Resumes</Link>
            <Link href="/faculty/zoom" className="block p-2 rounded hover:bg-gray-100">Zoom</Link>
          </>
        )}

        {role === "student" && (
          <>
            <Link href="/student/dashboard" className="block p-2 rounded hover:bg-gray-100">Dashboard</Link>
            <Link href="/student/assignments" className="block p-2 rounded hover:bg-gray-100">Assignments</Link>
            <Link href="/student/clubs" className="block p-2 rounded hover:bg-gray-100">Clubs</Link>
            <Link href="/student/contributions" className="block p-2 rounded hover:bg-gray-100">Contributions</Link>
            <Link href="/student/exams" className="block p-2 rounded hover:bg-gray-100">Exams</Link>
            <Link href="/student/library" className="block p-2 rounded hover:bg-gray-100">Library</Link>
            <Link href="/student/notifications" className="block p-2 rounded hover:bg-gray-100">Notifications</Link>
            <Link href="/student/results" className="block p-2 rounded hover:bg-gray-100">Results</Link>
            <Link href="/student/resume" className="block p-2 rounded hover:bg-gray-100">Resume</Link>
            <Link href="/student/scan" className="block p-2 rounded hover:bg-gray-100">Scan (QR)</Link>
            <Link href="/student/zoom" className="block p-2 rounded hover:bg-gray-100">Zoom</Link>
          </>
        )}

        <Link href="/alumni" className="block p-2 rounded hover:bg-gray-100">Alumni</Link>
        <Link href="/logout" className="block p-2 rounded hover:bg-gray-100">Logout</Link>
      </nav>
    </aside>
  );
}
