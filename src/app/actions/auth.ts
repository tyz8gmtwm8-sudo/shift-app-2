"use server";
// ログアウト処理
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(formData.get("to") === "admin" ? "/admin/login" : "/login");
}
