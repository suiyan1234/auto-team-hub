/**
 * AdminApp - 管理端应用逻辑
 * 职责：全量数据操作、批量导入导出、复杂图表、系统配置
 * 权限：可操作所有数据
 */

class AdminApp {
    constructor(page) {
        this.currentPage = page;
        this.currentUser = null;
        this.data = {
            personnel: [],
            overtime: [],
            tasks: [],
            cases: [],
            equipment: [],
            inventory: [],
            transactions: []
        };
        this.charts = {};
        this.importData = null;
        this.caseUploadData = null;
        
        this.init();
    }

    async init() {
        await this.checkAuth();
        
        // ✅ 使用共享侧边栏组件
        SidebarComponent.render('sidebar', 'admin');
        
        this.initHeader();
        await this.loadPageData();
        this.setupEventListeners();
    }

    async checkAuth() {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
            window.location.href = '../auth/login.html';
            return;
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (userError || !user || user.role !== 'admin') {
            alert('无权访问管理端');
            window.location.href = '../user/index.html';
            return;
        }

        this.currentUser = user;
    }

    /**
     * ✅ 已删除：initSidebar() 方法
     * 现在使用 shared/components/sidebar.js 中的 SidebarComponent
     */

    initHeader() {
        const header = document.getElementById('header');
        if (!header) return;

        const titles = {
            'dashboard': '管理仪表板',
            'personnel': '人员管理',
            'cases': 'Test Case管理',
            'equipment': '设备管理',
            'overtime': '加班监控',
            'inventory': '物料管理'
        };

        const titleEl = header.querySelector('h2');
        if (titleEl) titleEl.textContent = titles[this.currentPage] || '管理后台';

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

    async loadPageData() {
        switch(this.currentPage) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'personnel':
                await this.loadPersonnelData();
                break;
            case 'cases':
                await this.loadCasesData();
                break;
            case 'equipment':
                await this.loadEquipmentData();
                break;
            case 'overtime':
                await this.loadOvertimeData();
                break;
            case 'inventory':
                await this.loadInventoryData();
                break;
        }
    }

    // ==================== Dashboard ====================
    async loadDashboardData() {
        const { data: personnel } = await supabase.from('users').select('*').eq('role', 'user');
        const { data: overtime } = await supabase.from('overtime_records').select('*').gte('date', new Date(new Date().setDate(1)).toISOString());
        const { data: tasks } = await supabase.from('tasks').select('*');
        const { data: equipment } = await supabase.from('equipment').select('*');

        this.data.personnel = personnel || [];
        this.data.overtime = overtime || [];
        this.data.tasks = tasks || [];
        this.data.equipment = equipment || [];

        // 更新KPI卡片
        document.getElementById('total-employees').textContent = this.data.personnel.length;
        
        const totalOT = this.data.overtime.reduce((sum, r) => sum + (r.hours || 0), 0);
        document.getElementById('total-overtime').textContent = totalOT.toFixed(1) + 'h';
        
        const completedTasks = this.data.tasks.filter(t => t.status === 'completed').length;
        const taskRate = this.data.tasks.length > 0 ? Math.round((completedTasks / this.data.tasks.length) * 100) : 0;
        document.getElementById('task-completion').textContent = taskRate + '%';

        const runningEquip = this.data.equipment.filter(e => e.status === 'running').length;
        const utilization = this.data.equipment.length > 0 ? Math.round((runningEquip / this.data.equipment.length) * 100) : 0;
        document.getElementById('equipment-utilization').textContent = utilization + '%';

        this.initDashboardCharts();
        this.updateAlerts();
        this.updateRealTimeStatus();
    }

