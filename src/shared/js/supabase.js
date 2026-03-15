/**
 * Auto Team Hub - Supabase客户端配置
 * 所有数据库操作都通过这里
 */

// 从config读取配置
const { supabase: supabaseConfig } = window.AppConfig || {
    supabase: {
        url: 'https://dlwypgzfoldhzajbnaxv.supabase.co',
        anonKey: 'sb_publishable_jU_gprs9slrLe2o-GS1T-g_4kNreKy3'
    }
};

// 初始化Supabase客户端
const supabase = supabase.createClient(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        },
        realtime: {
            timeout: 20000
        }
    }
);

// 当前用户缓存
let currentUser = null;
let currentPersonnel = null;
let currentRole = null;

// 认证模块
const AuthAPI = {
    // 登录
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        // 获取用户角色和人员信息
        await this.loadUserInfo();
        
        return data;
    },

    // 注册（仅管理员可用）
    async signUp(email, password, userData = {}) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: userData
            }
        });
        
        if (error) throw error;
        return data;
    },

    // 登出
    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        currentPersonnel = null;
        currentRole = null;
        
        return true;
    },

    // 获取当前用户
    async getUser() {
        if (currentUser) return currentUser;
        
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user;
        return user;
    },

    // 加载用户完整信息（角色+人员）
    async loadUserInfo() {
        const user = await this.getUser();
        if (!user) return null;

        // 获取角色
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('role, personnel_id')
            .eq('id', user.id)
            .single();

        if (profile) {
            currentRole = profile.role;
            
            // 获取人员信息
            if (profile.personnel_id) {
                const { data: personnel } = await supabase
                    .from('personnel')
                    .select('*')
                    .eq('id', profile.personnel_id)
                    .single();
                
                currentPersonnel = personnel;
            }
        }

        return {
            user,
            role: currentRole,
            personnel: currentPersonnel
        };
    },

    // 获取角色
    getRole() {
        return currentRole;
    },

    // 获取人员信息
    getPersonnel() {
        return currentPersonnel;
    },

    // 检查权限
    hasRole(roles) {
        if (!currentRole) return false;
        if (typeof roles === 'string') return currentRole === roles;
        return roles.includes(currentRole);
    },

    // 监听认证状态
    onAuthStateChange(callback) {
        return supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                this.loadUserInfo().then(() => callback('SIGNED_IN', session));
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                currentPersonnel = null;
                currentRole = null;
                callback('SIGNED_OUT', null);
            } else {
                callback(event, session);
            }
        });
    }
};

