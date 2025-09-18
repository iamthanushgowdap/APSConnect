// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gzubkbevqwtehkqitlof.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dWJrYmV2cXd0ZWhrcWl0bG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDAzMzIsImV4cCI6MjA3MzYxNjMzMn0.A0amGq24V1ShJdNi2uS0mTkyqStR4mUCz8Arad__k5c";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
