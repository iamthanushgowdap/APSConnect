// src/app/student/notifications/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Notif = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read?: boolean;
  created_at?: string;
};

export default function StudentNotifications() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageSize] = useState(50);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) {
          if (mounted) setError("Please login.");
          return;
        }
        const { data: userRow } = await supabase.from("users").select("id").eq("auth_id", auth.user.id).single();
        if (!userRow?.id) {
          if (mounted) setError("Student record not found.");
          return;
        }
        if (mounted) setStudentId(userRow.id);
        const { data } = await supabase.from("notifications").select("*").eq("user_id", userRow.id).order("created_at", { ascending: false }).limit(pageSize);
        if (mounted) setNotifs(data || []);
      } catch (err: any) {
        console.error(err);
        if (mounted) setError("Failed to load notifications.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();

    // realtime insertions
    const channel = supabase
  .channel("notifications-client")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "notifications" },
    (payload) => {
      const newNotif = payload.new as Notif;
      if (newNotif.user_id === studentId) {
        setNotifs((p) => [newNotif, ...p]);
      }
    }
  )
  .subscribe();


    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [studentId, pageSize]);

  async function markRead(id: string) {
    try {
      await supabase.from("notifications").update({ read: true }).eq("id", id);
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      console.error(err);
      setError("Failed to mark read.");
    }
  }

  async function markAllRead() {
    if (!studentId) return;
    try {
      await supabase.from("notifications").update({ read: true }).eq("user_id", studentId);
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
      setError("Failed to mark all read.");
    }
  }

  if (loading) return <div className="p-6">Loading notifications…</div>;

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div>
          <button onClick={markAllRead} className="bg-blue-600 text-white px-3 py-1 rounded">Mark all read</button>
        </div>
      </div>

      {error && <div className="mb-4 text-red-600">{error}</div>}

      {notifs.length === 0 ? (
        <p>No notifications.</p>
      ) : (
        <ul className="space-y-3">
          {notifs.map((n) => (
            <li key={n.id} className={`p-4 rounded shadow bg-white ${n.read ? "opacity-70" : ""}`}>
              <div className="flex justify-between">
                <div>
                  <h3 className="font-semibold">{n.title}</h3>
                  <p className="text-sm text-gray-700">{n.message}</p>
                  <small className="text-xs text-gray-500">{new Date(n.created_at || "").toLocaleString()}</small>
                </div>
                <div className="flex flex-col items-end">
                  {!n.read && <button onClick={() => markRead(n.id)} className="text-blue-600 text-sm">Mark read</button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
