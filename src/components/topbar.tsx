// src/components/Topbar.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function Topbar() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user?.id) return;
      const { data: userRow } = await supabase.from("users").select("id").eq("auth_id", auth.user.id).single();
      if (!userRow?.id) return;
      const { data } = await supabase.from("notifications").select("id").eq("user_id", userRow.id).eq("read", false);
      if (!mounted) return;
      setUnread(data?.length || 0);
    }
    load();

    const channel = supabase
      .channel("notifications-count")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setUnread((u) => u + 1);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <header className="w-full bg-white dark:bg-slate-800 border-b p-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2">☰</button>
        <Link href="/"><a className="font-bold text-lg">APSConnect</a></Link>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/student/notifications">
          <a className="relative">
            🔔
            {unread > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1">
                {unread}
              </span>
            )}
          </a>
        </Link>
        <div className="w-8 h-8 bg-gray-200 rounded-full" />
      </div>
    </header>
  );
}
