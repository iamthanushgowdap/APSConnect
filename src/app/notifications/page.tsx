"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function NotificationsPage() {
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", user.id)
        .single();

      setUser(userData);

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .or(`role_target.eq.${userData.role},role_target.eq.all`)
        .order("created_at", { ascending: false });

      setNotifications(data || []);
    }
    loadData();
  }, []);

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Notifications</h1>
      {notifications.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        <ul>
          {notifications.map((n) => (
            <li key={n.id} className="border-b py-2">
              <strong>{n.title}</strong> - {n.message}{" "}
              <span className="text-gray-500 text-sm">
                ({new Date(n.created_at).toLocaleString()})
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
