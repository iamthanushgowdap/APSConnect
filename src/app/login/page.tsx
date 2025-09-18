// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);

    // check role and approved status in users
    const { data: userRow } = await supabase.from("users").select("role, status").eq("email", email).single();
    if (!userRow) return alert("User record not found.");
    if (userRow.role !== role) return alert("Role mismatch on login.");
    if (userRow.status && userRow.status !== "approved") return alert(`Your account is ${userRow.status}`);

    router.push("/");
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl mb-4">Login</h1>
      <form onSubmit={submit} className="space-y-2 max-w-md">
        <select value={role} onChange={(e) => setRole(e.target.value)} className="border p-2 rounded w-full">
          <option value="student">Student</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Admin</option>
        </select>
        <input className="border p-2 rounded w-full" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="border p-2 rounded w-full" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Login</button>
      </form>
    </main>
  );
}
