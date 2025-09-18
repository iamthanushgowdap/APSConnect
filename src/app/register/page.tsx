// src/app/register/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Register() {
  const [name, setName] = useState("");
  const [usn, setUsn] = useState("");
  const [branch, setBranch] = useState("");
  const [semester, setSemester] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return alert(error.message);

    // create user row with pending status
    await supabase.from("users").insert([{
      name, usn, branch, semester, email, role: "student", status: "pending", auth_id: data.user?.id
    }]);

    alert("Registered. Wait for approval.");
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl mb-4">Student Register</h1>
      <form onSubmit={submit} className="max-w-md space-y-2">
        <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Name" className="border p-2 rounded w-full" />
        <input value={usn} onChange={(e)=>setUsn(e.target.value)} placeholder="USN e.g. 1AP23IS001" className="border p-2 rounded w-full" />
        <input value={branch} onChange={(e)=>setBranch(e.target.value)} placeholder="Branch" className="border p-2 rounded w-full" />
        <input value={semester} onChange={(e)=>setSemester(e.target.value)} placeholder="Semester (I..VIII)" className="border p-2 rounded w-full" />
        <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" className="border p-2 rounded w-full" />
        <input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" placeholder="Password" className="border p-2 rounded w-full" />
        <button className="bg-green-600 text-white px-4 py-2 rounded">Register</button>
      </form>
    </main>
  );
}