    initDashboardCharts() {
        const deptCtx = document.getElementById('deptOvertimeChart')?.getContext('2d');
        if (deptCtx) {
            const deptStats = this.calculateDeptOvertime();
            this.charts.deptOvertime = new Chart(deptCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(deptStats),
                    datasets: [{
                        label: '加班时数',
                        data: Object.values(deptStats),
                        backgroundColor: 'rgba(102, 126, 234, 0.8)',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }

        const taskCtx = document.getElementById('taskStatusChart')?.getContext('2d');
        if (taskCtx) {
            const statusCount = {
                pending: this.data.tasks.filter(t => t.status === 'pending').length,
                progress: this.data.tasks.filter(t => t.status === 'progress').length,
                completed: this.data.tasks.filter(t => t.status === 'completed').length,
                blocked: this.data.tasks.filter(t => t.status === 'blocked').length
            };

            this.charts.taskStatus = new Chart(taskCtx, {
                type: 'doughnut',
                data: {
                    labels: ['待处理', '进行中', '已完成', '阻塞中'],
                    datasets: [{
                        data: [statusCount.pending, statusCount.progress, statusCount.completed, statusCount.blocked],
                        backgroundColor: ['#9CA3AF', '#3B82F6', '#10B981', '#EF4444']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
        }
    }

    calculateDeptOvertime() {
        const stats = {};
        this.data.personnel.forEach(p => {
            stats[p.department] = stats[p.department] || 0;
        });
        
        this.data.overtime.forEach(r => {
            const user = this.data.personnel.find(p => p.id === r.user_id);
            if (user) {
                stats[user.department] = (stats[user.department] || 0) + (r.hours || 0);
            }
        });
        
        return stats;
    }

    updateAlerts() {
        const alerts = [];
        
        // 加班预警
        this.data.personnel.forEach(p => {
            const userOT = this.data.overtime
                .filter(r => r.user_id === p.id)
                .reduce((sum, r) => sum + (r.hours || 0), 0);
            
            if (userOT > 40) {
                alerts.push({
                    type: 'overtime',
                    level: userOT > 60 ? 'danger' : 'warning',
                    message: `${p.name} 本月加班${userOT.toFixed(1)}小时，超出标准`,
                    icon: 'fa-clock'
                });
            }
        });

        // 设备故障预警
        const errorEquip = this.data.equipment.filter(e => e.status === 'error');
        errorEquip.forEach(e => {
            alerts.push({
                type: 'equipment',
                level: 'danger',
                message: `设备 ${e.name} 发生故障`,
                icon: 'fa-server'
            });
        });

        // 更新预警显示
        const container = document.getElementById('alert-list');
        const badge = document.getElementById('notification-badge');
        
        if (badge) {
            badge.classList.toggle('hidden', alerts.length === 0);
        }
        
        if (container) {
            document.getElementById('alert-count').textContent = `${alerts.length} 个预警`;
            container.innerHTML = alerts.map(alert => `
                <div class="bg-${alert.level === 'danger' ? 'red' : 'yellow'}-50 border-l-4 border-${alert.level === 'danger' ? 'red' : 'yellow'}-500 p-4 rounded-lg">
                    <div class="flex items-start">
                        <i class="fas ${alert.icon} text-${alert.level === 'danger' ? 'red' : 'yellow'}-500 mt-1 mr-3"></i>
                        <div>
                            <p class="text-sm text-gray-800">${alert.message}</p>
                            <p class="text-xs text-gray-500 mt-1">${new Date().toLocaleString('zh-CN')}</p>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    updateRealTimeStatus() {
        const onlineContainer = document.getElementById('online-users');
        if (onlineContainer) {
            const activeUsers = this.data.personnel.slice(0, 5);
            onlineContainer.innerHTML = activeUsers.map(u => `
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-xs font-bold border-2 border-white" title="${u.name}">
                    ${u.name.charAt(0)}
                </div>
            `).join('');
            document.getElementById('online-count').textContent = `${this.data.personnel.length} 人在线`;
        }

        const equipContainer = document.getElementById('equipment-status');
        if (equipContainer) {
            const recentEquip = this.data.equipment.slice(0, 3);
            equipContainer.innerHTML = recentEquip.map(e => `
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-700">${e.name}</span>
                    <span class="px-2 py-1 rounded text-xs ${e.status === 'running' ? 'bg-green-100 text-green-800' : e.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}">
                        ${e.status === 'running' ? '运行中' : e.status === 'error' ? '故障' : '待机'}
                    </span>
                </div>
            `).join('');
        }

        const pendingContainer = document.getElementById('pending-approvals');
        if (pendingContainer) {
            const pendingOT = this.data.overtime.filter(r => r.status === 'pending').length;
            pendingContainer.innerHTML = `
                <li class="flex justify-between items-center">
                    <span>加班审批</span>
                    <span class="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">${pendingOT} 条</span>
                </li>
            `;
        }
    }

    // ==================== Personnel ====================
    async loadPersonnelData() {
        const { data: users, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'user');

        if (!error) {
            this.data.personnel = users || [];
            this.renderPersonnel();
            this.initDeptTrendChart();
        }
    }

    initDeptTrendChart() {
        const ctx = document.getElementById('deptTrendChart')?.getContext('2d');
        if (!ctx) return;

        const months = [];
        const datasets = {};
        const depts = [...new Set(this.data.personnel.map(p => p.department))];
        
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            months.push(d.toLocaleDateString('zh-CN', { year: '2-digit', month: 'short' }));
        }

        depts.forEach(dept => {
            datasets[dept] = months.map(() => Math.random() * 100 + 50);
        });

        this.charts.deptTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: depts.map((dept, idx) => ({
                    label: dept,
                    data: datasets[dept],
                    borderColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][idx % 4],
                    backgroundColor: 'transparent',
                    tension: 0.4
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } }
            }
        });
    }

    renderPersonnel() {
        const grid = document.getElementById('personnel-grid');
        const table = document.getElementById('personnel-table');
        
        if (grid) {
            grid.innerHTML = this.data.personnel.map(p => {
                const skills = p.skills || [];
                return `
                    <div class="bg-white rounded-xl shadow-sm p-6 card-hover">
                        <div class="flex items-center gap-4 mb-4">
                            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-lg font-bold">
                                ${p.name.charAt(0)}
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800">${p.name}</h4>
                                <p class="text-sm text-gray-500">${p.department} · ${p.position}</p>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${skills.slice(0, 3).map(s => `<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">${s}</span>`).join('')}
                            ${skills.length > 3 ? `<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">+${skills.length - 3}</span>` : ''}
                        </div>
                        <div class="flex justify-between text-sm text-gray-600 border-t pt-3">
                            <span>本月加班: <strong>${Math.floor(Math.random() * 40)}h</strong></span>
                            <span class="${p.status === 'active' ? 'text-green-600' : 'text-gray-400'}">
                                ${p.status === 'active' ? '● 在职' : '○ 离职'}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (table) {
            table.innerHTML = this.data.personnel.map(p => `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 font-medium">${p.employee_no || '-'}</td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                                ${p.name.charAt(0)}
                            </div>
                            ${p.name}
                        </div>
                    </td>
                    <td class="px-6 py-4">${p.department}</td>
                    <td class="px-6 py-4">${p.position}</td>
                    <td class="px-6 py-4">
                        <div class="flex flex-wrap gap-1">
                            ${(p.skills || []).slice(0, 2).map(s => `<span class="px-2 py-1 bg-gray-100 rounded text-xs">${s}</span>`).join('')}
                        </div>
                    </td>
                    <td class="px-6 py-4">${Math.floor(Math.random() * 40)}h</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded-full text-xs ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                            ${p.status === 'active' ? '在职' : '离职'}
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        <button onclick="adminApp.editPersonnel('${p.id}')" class="text-blue-600 hover:text-blue-800 mr-2">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="adminApp.deletePersonnel('${p.id}')" class="text-red-600 hover:text-red-800">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
            
            document.getElementById('personnel-count').textContent = `共 ${this.data.personnel.length} 人`;
        }
    }

    filterPersonnel() {
        const search = document.getElementById('personnel-search')?.value.toLowerCase() || '';
        const dept = document.getElementById('dept-filter')?.value || '';
        const status = document.getElementById('status-filter')?.value || '';
        
        let filtered = this.data.personnel;
        if (search) {
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(search) || 
                (p.employee_no || '').toLowerCase().includes(search)
            );
        }
        if (dept) filtered = filtered.filter(p => p.department === dept);
        if (status) filtered = filtered.filter(p => p.status === status);
        
        this.data.personnel = filtered;
        this.renderPersonnel();
        this.loadPersonnelData();
    }

    openPersonnelModal() {
        document.getElementById('personnel-modal-title').textContent = '新增人员';
        document.getElementById('personnel-form').reset();
        document.getElementById('personnel-id').value = '';
        document.getElementById('personnel-modal').classList.remove('hidden');
        document.getElementById('personnel-modal').classList.add('flex');
    }

    closePersonnelModal() {
        document.getElementById('personnel-modal').classList.add('hidden');
        document.getElementById('personnel-modal').classList.remove('flex');
    }

    editPersonnel(id) {
        const p = this.data.personnel.find(u => u.id === id);
        if (!p) return;
        
        document.getElementById('personnel-modal-title').textContent = '编辑人员';
        document.getElementById('personnel-id').value = p.id;
        document.getElementById('p-no').value = p.employee_no || '';
        document.getElementById('p-name').value = p.name;
        document.getElementById('p-dept').value = p.department;
        document.getElementById('p-position').value = p.position;
        document.getElementById('p-email').value = p.email || '';
        document.getElementById('p-skills').value = (p.skills || []).join(', ');
        document.getElementById('p-role').value = p.role || 'user';
        
        document.getElementById('personnel-modal').classList.remove('hidden');
        document.getElementById('personnel-modal').classList.add('flex');
    }

    async deletePersonnel(id) {
        if (!confirm('确定要删除该人员吗？此操作不可恢复。')) return;
        
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (!error) {
            this.loadPersonnelData();
            alert('删除成功');
        } else {
            alert('删除失败: ' + error.message);
        }
    }

    // Batch Import
    openBatchImportModal() {
        document.getElementById('batch-import-modal').classList.remove('hidden');
        document.getElementById('batch-import-modal').classList.add('flex');
        document.getElementById('import-preview').classList.add('hidden');
        this.importData = null;
    }

    closeBatchImportModal() {
        document.getElementById('batch-import-modal').classList.add('hidden');
        document.getElementById('batch-import-modal').classList.remove('flex');
    }

    handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            if (jsonData.length < 2) {
                alert('文件数据不足');
                return;
            }

            this.importData = jsonData;
            this.showImportPreview(jsonData);
        };
        reader.readAsArrayBuffer(file);
    }

    showImportPreview(data) {
        const headers = data[0];
        const rows = data.slice(1, 6);

        document.getElementById('import-preview-header').innerHTML = 
            headers.map(h => `<th class="px-4 py-2 text-left font-medium">${h}</th>`).join('');
        document.getElementById('import-preview-body').innerHTML = 
            rows.map(row => `<tr>${row.map(cell => `<td class="px-4 py-2 border-t">${cell || ''}</td>`).join('')}</tr>`).join('');
        
        document.getElementById('import-preview').classList.remove('hidden');
    }

    async confirmBatchImport() {
        if (!this.importData) return;

        const rows = this.importData.slice(1);
        const newUsers = rows.map(row => ({
            employee_no: row[0],
            name: row[1],
            department: row[2],
            position: row[3],
            email: row[4],
            skills: row[5] ? row[5].split(',').map(s => s.trim()) : [],
            role: 'user',
            status: 'active'
        })).filter(u => u.name && u.email);

        const { error } = await supabase.from('users').insert(newUsers);
        
        if (!error) {
            this.closeBatchImportModal();
            this.loadPersonnelData();
            alert(`成功导入 ${newUsers.length} 条数据`);
        } else {
            alert('导入失败: ' + error.message);
        }
    }

    downloadTemplate() {
        const template = [
            ['工号', '姓名', '部门', '职位', '邮箱', '技能（逗号分隔）'],
            ['E001', '张三', '研发部', '工程师', 'zhangsan@example.com', 'Python, Selenium']
        ];
        const ws = XLSX.utils.aoa_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, '人员导入模板.xlsx');
    }

    exportDeptTrend() {
        alert('导出功能开发中...');
    }

    // ==================== Cases ====================
    async loadCasesData() {
        const { data: cases } = await supabase.from('test_cases').select('*');
        const { data: users } = await supabase.from('users').select('id, name');
        
        this.data.cases = cases || [];
        this.data.personnel = users || [];
        
        this.updateFunctionCards();
        this.renderCasesTable();
        this.populateAssigneeSelect();
    }

    updateFunctionCards() {
        const functions = ['software', 'hardware', 'automation', 'mechanical'];
        const labels = {
            'software': { name: 'software', label: '软件' },
            'hardware': { name: 'hardware', label: '硬件' },
            'automation': { name: 'automation', label: 'automation' },
            'mechanical': { name: 'mechanical', label: 'mechanical' }
        };

        functions.forEach(func => {
            const cases = this.data.cases.filter(c => c.function_type === func);
            const total = cases.length;
            const completed = cases.filter(c => c.status === 'passed' || c.status === 'automated').length;
            const automated = cases.filter(c => c.automated).length;
            
            const completeRate = total > 0 ? Math.round((completed / total) * 100) : 0;
            const autoRate = completed > 0 ? Math.round((automated / completed) * 100) : 0;

            document.getElementById(`${labels[func].name}-completed`).textContent = `${completed}/${total}`;
            document.getElementById(`${labels[func].name}-progress`).style.width = `${completeRate}%`;
            document.getElementById(`${labels[func].name}-auto-rate`).textContent = `${autoRate}%`;
            document.getElementById(`${labels[func].name}-auto-progress`).style.width = `${autoRate}%`;
            document.getElementById(`${labels[func].name}-auto-count`).textContent = automated;
            document.getElementById(`${labels[func].name}-remaining`).textContent = total - completed;
        });
    }

    renderCasesTable() {
        const tbody = document.getElementById('cases-table');
        if (!tbody) return;

        tbody.innerHTML = this.data.cases.map(c => {
            const assignee = this.data.personnel.find(p => p.id === c.assigned_to);
            const statusClasses = {
                'pending': 'bg-gray-100 text-gray-800',
                'passed': 'bg-green-100 text-green-800',
                'failed': 'bg-red-100 text-red-800',
                'automated': 'bg-purple-100 text-purple-800'
            };
            const statusLabels = {
                'pending': '待执行',
                'passed': '通过',
                'failed': '失败',
                'automated': '已自动化'
            };

            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 font-medium">${c.case_no}</td>
                    <td class="px-6 py-4">${c.name}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">${c.function_type}</span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded text-xs ${c.priority === 'high' ? 'bg-red-100 text-red-800' : c.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}">
                            ${c.priority === 'high' ? '高' : c.priority === 'medium' ? '中' : '低'}
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 rounded-full text-xs ${statusClasses[c.status]}">
                            ${statusLabels[c.status]}
                        </span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="${c.automated ? 'text-purple-600' : 'text-gray-400'}">
                            <i class="fas ${c.automated ? 'fa-check-circle' : 'fa-circle'}"></i>
                            ${c.automated ? '是' : '否'}
                        </span>
                    </td>
                    <td class="px-6 py-4">${assignee ? assignee.name : '-'}</td>
                    <td class="px-6 py-4">
                        <button onclick="adminApp.editCase('${c.id}')" class="text-blue-600 hover:text-blue-800 mr-2">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="adminApp.deleteCase('${c.id}')" class="text-red-600 hover:text-red-800">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        document.getElementById('case-total-count').textContent = `共 ${this.data.cases.length} 个Case`;
    }

    populateAssigneeSelect() {
        const select = document.getElementById('case-assignee');
        if (!select) return;
        
        select.innerHTML = this.data.personnel.map(p => 
            `<option value="${p.id}">${p.name}</option>`
        ).join('');
    }

    filterCases() {
        this.loadCasesData();
    }

    openCaseModal() {
        document.getElementById('case-modal-title').textContent = '新增Test Case';
        document.getElementById('case-form').reset();
        document.getElementById('case-id').value = '';
        document.getElementById('case-modal').classList.remove('hidden');
        document.getElementById('case-modal').classList.add('flex');
    }

    closeCaseModal() {
        document.getElementById('case-modal').classList.add('hidden');
        document.getElementById('case-modal').classList.remove('flex');
    }

    editCase(id) {
        const c = this.data.cases.find(item => item.id === id);
        if (!c) return;

        document.getElementById('case-modal-title').textContent = '编辑Test Case';
        document.getElementById('case-id').value = c.id;
        document.getElementById('case-no').value = c.case_no;
        document.getElementById('case-name').value = c.name;
        document.getElementById('case-function').value = c.function_type;
        document.getElementById('case-priority').value = c.priority;
        document.getElementById('case-status').value = c.status;
        document.getElementById('case-automated').value = c.automated ? 'true' : 'false';
        document.getElementById('case-assignee').value = c.assigned_to || '';
        document.getElementById('case-desc').value = c.description || '';

        document.getElementById('case-modal').classList.remove('hidden');
        document.getElementById('case-modal').classList.add('flex');
    }

    async deleteCase(id) {
        if (!confirm('确定删除此Case？')) return;
        
        const { error } = await supabase.from('test_cases').delete().eq('id', id);
        if (!error) {
            this.loadCasesData();
            alert('删除成功');
        }
    }

    // Excel Upload for Cases
    openExcelUploadModal() {
        document.getElementById('excel-upload-modal').classList.remove('hidden');
        document.getElementById('excel-upload-modal').classList.add('flex');
        document.getElementById('case-upload-preview').classList.add('hidden');
        this.caseUploadData = null;
    }

    closeExcelUploadModal() {
        document.getElementById('excel-upload-modal').classList.add('hidden');
        document.getElementById('excel-upload-modal').classList.remove('flex');
    }

    handleCaseExcelUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            this.caseUploadData = jsonData;
            
            const headers = jsonData[0];
            const rows = jsonData.slice(1, 6);
            
            document.getElementById('case-upload-header').innerHTML = 
                headers.map(h => `<th class="px-4 py-2 text-left font-medium">${h}</th>`).join('');
            document.getElementById('case-upload-body').innerHTML = 
                rows.map(row => `<tr>${row.map(cell => `<td class="px-4 py-2 border-t">${cell || ''}</td>`).join('')}</tr>`).join('');
            
            document.getElementById('case-upload-preview').classList.remove('hidden');
        };
        reader.readAsArrayBuffer(file);
    }

    async confirmCaseUpload() {
        const functionType = document.getElementById('upload-function-type').value;
        if (!functionType) {
            alert('请选择Function类型');
            return;
        }

        const rows = this.caseUploadData.slice(1);
        const newCases = rows.map(row => ({
            case_no: row[0],
            name: row[1],
            status: row[2] || 'pending',
            automated: row[3] === 'true' || row[3] === true,
            priority: row[4] || 'medium',
            function_type: functionType
        })).filter(c => c.case_no && c.name);

        const { error } = await supabase.from('test_cases').insert(newCases);
        
        if (!error) {
            this.closeExcelUploadModal();
            this.loadCasesData();
            alert(`成功导入 ${newCases.length} 个Case`);
        } else {
            alert('导入失败: ' + error.message);
        }
    }

    // ==================== Equipment ====================
    async loadEquipmentData() {
        const { data: equipment } = await supabase.from('equipment').select('*');
        const { data: users } = await supabase.from('users').select('id, name');
        
        this.data.equipment = equipment || [];
        this.data.personnel = users || [];
        
        this.updateEquipmentStats();
        this.renderEquipment();
        this.initEquipmentChart();
    }

    updateEquipmentStats() {
        const running = this.data.equipment.filter(e => e.status === 'running').length;
        const idle = this.data.equipment.filter(e => e.status === 'idle').length;
        const error = this.data.equipment.filter(e => e.status === 'error').length;
        const maintenance = this.data.equipment.filter(e => e.status === 'maintenance').length;
        
        document.getElementById('eq-running').textContent = running;
        document.getElementById('eq-idle').textContent = idle;
        document.getElementById('eq-error').textContent = error + maintenance;
        
        const utilization = this.data.equipment.length > 0 
            ? Math.round((running / this.data.equipment.length) * 100) 
            : 0;
        document.getElementById('eq-utilization').textContent = utilization + '%';
    }

    renderEquipment() {
        const grid = document.getElementById('equipment-grid');
        if (!grid) return;

        grid.innerHTML = this.data.equipment.map(e => {
            const manager = this.data.personnel.find(p => p.id === e.manager_id);
            const statusConfig = {
                'running': { color: 'green', icon: 'fa-play', label: '运行中' },
                'idle': { color: 'yellow', icon: 'fa-pause', label: '待机中' },
                'maintenance': { color: 'orange', icon: 'fa-wrench', label: '维护中' },
                'error': { color: 'red', icon: 'fa-exclamation', label: '故障中' }
            };
            const config = statusConfig[e.status] || statusConfig['idle'];

            return `
                <div class="bg-white rounded-xl shadow-sm p-6 card-hover border-t-4 border-${config.color}-500">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h4 class="font-bold text-gray-800">${e.name}</h4>
                            <p class="text-sm text-gray-500">${e.equipment_no}</p>
                        </div>
                        <div class="w-10 h-10 rounded-full bg-${config.color}-100 flex items-center justify-center">
                            <i class="fas ${config.icon} text-${config.color}-600"></i>
                        </div>
                    </div>
                    <div class="space-y-2 text-sm text-gray-600 mb-4">
                        <p><i class="fas fa-map-marker-alt w-5"></i>${e.location || '-'}</p>
                        <p><i class="fas fa-user w-5"></i>${manager ? manager.name : '-'}</p>
                        <p><i class="fas fa-clock w-5"></i>稼动率: ${e.utilization || 0}%</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="adminApp.openReservationModal('${e.id}')" class="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200">
                            <i class="fas fa-calendar-check mr-1"></i>预约
                        </button>
                        <button onclick="adminApp.editEquipment('${e.id}')" class="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    initEquipmentChart() {
        const ctx = document.getElementById('equipmentChart')?.getContext('2d');
        if (!ctx) return;

        const days = [];
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
            data.push(Math.floor(Math.random() * 30) + 70);
        }

        this.charts.equipment = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [{
                    label: '平均稼动率',
                    data: data,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    filterEquipment() {
        this.loadEquipmentData();
    }

    openEquipmentModal() {
        document.getElementById('equipment-modal-title').textContent = '登记设备';
        document.getElementById('equipment-form').reset();
        document.getElementById('equipment-id').value = '';
        document.getElementById('equipment-modal').classList.remove('hidden');
        document.getElementById('equipment-modal').classList.add('flex');
        
        const select = document.getElementById('eq-manager');
        select.innerHTML = this.data.personnel.map(p => 
            `<option value="${p.id}">${p.name}</option>`
        ).join('');
    }

    closeEquipmentModal() {
        document.getElementById('equipment-modal').classList.add('hidden');
        document.getElementById('equipment-modal').classList.remove('flex');
    }

    editEquipment(id) {
        const e = this.data.equipment.find(item => item.id === id);
        if (!e) return;

        document.getElementById('equipment-modal-title').textContent = '编辑设备';
        document.getElementById('equipment-id').value = e.id;
        document.getElementById('eq-no').value = e.equipment_no;
        document.getElementById('eq-name').value = e.name;
        document.getElementById('eq-type').value = e.type;
        document.getElementById('eq-status').value = e.status;
        document.getElementById('eq-location').value = e.location || '';
        document.getElementById('eq-manager').value = e.manager_id || '';
        document.getElementById('eq-note').value = e.note || '';

        document.getElementById('equipment-modal').classList.remove('hidden');
        document.getElementById('equipment-modal').classList.add('flex');
    }

    openReservationModal(equipId) {
        const e = this.data.equipment.find(item => item.id === equipId);
        if (!e) return;

        document.getElementById('resv-equipment-id').value = equipId;
        document.getElementById('resv-equipment-name').value = e.name;
        document.getElementById('reservation-modal').classList.remove('hidden');
        document.getElementById('reservation-modal').classList.add('flex');
    }

    closeReservationModal() {
        document.getElementById('reservation-modal').classList.add('hidden');
        document.getElementById('reservation-modal').classList.remove('flex');
    }

    // ==================== Overtime ====================
    async loadOvertimeData() {
        const period = document.getElementById('ot-period')?.value || 'month';
        
        let startDate = new Date();
        if (period === 'month') {
            startDate.setDate(1);
        } else if (period === 'quarter') {
            startDate.setMonth(startDate.getMonth() - 3);
        } else {
            startDate.setFullYear(startDate.getFullYear() - 1);
        }

        const { data: overtime } = await supabase
            .from('overtime_records')
            .select('*, users(name, department)')
            .gte('date', startDate.toISOString())
            .order('date', { ascending: false });

        this.data.overtime = overtime || [];
        
        this.initOvertimeChart();
        this.renderWarningList();
        this.renderOvertimeRecords();
    }

    initOvertimeChart() {
        const ctx = document.getElementById('overtimeChart')?.getContext('2d');
        if (!ctx) return;

        const deptStats = {};
        this.data.overtime.forEach(r => {
            const dept = r.users?.department || '未知';
            deptStats[dept] = (deptStats[dept] || 0) + (r.hours || 0);
        });

        this.charts.overtime = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(deptStats),
                datasets: [{
                    label: '加班时数',
                    data: Object.values(deptStats),
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    renderWarningList() {
        const tbody = document.getElementById('warning-table');
        if (!tbody) return;

        const userStats = {};
        this.data.overtime.forEach(r => {
            if (!userStats[r.user_id]) {
                userStats[r.user_id] = {
                    name: r.users?.name,
                    department: r.users?.department,
                    total: 0,
                    consecutive: 0
                };
            }
            userStats[r.user_id].total += r.hours || 0;
        });

        const warnings = Object.entries(userStats)
            .filter(([_, stats]) => stats.total > 40)
            .map(([userId, stats]) => ({
                userId,
                ...stats,
                level: stats.total > 60 ? 'danger' : 'warning'
            }));

        document.getElementById('warning-count').textContent = `${warnings.length} 人超标`;

        tbody.innerHTML = warnings.map(w => `
            <tr class="hover:bg-gray-50 ${w.level === 'danger' ? 'bg-red-50' : 'bg-yellow-50'}">
                <td class="px-6 py-4">${w.userId.substring(0, 8)}</td>
                <td class="px-6 py-4 font-medium">${w.name}</td>
                <td class="px-6 py-4">${w.department}</td>
                <td class="px-6 py-4 font-bold ${w.level === 'danger' ? 'text-red-600' : 'text-yellow-600'}">${w.total.toFixed(1)}h</td>
                <td class="px-6 py-4">${w.consecutive}天</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-xs ${w.level === 'danger' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${w.level === 'danger' ? '严重超标' : '超出标准'}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <button onclick="adminApp.viewUserOvertime('${w.userId}')" class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-eye"></i> 查看
                    </button>
                </td>
            </tr>
        `).join('');
    }

    renderOvertimeRecords() {
        const tbody = document.getElementById('overtime-records-table');
        if (!tbody) return;

        tbody.innerHTML = this.data.overtime.slice(0, 50).map(r => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4">${r.date}</td>
                <td class="px-6 py-4">${r.users?.name || '-'}</td>
                <td class="px-6 py-4">${r.users?.department || '-'}</td>
                <td class="px-6 py-4">${r.start_time} - ${r.end_time}</td>
                <td class="px-6 py-4">${r.hours}h</td>
                <td class="px-6 py-4 text-gray-600 max-w-xs truncate">${r.content}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-xs ${r.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${r.status === 'approved' ? '已批准' : '待审批'}
                    </span>
                </td>
                <td class="px-6 py-4">
                    ${r.status === 'pending' ? `
                        <button onclick="adminApp.approveOvertime('${r.id}')" class="text-green-600 hover:text-green-800 mr-2">
                            <i class="fas fa-check"></i>
                        </button>
                        <button onclick="adminApp.rejectOvertime('${r.id}')" class="text-red-600 hover:text-red-800">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
    }

    async approveOvertime(id) {
        const { error } = await supabase
            .from('overtime_records')
            .update({ status: 'approved' })
            .eq('id', id);
        
        if (!error) {
            this.loadOvertimeData();
        }
    }

    filterOvertimeRecords() {
        this.loadOvertimeData();
    }

    exportOvertimeReport() {
        alert('导出报表功能开发中...');
    }

    // ==================== Inventory ====================
    async loadInventoryData() {
        const { data: inventory } = await supabase.from('inventory').select('*');
        const { data: transactions } = await supabase
            .from('inventory_transactions')
            .select('*, inventory(name)')
            .order('created_at', { ascending: false })
            .limit(20);

        this.data.inventory = inventory || [];
        this.data.transactions = transactions || [];

        this.updateInventoryStats();
        this.renderInventory();
        this.renderTransactions();
    }

    updateInventoryStats() {
        const total = this.data.inventory.length;
        const normal = this.data.inventory.filter(i => i.quantity > i.safety_stock).length;
        const low = this.data.inventory.filter(i => i.quantity > 0 && i.quantity <= i.safety_stock).length;
        const out = this.data.inventory.filter(i => i.quantity === 0).length;

        document.getElementById('inv-total-types').textContent = total;
        document.getElementById('inv-normal').textContent = normal;
        document.getElementById('inv-low').textContent = low;
        document.getElementById('inv-out').textContent = out;
    }

    renderInventory() {
        const grid = document.getElementById('inventory-grid');
        const table = document.getElementById('inventory-table');

        if (grid) {
            grid.innerHTML = this.data.inventory.map(item => {
                const status = item.quantity === 0 ? 'out' : item.quantity <= item.safety_stock ? 'low' : 'normal';
                const statusConfig = {
                    'normal': { color: 'green', label: '充足' },
                    'low': { color: 'yellow', label: '不足' },
                    'out': { color: 'red', label: '缺货' }
                };
                const config = statusConfig[status];

                return `
                    <div class="bg-white rounded-xl shadow-sm p-6 card-hover border-l-4 border-${config.color}-500">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h4 class="font-bold text-gray-800">${item.name}</h4>
                                <p class="text-sm text-gray-500">${item.item_no}</p>
                            </div>
                            <span class="px-2 py-1 bg-${config.color}-100 text-${config.color}-800 rounded text-xs">
                                ${config.label}
                            </span>
                        </div>
                        <div class="flex justify-between items-end">
                            <div>
                                <p class="text-2xl font-bold text-gray-800">${item.quantity}</p>
                                <p class="text-xs text-gray-500">安全库存: ${item.safety_stock}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-xs text-gray-500">${item.category}</p>
                                <p class="text-xs text-gray-400">${item.location || '-'}</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        if (table) {
            table.innerHTML = this.data.inventory.map(item => {
                const status = item.quantity === 0 ? 'out' : item.quantity <= item.safety_stock ? 'low' : 'normal';
                
                return `
                    <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4 font-medium">${item.item_no}</td>
                        <td class="px-6 py-4">${item.name}</td>
                        <td class="px-6 py-4">${item.category}</td>
                        <td class="px-6 py-4 text-gray-600">${item.specification || '-'}</td>
                        <td class="px-6 py-4 font-bold ${status === 'out' ? 'text-red-600' : status === 'low' ? 'text-yellow-600' : 'text-green-600'}">
                            ${item.quantity}
                        </td>
                        <td class="px-6 py-4">${item.safety_stock}</td>
                        <td class="px-6 py-4">
                            <span class="px-2 py-1 rounded-full text-xs ${status === 'normal' ? 'bg-green-100 text-green-800' : status === 'low' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}">
                                ${status === 'normal' ? '正常' : status === 'low' ? '不足' : '缺货'}
                            </span>
                        </td>
                        <td class="px-6 py-4">
                            <button onclick="adminApp.editInventory('${item.id}')" class="text-blue-600 hover:text-blue-800 mr-2">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="adminApp.viewInventoryDetail('${item.id}')" class="text-gray-600 hover:text-gray-800">
                                <i class="fas fa-eye"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            document.getElementById('inventory-count').textContent = `共 ${this.data.inventory.length} 种物料`;
        }
    }

    renderTransactions() {
        const tbody = document.getElementById('transaction-table');
        if (!tbody) return;

        tbody.innerHTML = this.data.transactions.map(t => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 text-sm">${new Date(t.created_at).toLocaleString('zh-CN')}</td>
                <td class="px-6 py-4">${t.inventory?.name || '-'}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded text-xs ${t.type === 'in' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}">
                        ${t.type === 'in' ? '入库' : '出库'}
                    </span>
                </td>
                <td class="px-6 py-4 font-medium ${t.type === 'in' ? 'text-green-600' : 'text-orange-600'}">
                    ${t.type === 'in' ? '+' : '-'}${t.quantity}
                </td>
                <td class="px-6 py-4 text-sm">${t.operator || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">${t.note || '-'}</td>
            </tr>
        `).join('');
    }

    scanBarcode() {
        const input = document.getElementById('barcode-input');
        const code = input.value.trim();
        if (!code) return;

        const item = this.data.inventory.find(i => i.item_no === code || i.barcode === code);
        const resultDiv = document.getElementById('scan-result');
        
        if (item) {
            resultDiv.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-gray-800">${item.name}</h4>
                        <p class="text-sm text-gray-500">编号: ${item.item_no}</p>
                        <p class="text-sm text-gray-600 mt-2">当前库存: <strong class="${item.quantity <= item.safety_stock ? 'text-red-600' : 'text-green-600'}">${item.quantity}</strong></p>
                        <p class="text-sm text-gray-500">位置: ${item.location || '-'}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="adminApp.quickStock('${item.id}', 'in')" class="px-3 py-1 bg-green-600 text-white rounded text-sm">入库</button>
                        <button onclick="adminApp.quickStock('${item.id}', 'out')" class="px-3 py-1 bg-orange-600 text-white rounded text-sm">出库</button>
                    </div>
                </div>
            `;
            resultDiv.classList.remove('hidden');
        } else {
            resultDiv.innerHTML = `
                <div class="text-center text-gray-500">
                    <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                    <p>未找到物料: ${code}</p>
                    <button onclick="adminApp.openInventoryModal()" class="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm">新增物料</button>
                </div>
            `;
            resultDiv.classList.remove('hidden');
        }
        
        input.value = '';
        input.focus();
    }

    quickStock(itemId, type) {
        document.getElementById('stock-type').value = type;
        document.getElementById('stock-item').value = itemId;
        document.getElementById('stock-modal-title').textContent = type === 'in' ? '入库操作' : '出库操作';
        document.getElementById('stock-operator').value = this.currentUser?.name || '';
        document.getElementById('stock-modal').classList.remove('hidden');
        document.getElementById('stock-modal').classList.add('flex');
    }

    filterInventory() {
        this.loadInventoryData();
    }

    openInventoryModal() {
        document.getElementById('inventory-modal-title').textContent = '新增物料';
        document.getElementById('inventory-form').reset();
        document.getElementById('inventory-id').value = '';
        document.getElementById('inventory-modal').classList.remove('hidden');
        document.getElementById('inventory-modal').classList.add('flex');
    }

    closeInventoryModal() {
        document.getElementById('inventory-modal').classList.add('hidden');
        document.getElementById('inventory-modal').classList.remove('flex');
    }

    editInventory(id) {
        const item = this.data.inventory.find(i => i.id === id);
        if (!item) return;

        document.getElementById('inventory-modal-title').textContent = '编辑物料';
        document.getElementById('inventory-id').value = item.id;
        document.getElementById('inv-no').value = item.item_no;
        document.getElementById('inv-name').value = item.name;
        document.getElementById('inv-category').value = item.category;
        document.getElementById('inv-spec').value = item.specification || '';
        document.getElementById('inv-quantity').value = item.quantity;
        document.getElementById('inv-safety').value = item.safety_stock;
        document.getElementById('inv-location').value = item.location || '';
        document.getElementById('inv-note').value = item.note || '';

        document.getElementById('inventory-modal').classList.remove('hidden');
        document.getElementById('inventory-modal').classList.add('flex');
    }

    openStockModal(type) {
        const select = document.getElementById('stock-item');
        select.innerHTML = this.data.inventory.map(i => 
            `<option value="${i.id}">${i.item_no} - ${i.name} (库存: ${i.quantity})</option>`
        ).join('');

        document.getElementById('stock-type').value = type;
        document.getElementById('stock-modal-title').textContent = type === 'in' ? '入库操作' : '出库操作';
        document.getElementById('stock-operator').value = this.currentUser?.name || '';
        document.getElementById('stock-modal').classList.remove('hidden');
        document.getElementById('stock-modal').classList.add('flex');
    }

    closeStockModal() {
        document.getElementById('stock-modal').classList.add('hidden');
        document.getElementById('stock-modal').classList.remove('flex');
    }

    viewInventoryDetail(id) {
        alert('查看详情功能开发中...');
    }

    // ==================== Form Submissions ====================
    setupEventListeners() {
        // Personnel form
        document.getElementById('personnel-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('personnel-id').value;
            const data = {
                employee_no: document.getElementById('p-no').value,
                name: document.getElementById('p-name').value,
                department: document.getElementById('p-dept').value,
                position: document.getElementById('p-position').value,
                email: document.getElementById('p-email').value,
                skills: document.getElementById('p-skills').value.split(',').map(s => s.trim()).filter(s => s),
                role: document.getElementById('p-role').value,
                status: 'active'
            };

            let error;
            if (id) {
                ({ error } = await supabase.from('users').update(data).eq('id', id));
            } else {
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: data.email,
                    password: '123456',
                    options: {
                        data: { name: data.name, role: data.role }
                    }
                });
                
                if (!authError && authData.user) {
                    data.id = authData.user.id;
                    ({ error } = await supabase.from('users').insert([data]));
                } else {
                    error = authError;
                }
            }

            if (!error) {
                this.closePersonnelModal();
                this.loadPersonnelData();
                alert(id ? '更新成功' : '创建成功');
            } else {
                alert('操作失败: ' + error.message);
            }
        });

        // Case form
        document.getElementById('case-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('case-id').value;
            const data = {
                case_no: document.getElementById('case-no').value,
                name: document.getElementById('case-name').value,
                function_type: document.getElementById('case-function').value,
                priority: document.getElementById('case-priority').value,
                status: document.getElementById('case-status').value,
                automated: document.getElementById('case-automated').value === 'true',
                assigned_to: document.getElementById('case-assignee').value,
                description: document.getElementById('case-desc').value
            };

            let error;
            if (id) {
                ({ error } = await supabase.from('test_cases').update(data).eq('id', id));
            } else {
                ({ error } = await supabase.from('test_cases').insert([data]));
            }

            if (!error) {
                this.closeCaseModal();
                this.loadCasesData();
                alert(id ? '更新成功' : '创建成功');
            } else {
                alert('操作失败: ' + error.message);
            }
        });

        // Equipment form
        document.getElementById('equipment-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('equipment-id').value;
            const data = {
                equipment_no: document.getElementById('eq-no').value,
                name: document.getElementById('eq-name').value,
                type: document.getElementById('eq-type').value,
                status: document.getElementById('eq-status').value,
                location: document.getElementById('eq-location').value,
                manager_id: document.getElementById('eq-manager').value,
                note: document.getElementById('eq-note').value
            };

            let error;
            if (id) {
                ({ error } = await supabase.from('equipment').update(data).eq('id', id));
            } else {
                ({ error } = await supabase.from('equipment').insert([data]));
            }

            if (!error) {
                this.closeEquipmentModal();
                this.loadEquipmentData();
                alert(id ? '更新成功' : '创建成功');
            } else {
                alert('操作失败: ' + error.message);
            }
        });

        // Reservation form
        document.getElementById('reservation-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                equipment_id: document.getElementById('resv-equipment-id').value,
                start_time: document.getElementById('resv-start').value,
                end_time: document.getElementById('resv-end').value,
                purpose: document.getElementById('resv-purpose').value,
                user_id: this.currentUser.id,
                status: 'pending'
            };

            const { error } = await supabase.from('equipment_reservations').insert([data]);

            if (!error) {
                this.closeReservationModal();
                alert('预约申请已提交');
            } else {
                alert('预约失败: ' + error.message);
            }
        });

        // Inventory form
        document.getElementById('inventory-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('inventory-id').value;
            const data = {
                item_no: document.getElementById('inv-no').value,
                name: document.getElementById('inv-name').value,
                category: document.getElementById('inv-category').value,
                specification: document.getElementById('inv-spec').value,
                quantity: parseInt(document.getElementById('inv-quantity').value) || 0,
                safety_stock: parseInt(document.getElementById('inv-safety').value) || 0,
                location: document.getElementById('inv-location').value,
                note: document.getElementById('inv-note').value
            };

            let error;
            if (id) {
                ({ error } = await supabase.from('inventory').update(data).eq('id', id));
            } else {
                ({ error } = await supabase.from('inventory').insert([data]));
            }

            if (!error) {
                this.closeInventoryModal();
                this.loadInventoryData();
                alert(id ? '更新成功' : '创建成功');
            } else {
                alert('操作失败: ' + error.message);
            }
        });

        // Stock in/out form
        document.getElementById('stock-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('stock-type').value;
            const itemId = document.getElementById('stock-item').value;
            const quantity = parseInt(document.getElementById('stock-quantity').value);
            const note = document.getElementById('stock-note').value;

            const item = this.data.inventory.find(i => i.id === itemId);
            if (!item) {
                alert('物料不存在');
                return;
            }

            if (type === 'out' && item.quantity < quantity) {
                alert('库存不足');
                return;
            }

            const newQuantity = type === 'in' ? item.quantity + quantity : item.quantity - quantity;
            const { error: updateError } = await supabase
                .from('inventory')
                .update({ quantity: newQuantity })
                .eq('id', itemId);

            if (updateError) {
                alert('库存更新失败: ' + updateError.message);
                return;
            }

            const { error: transError } = await supabase.from('inventory_transactions').insert([{
                inventory_id: itemId,
                type: type,
                quantity: quantity,
                operator: document.getElementById('stock-operator').value,
                note: note
            }]);

            if (!transError) {
                this.closeStockModal();
                this.loadInventoryData();
                alert(type === 'in' ? '入库成功' : '出库成功');
            } else {
                alert('记录失败: ' + transError.message);
            }
        });

        // Drag and drop for batch import
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-active');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-active');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-active');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const event = { target: { files: files } };
                    this.handleImportFile(event);
                }
            });
        }

        // Drag and drop for case upload
        const caseDropZone = document.getElementById('case-drop-zone');
        if (caseDropZone) {
            caseDropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                caseDropZone.classList.add('drag-active');
            });
            caseDropZone.addEventListener('dragleave', () => {
                caseDropZone.classList.remove('drag-active');
            });
            caseDropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                caseDropZone.classList.remove('drag-active');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const event = { target: { files: files } };
                    this.handleCaseExcelUpload(event);
                }
            });
        }
    }

    // ==================== Utility Methods ====================
    async refreshData() {
        const btn = document.querySelector('.fa-sync-alt');
        if (btn) btn.classList.add('fa-spin');
        
        await this.loadPageData();
        
        setTimeout(() => {
            if (btn) btn.classList.remove('fa-spin');
        }, 500);
    }

    /**
     * ✅ 已删除：logout() 方法
     * 现在使用 SidebarComponent.logout()
     */

    viewUserOvertime(userId) {
        localStorage.setItem('overtime_filter_user', userId);
        window.location.href = 'overtime.html';
    }

    rejectOvertime(id) {
        alert('驳回功能开发中...');
    }
}

// 导出到全局
window.AdminApp = AdminApp;
