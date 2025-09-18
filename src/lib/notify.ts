// src/lib/notify.ts
import { supabase } from "./supabaseClient";

export async function sendNotification(userId: string, title: string, message: string) {
  try {
    await supabase.from("notifications").insert([{ user_id: userId, title, message }]);
  } catch (err: any) {
    console.error("Notification error:", err.message || err);
  }
}
