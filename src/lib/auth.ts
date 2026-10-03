// ログイン状態と権限（管理者／従業員）をチェックする関数
import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** ログイン中ユーザーのプロフィール（未ログインなら null） */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return (data as Profile) ?? null;
}

/** 管理者でなければ管理者ログイン画面へ移動させる */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/admin/login");
  return profile;
}

/** 従業員でなければ従業員ログイン画面へ移動させる */
export async function requireEmployee(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "employee") redirect("/login");
  return profile;
}
