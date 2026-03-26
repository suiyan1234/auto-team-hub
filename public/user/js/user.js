/**
 * UserApp - 用户端应用逻辑
 * 职责：加载个人数据、操作自己的记录、图表渲染
 * 权限限制：只能操作user_id=自己的数据
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
        // 检查认证
        await this.checkAuth();
        
        // ✅ 使用共享侧边栏组件
        SidebarComponent.render('sidebar', 'user');
        
        // 初始化头部
        this.initHeader();
        
        // 加载用户数据
        await this.loadUserData();
        
        // 初始化图表
        this.initChart();
        
        // 设置事件监听
        this.setupEventListeners();
        
        // 默认显示仪表板
        this.showSection('dashboard');
    }

    async checkAuth() {
        // 检查是否登录
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
            window.location.href = '../auth/login.html';
            return;
        }

        // 获取用户资料
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
        
        // 验证角色（管理员重定向到管理端）
        if (user.role === 'admin') {
            window.location.href = '../admin/index.html';
            return;
        }
    }

    /**
     * ✅ 已删除：initSidebar() 方法
     * 现在使用 shared/components/sidebar.js 中的 SidebarComponent
     */

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
        const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .eq('assigned_to', this.currentUser.id)
            .order('created_at', { ascending: false });

        if (!tasksError) {
            this.tasks = tasks || [];
        }

        // 加载加班记录
        const { data: records, error: recordsError } = await supabase
            .from('overtime_records')
            .select('*')
            .eq('user_id', this.currentUser.id)
            .order('date', { ascending: false });

        if (!recordsError) {
            this.overtimeRecords = records || [];
        }

        // 更新UI
        this.updateDashboard();
        this.renderTasks();
        this.renderOvertimeTable();
        this.loadProfile();
    }

    updateDashboard() {
        if (!this.currentUser) return;

        // 统计数据
        const monthOT = this.calculateMonthOT();
        const completedTasks = this.tasks.filter(t => t.status === 'completed').length;
        const totalTasks = this.tasks.length;
        const autoCases = this.tasks.reduce((sum, t) => sum + (t.automated_cases || 0), 0);
        
        // 更新卡片
        document.getElementById('user-month-ot').textContent = monthOT + 'h';
        document.getElementById('user-ot-progress').style.width = Math.min((monthOT / 40) * 100, 100) + '%';
        document.getElementById('user-tasks-completed').textContent = `${completedTasks}/${totalTasks}`;
        document.getElementById('user-task-rate').textContent = totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) + '%' : '0%';
        document.getElementById('user-auto-cases').textContent = autoCases;
        document.getElementById('user-status').textContent = this.getStatusLabel(this.currentUser.status);
        document.getElementById('user-current-task').textContent = this.currentUser.current_task || '无进行任务';

        // 更新图表和活动
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
        const labels = {
            'idle': '空闲',
            'busy': '忙碌',
            'leave': '请假',
            'wfh': '远程办公'
        };
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
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        title: { display: true, text: '小时' }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    updateChart() {
        if (!this.chart) return;

        let labels = [];
        let data = [];
        
        if (this.currentPeriod === 'week') {
            // 最近7天
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                labels.push(d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
                
                const hours = this.overtimeRecords
                    .filter(r => new Date(r.date).toDateString() === d.toDateString())
                    .reduce((sum, r) => sum + (r.hours || 0), 0);
                data.push(hours);
            }
        } else if (this.currentPeriod === 'month') {
            // 最近4周
            for (let i = 3; i >= 0; i--) {
                const endDate = new Date();
                endDate.setDate(endDate.getDate() - (i * 7));
                const startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - 6);
                
                labels.push(`${startDate.getMonth()+1}/${startDate.getDate()}-${endDate.getMonth()+1}/${endDate.getDate()}`);
                
                const hours = this.overtimeRecords
                    .filter(r => {
                        const rDate = new Date(r.date);
                        return rDate >= startDate && rDate <= endDate;
                    })
                    .reduce((sum, r) => sum + (r.hours || 0), 0);
                data.push(hours);
            }
        } else {
            // 最近12个月
            for (let i = 11; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                labels.push(d.toLocaleDateString('zh-CN', { year: '2-digit', month: 'short' }));
                
                const hours = this.overtimeRecords
                    .filter(r => {
                        const rDate = new Date(r.date);
                        return rDate.getMonth() === d.getMonth() && rDate.getFullYear() === d.getFullYear();
                    })
                    .reduce((sum, r) => sum + (r.hours || 0), 0);
                data.push(hours);
            }
        }

        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.update();
    }

    changePeriod(period) {
        this.currentPeriod = period;
        
        // 更新按钮样式
        document.querySelectorAll('.period-btn').forEach(btn => {
            if (btn.dataset.period === period) {
                btn.classList.remove('hover:bg-gray-100');
                btn.classList.add('bg-blue-100', 'text-blue-600');
            } else {
                btn.classList.remove('bg-blue-100', 'text-blue-600');
                btn.classList.add('hover:bg-gray-100');
            }
        });
        
        this.updateChart();
    }

    updateRecentActivity() {
        const container = document.getElementById('recent-activity');
        const activities = [];
        
        // 添加最近任务
        this.tasks.slice(0, 3).forEach(t => {
            activities.push({
                type: 'task',
                text: `任务 "${t.title}" 状态更新为${this.getTaskStatusLabel(t.status)}`,
                time: t.updated_at,
                icon: 'fa-tasks',
                color: 'blue'
            });
        });
        
        // 添加最近加班记录
        this.overtimeRecords.slice(0, 3).forEach(r => {
            activities.push({
                type: 'overtime',
                text: `录入了 ${r.date} 的加班记录 (${r.hours}小时)`,
                time: r.created_at,
                icon: 'fa-clock',
                color: 'orange'
            });
        });
        
        // 按时间排序
        activities.sort((a, b) => new Date(b.time) - new Date(a.time));
        
        container.innerHTML = activities.slice(0, 5).map(act => `
            <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div class="w-8 h-8 rounded-full bg-${act.color}-100 flex items-center justify-center flex-shrink-0">
                    <i class="fas ${act.icon} text-${act.color}-600 text-sm"></i>
                </div>
                <div class="flex-1">
                    <p class="text-sm text-gray-800">${act.text}</p>
                    <p class="text-xs text-gray-500 mt-1">${this.formatTime(act.time)}</p>
                </div>
            </div>
        `).join('');
    }

    getTaskStatusLabel(status) {
        const labels = {
            'pending': '待处理',
            'progress': '进行中',
            'completed': '已完成',
            'blocked': '阻塞中'
        };
        return labels[status] || status;
    }

    formatTime(timeStr) {
        const date = new Date(timeStr);
        const now = new Date();
        const diff = (now - date) / 1000 / 60;
        
        if (diff < 60) return '刚刚';
        if (diff < 1440) return Math.floor(diff / 60) + '小时前';
        return date.toLocaleDateString('zh-CN');
    }

    renderTasks() {
        const container = document.getElementById('task-list');
        const filter = document.getElementById('task-status-filter')?.value;
        
        let filtered = this.tasks;
        if (filter) {
            filtered = this.tasks.filter(t => t.status === filter);
        }
        
        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-gray-400">
                    <i class="fas fa-clipboard-list text-4xl mb-3"></i>
                    <p>暂无任务</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filtered.map(task => `
            <div class="border rounded-lg p-4 hover:shadow-md transition-shadow ${task.status === 'completed' ? 'bg-gray-50' : 'bg-white'}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-semibold text-gray-800 ${task.status === 'completed' ? 'line-through text-gray-500' : ''}">${task.title}</h4>
                        <p class="text-sm text-gray-500 mt-1">${task.description || '无描述'}</p>
                    </div>
                    <span class="px-2 py-1 rounded-full text-xs ${this.getTaskStatusClass(task.status)}">
                        ${this.getTaskStatusLabel(task.status)}
                    </span>
                </div>
                
                <div class="mt-3">
                    <div class="flex justify-between text-sm mb-1">
                        <span class="text-gray-600">进度</span>
                        <span class="font-medium">${task.progress || 0}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full progress-bar" style="width: ${task.progress || 0}%"></div>
                    </div>
                </div>
                
                <div class="mt-3 flex justify-between items-center">
                    <div class="flex gap-4 text-xs text-gray-500">
                        <span><i class="fas fa-calendar-alt mr-1"></i>${task.due_date || '无截止日期'}</span>
                        <span><i class="fas fa-flag mr-1"></i>${task.priority || '普通'}</span>
                    </div>
                    <button onclick="userApp.openTaskModal(${task.id})" class="text-blue-600 hover:text-blue-800 text-sm">
                        <i class="fas fa-edit mr-1"></i>更新进度
                    </button>
                </div>
            </div>
        `).join('');
    }

    getTaskStatusClass(status) {
        const classes = {
            'pending': 'bg-gray-100 text-gray-800',
            'progress': 'bg-blue-100 text-blue-800',
            'completed': 'bg-green-100 text-green-800',
            'blocked': 'bg-red-100 text-red-800'
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    }

    filterTasks() {
        this.renderTasks();
    }

    openTaskModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-name-display').value = task.title;
        document.getElementById('task-progress').value = task.progress || 0;
        document.getElementById('progress-value').textContent = (task.progress || 0) + '%';
        document.getElementById('task-status').value = task.status || 'pending';
        document.getElementById('task-note').value = task.note || '';
        
        document.getElementById('task-modal').classList.remove('hidden');
        document.getElementById('task-modal').classList.add('flex');
    }

    closeTaskModal() {
        document.getElementById('task-modal').classList.add('hidden');
        document.getElementById('task-modal').classList.remove('flex');
    }

    async updateTask(formData) {
        const taskId = document.getElementById('task-id').value;
        
        const { error } = await supabase
            .from('tasks')
            .update({
                progress: parseInt(document.getElementById('task-progress').value),
                status: document.getElementById('task-status').value,
                note: document.getElementById('task-note').value,
                updated_at: new Date().toISOString()
            })
            .eq('id', taskId)
            .eq('assigned_to', this.currentUser.id);

        if (error) {
            alert('更新失败: ' + error.message);
            return;
        }

        this.closeTaskModal();
        await this.loadUserData();
        alert('任务更新成功');
    }

    renderOvertimeTable() {
        const tbody = document.getElementById('overtime-table');
        document.getElementById('ot-total-count').textContent = `共 ${this.overtimeRecords.length} 条记录`;
        
        if (this.overtimeRecords.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-gray-400">
                        <i class="fas fa-inbox text-3xl mb-2"></i>
                        <p>暂无加班记录</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.overtimeRecords.map(record => {
            const typeLabels = {
                'weekday': '工作日',
                'weekend': '周末',
                'holiday': '节假日'
            };
            const typeClasses = {
                'weekday': 'bg-blue-100 text-blue-800',
                'weekend': 'bg-green-100 text-green-800',
                'holiday': 'bg-red-100 text-red-800'
            };
            
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">${record.date}</td>
                    <td class="px-6 py-4">${record.start_time} - ${record.end_time}</td>
                    <td class="px-6 py-4 font-medium">${record.hours}h</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded-full text-xs ${typeClasses[record.type] || typeClasses['weekday']}">
                            ${typeLabels[record.type] || '工作日'}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-gray-600 max-w-xs truncate">${record.content}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded-full text-xs ${record.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                            ${record.status === 'approved' ? '已批准' : '待审批'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async addOvertimeRecord(formData) {
        const date = document.getElementById('ot-date').value;
        const startTime = document.getElementById('ot-start').value;
        const endTime = document.getElementById('ot-end').value;
        
        // 计算小时数
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);
        let hours = (end - start) / (1000 * 60 * 60);
        if (hours < 0) hours += 24;
        
        const { error } = await supabase
            .from('overtime_records')
            .insert([{
                user_id: this.currentUser.id,
                date: date,
                start_time: startTime,
                end_time: endTime,
                hours: Math.round(hours * 10) / 10,
                type: document.getElementById('ot-type').value,
                content: document.getElementById('ot-content').value,
                status: 'pending',
                created_at: new Date().toISOString()
            }]);

        if (error) {
            alert('提交失败: ' + error.message);
            return;
        }

        document.getElementById('overtime-form').reset();
        await this.loadUserData();
        alert('加班记录已提交，等待审批');
    }

    loadProfile() {
        if (!this.currentUser) return;
        
        document.getElementById('profile-name').value = this.currentUser.name || '';
        document.getElementById('profile-no').value = this.currentUser.employee_no || '';
        document.getElementById('profile-dept').value = this.currentUser.department || '';
        document.getElementById('profile-position').value = this.currentUser.position || '';
        document.getElementById('profile-status').value = this.currentUser.status || 'idle';
        document.getElementById('profile-current-task').value = this.currentUser.current_task || '';
        
        this.renderSkills();
    }

    renderSkills() {
        const container = document.getElementById('skill-tags');
        const skills = this.currentUser?.skills || [];
        
        container.innerHTML = skills.map(skill => `
            <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                ${skill}
                <button onclick="userApp.removeSkill('${skill}')" class="hover:text-blue-600">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </span>
        `).join('');
    }

    async updateStatus() {
        const status = document.getElementById('profile-status').value;
        
        const { error } = await supabase
            .from('users')
            .update({ status: status })
            .eq('id', this.currentUser.id);
            
        if (!error) {
            this.currentUser.status = status;
            this.updateDashboard();
        }
    }

    async updateCurrentTask() {
        const task = document.getElementById('profile-current-task').value;
        
        const { error } = await supabase
            .from('users')
            .update({ current_task: task })
            .eq('id', this.currentUser.id);
            
        if (!error) {
            this.currentUser.current_task = task;
            this.updateDashboard();
        }
    }

    async addSkill() {
        const input = document.getElementById('new-skill');
        const skill = input.value.trim();
        
        if (!skill) return;
        
        const skills = this.currentUser?.skills || [];
        if (skills.includes(skill)) {
            alert('该技能已存在');
            return;
        }
        
        const { error } = await supabase
            .from('users')
            .update({ skills: [...skills, skill] })
            .eq('id', this.currentUser.id);
            
        if (!error) {
            this.currentUser.skills = [...skills, skill];
            this.renderSkills();
            input.value = '';
        }
    }

    async removeSkill(skill) {
        const skills = (this.currentUser?.skills || []).filter(s => s !== skill);
        
        const { error } = await supabase
            .from('users')
            .update({ skills: skills })
            .eq('id', this.currentUser.id);
            
        if (!error) {
            this.currentUser.skills = skills;
            this.renderSkills();
        }
    }

    showSection(section) {
        this.currentSection = section;
        
        // 隐藏所有 section
        document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
        document.getElementById('section-' + section).classList.remove('hidden');
        
        // 更新侧边栏激活状态（通过 SidebarComponent）
        SidebarComponent.setActive(section);
        
        // 更新头部标题
        const titles = {
            'dashboard': '个人仪表板',
            'tasks': '我的任务',
            'overtime': '加班记录',
            'profile': '个人信息'
        };
        
        const titleEl = document.querySelector('#header h2');
        if (titleEl) titleEl.textContent = titles[section];
        
        // 切换 section 时刷新数据
        if (section === 'dashboard') this.updateDashboard();
        else if (section === 'tasks') this.renderTasks();
        else if (section === 'overtime') this.renderOvertimeTable();
    }

    setupEventListeners() {
        // 加班表单
        document.getElementById('overtime-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addOvertimeRecord();
        });
        
        // 任务更新表单
        document.getElementById('task-update-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateTask();
        });
    }

    async refreshData() {
        const btn = document.querySelector('.fa-sync-alt');
        btn?.classList.add('fa-spin');
        
        await this.loadUserData();
        
        setTimeout(() => btn?.classList.remove('fa-spin'), 500);
    }

    /**
     * ✅ 已删除：logout() 方法
     * 现在使用 SidebarComponent.logout()
     */
}

// 导出到全局
window.UserApp = UserApp;
