"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import jsPDF from "jspdf";

export default function StudentResume() {
  const [resume, setResume] = useState<any>(null);

  useEffect(() => {
    async function loadResume() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("name, usn, resume")
        .eq("auth_id", user.id)
        .single();
      setResume(data);
    }
    loadResume();
  }, []);

  function generatePDF() {
    if (!resume) return;
    const doc = new jsPDF();

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`${resume.name} (${resume.usn})`, 20, 20);

    // Summary
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Summary", 20, 35);
    doc.text(resume.resume.summary || "N/A", 20, 42, { maxWidth: 170 });

    // Education
    doc.setFont("helvetica", "bold");
    doc.text("Education", 20, 60);
    doc.setFont("helvetica", "normal");
    (resume.resume.education || []).forEach((edu: string, i: number) => {
      doc.text(`• ${edu}`, 25, 68 + i * 7);
    });

    // Skills
    doc.setFont("helvetica", "bold");
    doc.text("Skills", 20, 90);
    doc.setFont("helvetica", "normal");
    doc.text((resume.resume.skills || []).join(", "), 25, 98, { maxWidth: 170 });

    // Certifications
    doc.setFont("helvetica", "bold");
    doc.text("Certifications", 20, 115);
    doc.setFont("helvetica", "normal");
    (resume.resume.certifications || []).forEach((c: string, i: number) => {
      doc.text(`• ${c}`, 25, 123 + i * 7);
    });

    // Experience
    doc.setFont("helvetica", "bold");
    doc.text("Experience", 20, 145);
    doc.setFont("helvetica", "normal");
    (resume.resume.experience || []).forEach((exp: string, i: number) => {
      doc.text(`• ${exp}`, 25, 153 + i * 7);
    });

    // Awards
    doc.setFont("helvetica", "bold");
    doc.text("Awards", 20, 175);
    doc.setFont("helvetica", "normal");
    (resume.resume.awards || []).forEach((a: string, i: number) => {
      doc.text(`• ${a}`, 25, 183 + i * 7);
    });

    // Hobbies
    doc.setFont("helvetica", "bold");
    doc.text("Hobbies", 20, 205);
    doc.setFont("helvetica", "normal");
    doc.text((resume.resume.hobbies || []).join(", "), 25, 213, { maxWidth: 170 });

    doc.save(`${resume.name}_Resume.pdf`);
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">My Resume</h1>
      {resume ? (
        <button
          onClick={generatePDF}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Download PDF Resume
        </button>
      ) : (
        <p>Loading...</p>
      )}
    </main>
  );
}
