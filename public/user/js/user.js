/**
 * UserApp - 用户端应用逻辑
 */

class UserApp {
    constructor() {
        this.currentUser = null;
        this.tasks = [];
        this.overtimeRecords = [];
        this.chart = null;
        this.currentPeriod = 'week';
        this.currentSection = 'dashboard';
        
        this.init();
    }

    async init() {
        try {
            // 1. 先检查认证
            await this.checkAuth();
            
            // 2. ✅ 关键：使用共享侧边栏组件（确保 SidebarComponent 已加载）
            if (typeof SidebarComponent !== 'undefined') {
                SidebarComponent.render('sidebar', 'user');
                console.log('Sidebar rendered successfully'); // 调试用
            } else {
                console.error('SidebarComponent not found!'); // 调试用
            }
            
            // 3. 初始化头部
            this.initHeader();
            
            // 4. 加载数据
            await this.loadUserData();
            
            // 5. 初始化图表
            this.initChart();
            
            // 6. 设置事件监听
            this.setupEventListeners();
            
            // 7. 显示默认页面
            this.showSection('dashboard');
            
        } catch (error) {
            console.error('Init error:', error);
        }
    }

    async checkAuth() {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
            window.location.href = '../../index.html'; // ✅ 修正路径到根目录登录页
            return;
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (userError || !user) {
            console.error('Failed to load user:', userError);
            return;
        }

        this.currentUser = user;
        
        // 管理员重定向
        if (user.role === 'admin') {
            window.location.href = '../admin/index.html';
            return;
        }
    }

    // ✅ 已删除：initSidebar() 方法

    initHeader() {
        const header = document.getElementById('header');
        const titles = {
            'dashboard': '个人仪表板',
            'tasks': '我的任务',
            'overtime': '加班记录',
            'profile': '个人信息'
        };
        
        header.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800">${titles[this.currentSection || 'dashboard']}</h2>
            <div class="flex items-center gap-4">
                <span class="text-sm text-gray-500" id="current-time"></span>
                <button onclick="userApp.refreshData()" class="p-2 rounded-lg hover:bg-gray-100" title="刷新数据">
                    <i class="fas fa-sync-alt text-gray-600"></i>
                </button>
                <div class="flex items-center gap-3 pl-4 border-l">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-sm font-bold">
                        ${this.currentUser?.name?.charAt(0) || 'U'}
                    </div>
                    <span class="text-sm font-medium">${this.currentUser?.name || '用户'}</span>
                </div>
            </div>
        `;

        this.updateTime();
        setInterval(() => this.updateTime(), 60000);
    }

    updateTime() {
        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN', { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const el = document.getElementById('current-time');
        if (el) el.textContent = timeStr;
    }

    async loadUserData() {
        if (!this.currentUser) return;

        // 加载任务
        const { data: tasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('assigned_to', this.currentUser.id)
            .order('created_at', { ascending: false });

        this.tasks = tasks || [];

        // 加载加班记录
        const { data: records } = await supabase
            .from('overtime_records')
            .select('*')
            .eq('user_id', this.currentUser.id)
            .order('date', { ascending: false });

        this.overtimeRecords = records || [];

        // 更新UI
        this.updateDashboard();
        this.renderTasks();
        this.renderOvertimeTable();
        this.loadProfile();
    }

    updateDashboard() {
        if (!this.currentUser) return;

        const monthOT = this.calculateMonthOT();
        const completedTasks = this.tasks.filter(t => t.status === 'completed').length;
        const totalTasks = this.tasks.length;
        const autoCases = this.tasks.reduce((sum, t) => sum + (t.automated_cases || 0), 0);
        
        document.getElementById('user-month-ot').textContent = monthOT + 'h';
        document.getElementById('user-ot-progress').style.width = Math.min((monthOT / 40) * 100, 100) + '%';
        document.getElementById('user-tasks-completed').textContent = `${completedTasks}/${totalTasks}`;
        document.getElementById('user-task-rate').textContent = totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) + '%' : '0%';
        document.getElementById('user-auto-cases').textContent = autoCases;
        document.getElementById('user-status').textContent = this.getStatusLabel(this.currentUser.status);
        document.getElementById('user-current-task').textContent = this.currentUser.current_task || '无进行任务';

        this.updateChart();
        this.updateRecentActivity();
    }

    calculateMonthOT() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        return this.overtimeRecords
            .filter(r => new Date(r.date) >= monthStart)
            .reduce((sum, r) => sum + (r.hours || 0), 0);
    }

    getStatusLabel(status) {
        const labels = { 'idle': '空闲', 'busy': '忙碌', 'leave': '请假', 'wfh': '远程办公' };
        return labels[status] || '空闲';
    }

    initChart() {
        const ctx = document.getElementById('personalOvertimeChart')?.getContext('2d');
        if (!ctx) return;
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '加班时长',
                    data: [],
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    updateChart() {
        if (!this.chart) return;
        // ... 原有代码 ...
    }

    changePeriod(period) {
        this.currentPeriod = period;
        // ... 原有代码 ...
        this.updateChart();
    }

    updateRecentActivity() {
        // ... 原有代码 ...
    }

    getTaskStatusLabel(status) {
        const labels = { 'pending': '待处理', 'progress': '进行中', 'completed': '已完成', 'blocked': '阻塞中' };
        return labels[status] || status;
    }

    formatTime(timeStr) {
        // ... 原有代码 ...
    }

    renderTasks() {
        // ... 原有代码 ...
    }

    getTaskStatusClass(status) {
        // ... 原有代码 ...
    }

    filterTasks() {
        this.renderTasks();
    }

    openTaskModal(taskId) {
        // ... 原有代码 ...
    }

    closeTaskModal() {
        // ... 原有代码 ...
    }

    async updateTask() {
        // ... 原有代码 ...
    }

    renderOvertimeTable() {
        // ... 原有代码 ...
    }

    async addOvertimeRecord() {
        // ... 原有代码 ...
    }

    loadProfile() {
        // ... 原有代码 ...
    }

    renderSkills() {
        // ... 原有代码 ...
    }

    async updateStatus() {
        // ... 原有代码 ...
    }

    async updateCurrentTask() {
        // ... 原有代码 ...
    }

    async addSkill() {
        // ... 原有代码 ...
    }

    async removeSkill(skill) {
        // ... 原有代码 ...
    }

    showSection(section) {
        this.currentSection = section;
        
        document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
        document.getElementById('section-' + section)?.classList.remove('hidden');
        
        // 更新侧边栏激活状态
        if (typeof SidebarComponent !== 'undefined') {
            SidebarComponent.setActive(section);
        }
        
        // 更新头部标题
        const titles = {
            'dashboard': '个人仪表板',
            'tasks': '我的任务',
            'overtime': '加班记录',
            'profile': '个人信息'
        };
        
        const titleEl = document.querySelector('#header h2');
        if (titleEl) titleEl.textContent = titles[section];

        // 刷新数据
        if (section === 'dashboard') this.updateDashboard();
        else if (section === 'tasks') this.renderTasks();
        else if (section === 'overtime') this.renderOvertimeTable();
    }

    setupEventListeners() {
        // ... 原有代码 ...
    }

    async refreshData() {
        const btn = document.querySelector('.fa-sync-alt');
        btn?.classList.add('fa-spin');
        await this.loadUserData();
        setTimeout(() => btn?.classList.remove('fa-spin'), 500);
    }

    // ✅ 已删除：logout() 方法，现在使用 SidebarComponent.logout()
}

window.UserApp = window.UserApp || UserApp;
