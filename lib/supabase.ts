import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://sdhniidvhqvzamqtaxcw.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkaG5paWR2aHF2emFtcXRheGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNTExMDMsImV4cCI6MjA5MzYyNzEwM30.80a3RioQ7MvZD-KdElsAYWOPFvPatlc0i2mnN73d4cc";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
