// src/app/student/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import { supabase } from "@/lib/supabaseClient";

type Student = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  branch?: string;
  semester?: string;
  education?: string;
  summary?: string;
  experience?: string;
  skills?: string[] | null;
  certifications?: string[] | null;
  volunteer?: string;
  achievements?: string[] | null;
  hobbies?: string;
  resume?: any;
  created_at?: string;
};

export default function StudentProfilePage() {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ceraReply, setCeraReply] = useState<string | null>(null); // placeholder for Cera.AI responses

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user?.id) {
          if (mounted) setMessage("Please log in to access your profile.");
          return;
        }
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("auth_id", auth.user.id)
          .single();

        if (error) {
          console.error("Profile load error:", error);
          if (mounted) setMessage("Unable to load profile.");
        } else {
          if (mounted) setStudent(data);
        }
      } catch (err: any) {
        console.error(err);
        if (mounted) setMessage("Unexpected error while loading profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return;
    setSaving(true);
    setMessage(null);

    try {
      // ensure fields are normalized
      const toUpdate = {
        phone: student.phone ?? null,
        education: student.education ?? null,
        summary: student.summary ?? null,
        experience: student.experience ?? null,
        skills: Array.isArray(student.skills) ? student.skills : (student.skills ? (student.skills as unknown as string).split(",").map((s) => s.trim()) : []),
        certifications: Array.isArray(student.certifications) ? student.certifications : (student.certifications ? (student.certifications as unknown as string).split(",").map((s) => s.trim()) : []),
        volunteer: student.volunteer ?? null,
        achievements: Array.isArray(student.achievements) ? student.achievements : (student.achievements ? (student.achievements as unknown as string).split(",").map((s) => s.trim()) : []),
        hobbies: student.hobbies ?? null
      };

      const { error } = await supabase.from("users").update(toUpdate).eq("id", student.id);
      if (error) {
        console.error("Save error", error);
        setMessage("❌ Failed to save profile: " + error.message);
      } else {
        setMessage("✅ Profile saved.");
      }
    } catch (err: any) {
      console.error(err);
      setMessage("❌ Unexpected error while saving.");
    } finally {
      setSaving(false);
    }
  }

  function downloadResumePdf() {
    if (!student) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const x = 40;
    let y = 50;
    doc.setFontSize(20);
    doc.text(student.name || "Student Name", x, y);
    y += 28;
    doc.setFontSize(11);
    doc.text(`Email: ${student.email || ""}`, x, y);
    y += 16;
    doc.text(`Phone: ${student.phone || ""}`, x, y);
    y += 24;

    if (student.summary) {
      doc.setFontSize(13);
      doc.text("Summary", x, y);
      y += 16;
      doc.setFontSize(11);
      doc.text(doc.splitTextToSize(student.summary, 500), x, y);
      y += 40;
    }

    if (student.education) {
      doc.setFontSize(13);
      doc.text("Education", x, y);
      y += 16;
      doc.setFontSize(11);
      doc.text(doc.splitTextToSize(student.education, 500), x, y);
      y += 40;
    }

    if (student.experience) {
      doc.setFontSize(13);
      doc.text("Experience", x, y);
      y += 16;
      doc.setFontSize(11);
      doc.text(doc.splitTextToSize(student.experience, 500), x, y);
      y += 40;
    }

    if (student.skills && student.skills.length > 0) {
      doc.setFontSize(13);
      doc.text("Skills", x, y);
      y += 16;
      doc.setFontSize(11);
      doc.text((student.skills || []).join(", "), x, y);
      y += 30;
    }

    if (student.certifications && student.certifications.length > 0) {
      doc.setFontSize(13);
      doc.text("Certifications", x, y);
      y += 16;
      doc.setFontSize(11);
      doc.text((student.certifications || []).join(", "), x, y);
      y += 30;
    }

    if (student.achievements && student.achievements.length > 0) {
      doc.setFontSize(13);
      doc.text("Achievements", x, y);
      y += 16;
      doc.setFontSize(11);
      (student.achievements || []).forEach((a) => {
        doc.text("• " + a, x, y);
        y += 14;
      });
      y += 10;
    }

    doc.save(`${(student.name || "resume").replace(/\s+/g, "_")}_resume.pdf`);
  }

  // Cera.AI hook - placeholder function to send content + receive reply
  async function askCera(prompt: string) {
    setCeraReply("Thinking...");
    // Placeholder: call your Genkit / Cera.AI flow here via API route
    // Example: POST /api/ai/ask with { prompt, userId }
    // For now simulate:
    setTimeout(() => setCeraReply("Cera.AI: (placeholder) I can generate your resume or fetch info from uploaded docs."), 700);
  }

  if (loading) return <div className="p-6">Loading profile…</div>;

  return (
    <main className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">My Profile & Resume</h1>

      {message && <div className="mb-4 text-sm">{message}</div>}

      {!student ? (
        <div className="bg-white p-4 rounded shadow">No profile found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <form onSubmit={saveProfile} className="md:col-span-2 bg-white p-4 rounded shadow space-y-3">
            <div>
              <label className="block text-sm font-medium">Phone</label>
              <input className="w-full border p-2 rounded" value={student.phone ?? ""} onChange={(e) => setStudent({ ...student, phone: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium">Summary / Objective</label>
              <textarea className="w-full border p-2 rounded" rows={4} value={student.summary ?? ""} onChange={(e) => setStudent({ ...student, summary: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium">Education</label>
              <textarea className="w-full border p-2 rounded" rows={3} value={student.education ?? ""} onChange={(e) => setStudent({ ...student, education: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium">Experience</label>
              <textarea className="w-full border p-2 rounded" rows={3} value={student.experience ?? ""} onChange={(e) => setStudent({ ...student, experience: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium">Skills (comma separated)</label>
              <input className="w-full border p-2 rounded" value={(student.skills || []).join(", ")} onChange={(e) => setStudent({ ...student, skills: e.target.value.split(",").map((s) => s.trim()) })} />
            </div>

            <div>
              <label className="block text-sm font-medium">Certifications (comma separated)</label>
              <input className="w-full border p-2 rounded" value={(student.certifications || []).join(", ")} onChange={(e) => setStudent({ ...student, certifications: e.target.value.split(",").map((s) => s.trim()) })} />
            </div>

            <div>
              <label className="block text-sm font-medium">Hobbies</label>
              <input className="w-full border p-2 rounded" value={student.hobbies ?? ""} onChange={(e) => setStudent({ ...student, hobbies: e.target.value })} />
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded">{saving ? "Saving..." : "Save Profile"}</button>
              <button type="button" onClick={downloadResumePdf} className="bg-green-600 text-white px-4 py-2 rounded">Download Resume PDF</button>
            </div>
          </form>

          <aside className="bg-white p-4 rounded shadow">
            <h2 className="font-semibold mb-2">Achievements</h2>
            {Array.isArray(student.achievements) && student.achievements.length > 0 ? (
              <ul className="space-y-1">
                {student.achievements!.map((a, i) => (
                  <li key={i} className="text-sm">• {a}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No achievements yet.</p>
            )}

            <div className="mt-4">
              <h3 className="font-semibold mb-2">Ask Cera.AI</h3>
              <input placeholder="e.g., Generate my resume" className="w-full border p-2 rounded mb-2" onKeyDown={(e) => { if (e.key === "Enter") askCera((e.target as HTMLInputElement).value); }} />
              <button onClick={() => askCera("Generate resume")} className="bg-indigo-600 text-white px-3 py-1 rounded">Ask Cera</button>
              {ceraReply && <p className="mt-3 text-sm text-gray-700">{ceraReply}</p>}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
