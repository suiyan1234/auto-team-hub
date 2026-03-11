// Supabase 客户端配置
const SUPABASE_URL = 'https://dlwypgzfoldhzajbnaxv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jU_gprs9slrLe2o-GS1T-g_4kNreKy3';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 角色常量
const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

// API 封装
const api = {
  // 认证
  auth: {
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    getUser: () => supabase.auth.getUser(),
    getSession: () => supabase.auth.getSession()
  },

  // 人员管理 (管理员)
  personnel: {
    getAll: () => supabase.from('personnel').select('*').order('created_at', { ascending: false }),
    getById: (id) => supabase.from('personnel').select('*').eq('id', id).single(),
    create: (data) => supabase.from('personnel').insert([data]),
    update: (id, data) => supabase.from('personnel').update(data).eq('id', id),
    delete: (id) => supabase.from('personnel').delete().eq('id', id),
    batchImport: (data) => supabase.from('personnel').insert(data)
  },

  // 用户端 - 仅查看和更新自己
  myProfile: {
    get: (userId) => supabase.from('personnel').select('*').eq('user_id', userId).single(),
    update: (userId, data) => supabase.from('personnel').update(data).eq('user_id', userId),
    updateOvertime: (userId, hours) => supabase.rpc('add_overtime', { p_user_id: userId, p_hours: hours })
  },

  // 设备管理 (管理员)
  equipment: {
    getAll: () => supabase.from('equipment').select('*'),
    create: (data) => supabase.from('equipment').insert([data]),
    update: (id, data) => supabase.from('equipment').update(data).eq('id', id),
    delete: (id) => supabase.from('equipment').delete().eq('id', id),
    updateUtilization: (id, utilization) => supabase.from('equipment').update({ utilization }).eq('id', id)
  },

  // 用户端 - 只读设备
  equipmentView: {
    getAll: () => supabase.from('equipment').select('id, name, type, status, user, utilization'),
    getAvailable: () => supabase.from('equipment').select('*').eq('status', 'idle'),
    requestBooking: (equipmentId, userId, startTime, endTime) => 
      supabase.from('equipment_bookings').insert([{ equipment_id: equipmentId, user_id: userId, start_time: startTime, end_time: endTime }])
  },

  // Test Case (管理员)
  cases: {
    getAll: () => supabase.from('cases').select('*, assignee:personnel(name)'),
    create: (data) => supabase.from('cases').insert([data]),
    update: (id, data) => supabase.from('cases').update(data).eq('id', id),
    delete: (id) => supabase.from('cases').delete().eq('id', id),
    assign: (caseId, userId) => supabase.from('cases').update({ assignee_id: userId }).eq('id', caseId)
  },

  // 用户端 - 我的Cases
  myCases: {
    get: (userId) => supabase.from('cases').select('*').eq('assignee_id', userId),
    updateProgress: (caseId, progress) => supabase.from('cases').update({ progress }).eq('id', caseId),
    complete: (caseId) => supabase.from('cases').update({ status: 'done', progress: 100 }).eq('id', caseId)
  },

  // 加班管理 (管理员查看全部，用户仅录入自己)
  overtime: {
    getAll: () => supabase.from('overtime_records').select('*, personnel(name)').order('date', { ascending: false }),
    getByUser: (userId) => supabase.from('overtime_records').select('*').eq('user_id', userId),
    add: (data) => supabase.from('overtime_records').insert([data]),
    getStats: () => supabase.rpc('get_overtime_stats')
  },

  // 物料管理 (管理员)
  inventory: {
    getAll: () => supabase.from('inventory').select('*'),
    adjustStock: (id, delta) => supabase.rpc('adjust_inventory', { p_item_id: id, p_delta: delta })
  },

  // 用户端 - 物料申请
  inventoryRequest: {
    request: (itemId, quantity, reason) => 
      supabase.from('inventory_requests').insert([{ item_id: itemId, quantity, reason }])
  },

  // 实时订阅
  subscribe: (table, callback) => {
    return supabase.channel(`${table}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();
  }
};
