import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

const SUPABASE_URL = "你的SUPABASE_URL"
const SUPABASE_KEY = "你的SUPABASE_ANON_KEY"

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)


// 获取当前用户
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}


// 获取用户角色
export async function getUserRole() {

  const user = await getCurrentUser()

  if (!user) return null

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("id", user.id)
    .single()

  return data?.role
}
