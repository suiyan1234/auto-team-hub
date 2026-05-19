// ============================================================
// Auto Team Hub - Supabase 统一数据层
// 路径: public/shared/js/supabaseDataLayer.js
// 供 admin/ 和 user/ 页面共用
// ============================================================

// 依赖: 页面需先加载 <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// 以及 shared/js/supabase.js (你的 Supabase 客户端初始化)

const DataLayer = {
    // ==================== 用户 / 档案 ====================
    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        return { ...user, profile: data };
    },

    async getAllProfiles() {
        const { data, error } = await supabase.from('profiles').select('*, departments(name)');
        if (error) throw error;
        return data;
    },

    async getProfile(userId) {
        const { data, error } = await supabase.from('profiles')
            .select('*, departments(name)')
            .eq('id', userId).single();
        if (error) throw error;
        return data;
    },

    async updateProfile(userId, updates) {
        const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select();
        if (error) throw error;
        return data;
    },

    async updateMyStatus(status, currentTask) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('未登录');
        return this.updateProfile(user.id, { status, current_task: currentTask, updated_at: new Date().toISOString() });
    },

    // ==================== 加班 ====================
    async createOvertime(record) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('未登录');
        const { data, error } = await supabase.from('overtime_records').insert({
            user_id: user.id,
            record_date: record.date,
            start_time: record.startTime,
            end_time: record.endTime,
            duration_hours: record.duration,
            type: record.type,
            content: record.content,
            status: '待确认'
        }).select();
        if (error) throw error;
        return data;
    },

    async getMyOvertime(month = null) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('未登录');
        let query = supabase.from('overtime_records').select('*').eq('user_id', user.id).order('record_date', { ascending: false });
        if (month) {
            query = query.gte('record_date', month + '-01').lt('record_date', month + '-32');
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getAllOvertime(month = null) {
        let query = supabase.from('overtime_records').select('*, profiles(name, department_id, departments(name))').order('record_date', { ascending: false });
        if (month) {
            query = query.gte('record_date', month + '-01').lt('record_date', month + '-32');
        }
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async confirmOvertime(recordId, confirm = true) {
        const { data: { user } } = await supabase.auth.getUser();
        const updates = confirm
            ? { status: '已确认', confirmed_at: new Date().toISOString(), confirmed_by: user.id }
            : { status: '已驳回', confirmed_at: new Date().toISOString(), confirmed_by: user.id };
        const { data, error } = await supabase.from('overtime_records').update(updates).eq('id', recordId).select();
        if (error) throw error;
        return data;
    },

    async getOvertimeStats(userId = null, year = new Date().getFullYear()) {
        let query = supabase.from('overtime_records').select('duration_hours, status');
        if (userId) query = query.eq('user_id', userId);
        query = query.gte('record_date', year + '-01-01').lte('record_date', year + '-12-31');
        const { data, error } = await query;
        if (error) throw error;
        const confirmed = data.filter(r => r.status === '已确认');
        return {
            total: data.reduce((s, r) => s + (parseFloat(r.duration_hours) || 0), 0),
            confirmed: confirmed.reduce((s, r) => s + (parseFloat(r.duration_hours) || 0), 0),
            count: data.length,
            confirmedCount: confirmed.length
        };
    },

    // ==================== 任务 / 项目 ====================
    async getMyTasks(status = null) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('未登录');
        let query = supabase.from('tasks').select('*, projects(name)').eq('assigned_to', user.id);
        if (status) query = query.eq('status', status);
        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getAllTasks() {
        const { data, error } = await supabase.from('tasks').select('*, projects(name), profiles(name)').order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async getAllProjects() {
        const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createTask(task) {
        const { data, error } = await supabase.from('tasks').insert(task).select();
        if (error) throw error;
        return data;
    },

    async updateTask(taskId, updates) {
        const { data, error } = await supabase.from('tasks').update(updates).eq('id', taskId).select();
        if (error) throw error;
        return data;
    },

    async updateTaskProgress(taskId, completedCases, automatedCases) {
        const task = await this.getTaskById(taskId);
        const status = completedCases >= task.total_cases ? '已完成' : (completedCases > 0 ? '进行中' : '待处理');
        return this.updateTask(taskId, { completed_cases: completedCases, automated_cases: automatedCases, status });
    },

    async getTaskById(taskId) {
        const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).single();
        if (error) throw error;
        return data;
    },

    async getProjectStats() {
        const { data: projects, error } = await supabase.from('projects').select('*');
        if (error) throw error;
        const totalCases = projects.reduce((s, p) => s + (p.total_cases || 0), 0);
        const completedCases = projects.reduce((s, p) => s + (p.completed_cases || 0), 0);
        const automatedCases = projects.reduce((s, p) => s + (p.automated_cases || 0), 0);
        return {
            totalProjects: projects.length,
            totalCases,
            completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
            automationRate: totalCases > 0 ? Math.round((automatedCases / totalCases) * 100) : 0
        };
    },

    // ==================== 物料 ====================
    async getAllInventory() {
        const { data, error } = await supabase.from('inventory_items').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createInventoryItem(item) {
        const { data, error } = await supabase.from('inventory_items').insert(item).select();
        if (error) throw error;
        return data;
    },

    async updateInventoryItem(itemId, updates) {
        const { data, error } = await supabase.from('inventory_items').update(updates).eq('id', itemId).select();
        if (error) throw error;
        return data;
    },

    async borrowItem(itemId, expectedReturn) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('未登录');
        const { data, error } = await supabase.from('inventory_borrowings').insert({
            item_id: itemId,
            user_id: user.id,
            expected_return: expectedReturn,
            status: '审批中'
        }).select();
        if (error) throw error;
        // 更新库存状态
        await supabase.from('inventory_items').update({ status: '审批中' }).eq('id', itemId);
        return data;
    },

    async getMyBorrowings() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('未登录');
        const { data, error } = await supabase.from('inventory_borrowings')
            .select('*, inventory_items(name, serial_number)')
            .eq('user_id', user.id)
            .order('borrowed_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async getAllBorrowings() {
        const { data, error } = await supabase.from('inventory_borrowings')
            .select('*, inventory_items(name, serial_number), profiles(name)')
            .order('borrowed_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async approveBorrowing(borrowingId, approve = true) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: borrowing } = await supabase.from('inventory_borrowings').select('*').eq('id', borrowingId).single();
        if (approve) {
            await supabase.from('inventory_borrowings').update({
                status: '使用中', approved_by: user.id, approved_at: new Date().toISOString()
            }).eq('id', borrowingId);
            await supabase.from('inventory_items').update({ status: '借出', borrowed: borrowing.item_id }).eq('id', borrowing.item_id);
        } else {
            await supabase.from('inventory_borrowings').update({
                status: '已驳回', approved_by: user.id, approved_at: new Date().toISOString()
            }).eq('id', borrowingId);
            await supabase.from('inventory_items').update({ status: '在库' }).eq('id', borrowing.item_id);
        }
        return { success: true };
    },

    async returnItem(borrowingId) {
        const { data: borrowing } = await supabase.from('inventory_borrowings').select('*').eq('id', borrowingId).single();
        await supabase.from('inventory_borrowings').update({
            status: '已归还', returned_at: new Date().toISOString()
        }).eq('id', borrowingId);
        await supabase.from('inventory_items').update({ status: '在库' }).eq('id', borrowing.item_id);
        return { success: true };
    },

    // ==================== 培训 ====================
    async getAllTrainings() {
        const { data, error } = await supabase.from('trainings').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createTraining(training) {
        const { data, error } = await supabase.from('trainings').insert(training).select();
        if (error) throw error;
        return data;
    },

    async getTrainingStats() {
        const { data: trainings } = await supabase.from('trainings').select('*');
        const { data: completions } = await supabase.from('training_completions').select('*, profiles(name)');
        return trainings.map(t => {
            const completed = completions.filter(c => c.training_id === t.id);
            const requiredCount = t.required_for?.length || 0;
            return {
                ...t,
                completedCount: completed.length,
                requiredCount,
                completionRate: requiredCount > 0 ? Math.round((completed.length / requiredCount) * 100) : 0,
                completedUsers: completed
            };
        });
    },

    async completeTraining(trainingId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('未登录');
        const { data, error } = await supabase.from('training_completions').insert({
            training_id: trainingId, user_id: user.id
        }).select();
        if (error && error.code === '23505') throw new Error('已完成该培训');
        if (error) throw error;
        return data;
    },

    // ==================== 动态 / 活动 ====================
    async addActivity(type, content) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.from('activities').insert({
            user_id: user?.id || null, type, content
        }).select();
        if (error) throw error;
        return data;
    },

    async getRecentActivities(limit = 20) {
        const { data, error } = await supabase.from('activities')
            .select('*, profiles(name)')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data;
    },

    // ==================== 实时订阅 ====================
    subscribeToTable(table, callback, filter = null) {
        let channel = supabase.channel(table + '_changes');
        channel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: table,
            filter: filter
        }, (payload) => {
            callback(payload);
        }).subscribe();
        return channel;
    },

    subscribeToMyTasks(callback) {
        return this.subscribeToTable('tasks', callback);
    },

    subscribeToOvertime(callback) {
        return this.subscribeToTable('overtime_records', callback);
    },

    subscribeToInventory(callback) {
        return this.subscribeToTable('inventory_borrowings', callback);
    }
};

// 挂载到全局
window.DataLayer = DataLayer;
