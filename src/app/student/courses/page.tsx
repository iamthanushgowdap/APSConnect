// src/app/student/courses/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Course = {
  id: string;
  title: string;
  description?: string;
  created_at?: string;
};

type CourseProgress = {
  id?: string;
  course_id: string;
  student_id: string;
  completed?: boolean;
  completed_at?: string | null;
};

export default function StudentCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<CourseProgress[]>([]);
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function loadData() {
      try {
        setMessage("");
        // Load courses (all available)
        const { data: courseData, error: courseErr } = await supabase
          .from("courses")
          .select("*")
          .order("created_at", { ascending: false });

        if (courseErr) throw courseErr;
        setCourses(courseData ?? []);

        // Get logged in user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setMessage("Please login to see your courses.");
          return;
        }

        // Get student record (id + achievements)
        const { data: student, error: studentErr } = await supabase
          .from("users")
          .select("id, achievements")
          .eq("auth_id", user.id)
          .single();

        if (studentErr) {
          setMessage("Student record not found.");
          return;
        }
        if (!student) {
          setMessage("Student record not found.");
          return;
        }

        // Get progress for this student
        const { data: progData, error: progErr } = await supabase
          .from("course_progress")
          .select("*")
          .eq("student_id", student.id);

        if (progErr) {
          console.warn("Could not load progress:", progErr);
          setProgress([]);
        } else {
          setProgress(progData ?? []);
        }
      } catch (err: any) {
        console.error(err);
        setMessage("Error loading courses: " + (err.message ?? JSON.stringify(err)));
      }
    }

    loadData();

    // optional: realtime subscription to courses (uncomment if you want)
    // const channel = supabase
    //   .channel("courses-list")
    //   .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => loadData())
    //   .subscribe();
    // return () => supabase.removeChannel(channel);
  }, []);

  async function markCompleted(courseId: string) {
    setMessage("");
    setLoadingCourseId(courseId);

    try {
      // Ensure logged-in
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setMessage("You must be logged in to complete a course.");
        setLoadingCourseId(null);
        return;
      }

      // Get student record (id + achievements)
      const { data: student, error: studentErr } = await supabase
        .from("users")
        .select("id, achievements")
        .eq("auth_id", user.id)
        .single();

      if (studentErr || !student) {
        setMessage("Student record not found.");
        setLoadingCourseId(null);
        return;
      }

      // Check existing progress (course_id + student_id)
      const { data: existing, error: existingErr } = await supabase
        .from("course_progress")
        .select("*")
        .eq("course_id", courseId)
        .eq("student_id", student.id)
        .maybeSingle();

      if (existingErr) throw existingErr;

      if (existing && existing.id) {
        // Update existing record
        const { error: updErr } = await supabase
          .from("course_progress")
          .update({ completed: true, completed_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        // Insert new progress record
        const { error: insErr } = await supabase.from("course_progress").insert([
          {
            course_id: courseId,
            student_id: student.id,
            completed: true,
            completed_at: new Date().toISOString(),
          },
        ]);
        if (insErr) throw insErr;
      }

      // Get course title for a nice achievement entry
      const { data: course } = await supabase.from("courses").select("title").eq("id", courseId).single();
      const courseTitle = course?.title ?? `Course ${courseId}`;

      // Update achievements array on users table (avoid duplicates)
      const currentAchievements = Array.isArray(student.achievements) ? student.achievements : [];
      const achievementText = `Completed Course: ${courseTitle}`;

      if (!currentAchievements.includes(achievementText)) {
        const newAchievements = [...currentAchievements, achievementText];
        const { error: upUserErr } = await supabase.from("users").update({ achievements: newAchievements }).eq("id", student.id);
        if (upUserErr) throw upUserErr;
      }

      // Refresh local progress state for UI
      const { data: refreshedProg } = await supabase.from("course_progress").select("*").eq("student_id", student.id);
      setProgress(refreshedProg ?? []);

      setMessage("🎉 Course completed! Certificate ready for download and achievement added.");
    } catch (err: any) {
      console.error(err);
      setMessage("Error completing course: " + (err.message ?? JSON.stringify(err)));
    } finally {
      setLoadingCourseId(null);
    }
  }

  function isCompleted(courseId: string) {
    return progress.some((p) => p.course_id === courseId && p.completed);
  }

  function downloadCertificate(courseTitle: string) {
    const certText = `Certificate of Completion\n\nThis certifies that you successfully completed the course: ${courseTitle}\n\nAPSConnect`;
    const blob = new Blob([certText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${courseTitle}_certificate.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Skill Build Courses</h1>

      {message && <div className="mb-4 text-blue-600">{message}</div>}

      {courses.length === 0 ? (
        <p>No courses available.</p>
      ) : (
        <ul>
          {courses.map((c) => (
            <li key={c.id} className="border-b py-2 flex items-center justify-between">
              <div>
                <strong>{c.title}</strong> - <span className="text-sm text-gray-600">{c.description}</span>
              </div>

              <div>
                {isCompleted(c.id) ? (
                  <button
                    onClick={() => downloadCertificate(c.title)}
                    className="ml-2 bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Download Certificate
                  </button>
                ) : (
                  <button
                    onClick={() => markCompleted(c.id)}
                    disabled={loadingCourseId !== null}
                    className="ml-2 bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
                  >
                    {loadingCourseId === c.id ? "Saving..." : "Mark Completed"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}





