import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

const SUPABASE_URL = "https://dlwypgzfoldhzajbnaxv.supabase.co"
const SUPABASE_KEY = "sb_publishable_jU_gprs9slrLe2o-GS1T-g_4kNreKy3"

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