// 通用CRUD操作
const BaseAPI = {
    // 查询
    async select(table, options = {}) {
        let query = supabase.from(table).select(options.columns || '*');

        if (options.eq) {
            Object.entries(options.eq).forEach(([key, value]) => {
                query = query.eq(key, value);
            });
        }

        if (options.neq) {
            Object.entries(options.neq).forEach(([key, value]) => {
                query = query.neq(key, value);
            });
        }

        if (options.in) {
            Object.entries(options.in).forEach(([key, values]) => {
                query = query.in(key, values);
            });
        }

        if (options.order) {
            query = query.order(options.order.column, {
                ascending: options.order.ascending !== false
            });
        }

        if (options.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // 插入
    async insert(table, data) {
        const { data: result, error } = await supabase
            .from(table)
            .insert(Array.isArray(data) ? data : [data])
            .select();
        
        if (error) throw error;
        return result;
    },

    // 更新
    async update(table, id, data, idColumn = 'id') {
        const { data: result, error } = await supabase
            .from(table)
            .update(data)
            .eq(idColumn, id)
            .select();
        
        if (error) throw error;
        return result;
    },

    // 删除
    async delete(table, id, idColumn = 'id') {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq(idColumn, id);
        
        if (error) throw error;
        return true;
    },

    // RPC调用
    async rpc(functionName, params = {}) {
        const { data, error } = await supabase.rpc(functionName, params);
        if (error) throw error;
        return data;
    }
};

// 业务API（按模块分组）
const API = {
    // 认证
    auth: AuthAPI,

    // 人员管理
    personnel: {
        // 获取所有（管理员）
        getAll: () => BaseAPI.select('personnel', { order: { column: 'created_at', ascending: false } }),
        
        // 获取单个
        getById: (id) => BaseAPI.select('personnel', { eq: { id }, limit: 1 }).then(r => r[0]),
        
        // 创建
        create: (data) => BaseAPI.insert('personnel', data),
        
        // 更新
        update: (id, data) => BaseAPI.update('personnel', id, data),
        
        // 删除
        delete: (id) => BaseAPI.delete('personnel', id),
        
        // 批量导入
        batchImport: (data) => BaseAPI.rpc('batch_import_personnel', { personnel_data: JSON.stringify(data) }),
        
        // 获取自己（用户端）
        getMe: async () => {
            const personnel = AuthAPI.getPersonnel();
            if (personnel) return personnel;
            
            const user = await AuthAPI.getUser();
            const { data } = await supabase
                .from('personnel')
                .select('*')
                .eq('user_id', user.id)
                .single();
            
            currentPersonnel = data;
            return data;
        },
        
        // 更新自己
        updateMe: (data) => {
            const personnel = AuthAPI.getPersonnel();
            return BaseAPI.update('personnel', personnel.id, data);
        }
    },

    // 设备管理
    equipment: {
        getAll: () => BaseAPI.select('equipment', { order: { column: 'name' } }),
        getById: (id) => BaseAPI.select('equipment', { eq: { id }, limit: 1 }).then(r => r[0]),
        create: (data) => BaseAPI.insert('equipment', data),
        update: (id, data) => BaseAPI.update('equipment', id, data),
        delete: (id) => BaseAPI.delete('equipment', id),
        
        // 预约
        requestBooking: (data) => BaseAPI.insert('equipment_bookings', data)
    },

    // Test Case管理
    cases: {
        getAll: () => supabase.from('cases').select('*, assignee:personnel(name)'),
        getById: (id) => BaseAPI.select('cases', { eq: { id }, limit: 1 }).then(r => r[0]),
        create: (data) => BaseAPI.insert('cases', data),
        update: (id, data) => BaseAPI.update('cases', id, data, 'id'),
        delete: (id) => BaseAPI.delete('cases', id, 'id'),
        
        // 获取统计（按类型）
        getStatsByType: async () => {
            const { data } = await supabase.from('cases').select('type, automation_progress, status');
            const stats = {};
            
            ['software', 'hardware', 'automation', 'robotics'].forEach(type => {
                const items = data?.filter(c => c.type === type) || [];
                stats[type] = {
                    total: items.length,
                    avgAuto: items.length ? Math.round(items.reduce((a, b) => a + (b.automation_progress || 0), 0) / items.length) : 0,
                    done: items.filter(c => c.status === 'done').length,
                    progress: items.filter(c => c.status === 'progress').length,
                    todo: items.filter(c => c.status === 'todo').length
                };
            });
            
            return stats;
        },
        
        // 我的Cases（用户端）
        getMine: (personnelId) => BaseAPI.select('cases', { 
            eq: { assignee_id: personnelId },
            order: { column: 'created_at', ascending: false }
        }),
        
        // 更新进度（用户端）
        updateProgress: (id, progress) => {
            const status = progress >= 100 ? 'done' : 'progress';
            return BaseAPI.update('cases', id, { progress, status, completed_at: progress >= 100 ? new Date().toISOString() : null }, 'id');
        }
    },

    // 加班管理
    overtime: {
        // 录入（用户端）
        add: (data) => BaseAPI.insert('overtime_records', data),
        
        // 我的记录（用户端）
        getMine: (personnelId) => BaseAPI.select('overtime_records', {
            eq: { user_id: personnelId },
            order: { column: 'date', ascending: false }
        }),
        
        // 所有记录（管理员）
        getAll: () => supabase.from('overtime_records').select('*, personnel(name)'),
        
        // 部门统计（管理员）
        getStats: (params = {}) => BaseAPI.rpc('get_overtime_stats', params)
    },

    // 物料管理
    inventory: {
        getAll: () => BaseAPI.select('inventory', { order: { column: 'name' } }),
        getById: (id) => BaseAPI.select('inventory', { eq: { id }, limit: 1 }).then(r => r[0]),
        create: (data) => BaseAPI.insert('inventory', data),
        update: (id, data) => BaseAPI.update('inventory', id, data),
        delete: (id) => BaseAPI.delete('inventory', id),
        
        // 调整库存
        adjust: (id, delta, reason = '库存调整') => 
            BaseAPI.rpc('adjust_inventory', { p_item_id: id, p_delta: delta, p_reason: reason }),
        
        // 申请物料（用户端）
        request: (data) => BaseAPI.insert('inventory_requests', data)
    },

    // 仪表盘统计
    dashboard: {
        getStats: () => BaseAPI.rpc('get_dashboard_stats')
    },

    // 预警
    alerts: {
        getAll: () => BaseAPI.select('alerts', { 
            eq: { is_read: false },
            order: { column: 'created_at', ascending: false }
        }),
        markRead: (id) => BaseAPI.update('alerts', id, { is_read: true, read_at: new Date().toISOString() }),
        markAllRead: () => supabase.rpc('mark_all_alerts_read')
    },

    // 实时订阅
    subscribe: (table, callback, filter = {}) => {
        const channel = supabase.channel(`${table}-changes`);
        
        const config = {
            event: '*',
            schema: 'public',
            table: table
        };
        
        if (filter.column && filter.value) {
            config.filter = `${filter.column}=eq.${filter.value}`;
        }
        
        channel.on('postgres_changes', config, (payload) => {
            callback(payload);
        });
        
        channel.subscribe();
        
        // 返回取消订阅函数
        return () => {
            supabase.removeChannel(channel);
        };
    },

    // 文件存储
    storage: {
        upload: (bucket, path, file) => supabase.storage.from(bucket).upload(path, file),
        download: (bucket, path) => supabase.storage.from(bucket).download(path),
        getUrl: (bucket, path) => supabase.storage.from(bucket).getPublicUrl(path)
    }
};

// 导出全局
window.supabaseClient = supabase;
window.API = API;
