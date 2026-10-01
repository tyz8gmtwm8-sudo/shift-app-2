// トップページ：ログイン状態に応じて行き先を振り分けます
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export default async function Home() {
  const profile = await getCurrentProfile();
  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role === "employee") redirect("/employee");
  redirect("/login");
}
