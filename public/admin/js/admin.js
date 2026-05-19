// ============================================================
// Auto Team Hub - 管理后台数据集成示例
// 路径: public/admin/js/admin.js (替换或补充现有代码)
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    await initAdminPage();
});

async function initAdminPage() {
    // 1. 验证管理员权限
    const user = await DataLayer.getCurrentUser();
    if (!user || user.profile?.role !== 'admin') {
        alert('无权访问');
        window.location.href = '/auth/login.html';
        return;
    }

    // 2. 加载仪表盘数据
    await loadDashboardStats();

    // 3. 加载用户管理
    await loadUserManagement();

    // 4. 加载加班数据管理
    await loadOvertimeManagement();

    // 5. 加载项目数据
    await loadProjectManagement();

    // 6. 加载物料管理
    await loadInventoryManagement();

    // 7. 加载培训管理
    await loadTrainingManagement();

    // 8. 加载审批中心
    await loadApprovalCenter();

    // 9. 实时订阅
    DataLayer.subscribeToTable('overtime_records', (payload) => {
        console.log('加班记录更新:', payload);
        loadOvertimeManagement();
        loadDashboardStats();
    });

    DataLayer.subscribeToTable('inventory_borrowings', (payload) => {
        console.log('物料申请更新:', payload);
        loadInventoryManagement();
        loadApprovalCenter();
    });

    DataLayer.subscribeToTable('tasks', (payload) => {
        console.log('任务更新:', payload);
        loadProjectManagement();
    });
}

// ==================== 仪表盘 ====================
async function loadDashboardStats() {
    try {
        const profiles = await DataLayer.getAllProfiles();
        const currentYear = new Date().getFullYear();
        const overtimeStats = await DataLayer.getOvertimeStats(null, currentYear);
        const projectStats = await DataLayer.getProjectStats();

        // 总员工数
        const totalUsers = profiles.length;
        const totalEl = document.querySelector('[data-stat="total_users"]');
        if (totalEl) totalEl.textContent = totalUsers;

        // 本月总加班
        const monthOvertimeEl = document.querySelector('[data-stat="month_overtime_total"]');
        if (monthOvertimeEl) monthOvertimeEl.textContent = overtimeStats.confirmed.toFixed(1) + 'h';

        // 任务完成率
        const completionRateEl = document.querySelector('[data-stat="task_completion_rate"]');
        if (completionRateEl) completionRateEl.textContent = projectStats.completionRate + '%';

        // 自动化覆盖率
        const autoRateEl = document.querySelector('[data-stat="automation_rate"]');
        if (autoRateEl) autoRateEl.textContent = projectStats.automationRate + '%';

        // 在线人员（status 不为 空闲/离线）
        const onlineUsers = profiles.filter(p => p.status && p.status !== '空闲' && p.status !== '离线').length;
        const onlineEl = document.querySelector('[data-stat="online_users"]');
        if (onlineEl) onlineEl.textContent = onlineUsers + ' 人在线';

        // 预警中心：超期物料、待审批加班、逾期任务
        const borrowings = await DataLayer.getAllBorrowings();
        const overdueItems = borrowings.filter(b => {
            return b.status === '使用中' && b.expected_return && new Date(b.expected_return) < new Date();
        });
        const pendingOvertime = (await DataLayer.getAllOvertime()).filter(o => o.status === '待确认');
        const allTasks = await DataLayer.getAllTasks();
        const overdueTasks = allTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== '已完成');

        const warningEl = document.querySelector('[data-stat="warnings"]');
        if (warningEl) warningEl.textContent = (overdueItems.length + pendingOvertime.length + overdueTasks.length) + ' 个预警';

        // 渲染部门加班概览
        renderDepartmentOvertime(profiles, await DataLayer.getAllOvertime());

        // 渲染任务状态分布
        renderTaskDistribution(allTasks);

    } catch (e) {
        console.error('加载仪表盘失败:', e);
    }
}

function renderDepartmentOvertime(profiles, overtimeRecords) {
    const deptStats = {};
    profiles.forEach(p => {
        const dept = p.departments?.name || '未分配';
        if (!deptStats[dept]) deptStats[dept] = { total: 0, count: 0 };
    });
    overtimeRecords.filter(o => o.status === '已确认').forEach(o => {
        const profile = profiles.find(p => p.id === o.user_id);
        const dept = profile?.departments?.name || '未分配';
        if (deptStats[dept]) {
            deptStats[dept].total += parseFloat(o.duration_hours);
            deptStats[dept].count++;
        }
    });

    const container = document.querySelector('#dept-overtime-chart');
    if (!container) return;
    // 这里接入你的图表库 (ECharts/Chart.js)
    console.log('部门加班数据:', deptStats);
}

function renderTaskDistribution(tasks) {
    const stats = {
        '待处理': tasks.filter(t => t.status === '待处理').length,
        '进行中': tasks.filter(t => t.status === '进行中').length,
        '已完成': tasks.filter(t => t.status === '已完成').length
    };
    const container = document.querySelector('#task-status-chart');
    if (!container) return;
    console.log('任务状态分布:', stats);
}

// ==================== 用户管理 ====================
async function loadUserManagement() {
    try {
        const profiles = await DataLayer.getAllProfiles();
        const tbody = document.querySelector('#user-table tbody');
        if (!tbody) return;

        tbody.innerHTML = profiles.map(p => {
            const years = p.join_date ? ((new Date() - new Date(p.join_date)) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1) : '-';
            return `
                <tr>
                    <td>${p.name}</td>
                    <td>${p.departments?.name || '-'}/${p.position || '-'}</td>
                    <td><span class="badge badge-${p.role === 'admin' ? 'danger' : 'primary'}">${p.role}</span></td>
                    <td>${p.join_date || '-'}</td>
                    <td>${years} 年</td>
                    <td>
                        <button onclick="editUser('${p.id}')">编辑</button>
                        <button onclick="deleteUser('${p.id}')">删除</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('加载用户失败:', e);
    }
}

async function editUser(userId) {
    // 弹出编辑模态框，调用 DataLayer.updateProfile(userId, updates)
    const updates = { /* 从表单获取 */ };
    try {
        await DataLayer.updateProfile(userId, updates);
        alert('更新成功');
        await loadUserManagement();
    } catch (e) {
        alert('更新失败: ' + e.message);
    }
}

// ==================== 加班数据管理 ====================
async function loadOvertimeManagement() {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const records = await DataLayer.getAllOvertime(currentMonth);
        const tbody = document.querySelector('#overtime-table tbody');
        if (!tbody) return;

        tbody.innerHTML = records.map(r => `
            <tr>
                <td>${r.profiles?.name || '-'}</td>
                <td>${r.profiles?.departments?.name || '-'}</td>
                <td>${r.duration_hours}h</td>
                <td>${await DataLayer.getOvertimeStats(r.user_id).then(s => s.confirmed.toFixed(1))}h</td>
                <td><span class="badge badge-${r.status === '已确认' ? 'success' : r.status === '已驳回' ? 'danger' : 'warning'}">${r.status}</span></td>
                <td>
                    ${r.status === '待确认' ? `
                        <button onclick="confirmOvertime('${r.id}', true)">确认</button>
                        <button onclick="confirmOvertime('${r.id}', false)">驳回</button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('加载加班管理失败:', e);
    }
}

async function confirmOvertime(recordId, confirm) {
    try {
        await DataLayer.confirmOvertime(recordId, confirm);
        alert(confirm ? '已确认' : '已驳回');
        await loadOvertimeManagement();
        await loadDashboardStats();
    } catch (e) {
        alert('操作失败: ' + e.message);
    }
}

// ==================== 项目数据管理 ====================
async function loadProjectManagement() {
    try {
        const projects = await DataLayer.getAllProjects();
        const tasks = await DataLayer.getAllTasks();
        const stats = await DataLayer.getProjectStats();

        // 更新统计卡片
        const totalProjEl = document.querySelector('[data-stat="total_projects"]');
        if (totalProjEl) totalProjEl.textContent = stats.totalProjects;
        const totalCaseEl = document.querySelector('[data-stat="total_cases"]');
        if (totalCaseEl) totalCaseEl.textContent = stats.totalCases;
        const completionEl = document.querySelector('[data-stat="project_completion"]');
        if (completionEl) completionEl.textContent = stats.completionRate + '%';
        const autoEl = document.querySelector('[data-stat="project_automation"]');
        if (autoEl) autoEl.textContent = stats.automationRate + '%';

        // 渲染任务表格
        const tbody = document.querySelector('#project-task-table tbody');
        if (tbody) {
            tbody.innerHTML = tasks.map(t => `
                <tr>
                    <td>${t.projects?.name || '-'}</td>
                    <td>${t.function_name}</td>
                    <td>${t.completed_cases}/${t.total_cases}</td>
                    <td>${t.automated_cases}</td>
                    <td><span class="badge badge-${t.status === '已完成' ? 'success' : t.status === '进行中' ? 'primary' : 'secondary'}">${t.status}</span></td>
                    <td>${t.profiles?.name || '未分配'}</td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('加载项目管理失败:', e);
    }
}

// ==================== 物料管理 ====================
async function loadInventoryManagement() {
    try {
        const items = await DataLayer.getAllInventory();
        const borrowings = await DataLayer.getAllBorrowings();

        // 统计
        const inStock = items.filter(i => i.status === '在库').length;
        const borrowed = items.filter(i => i.status === '借出').length;
        const pending = borrowings.filter(b => b.status === '审批中').length;
        const maintenance = items.filter(i => i.status === '维护中').length;

        const stockEl = document.querySelector('[data-stat="in_stock"]');
        if (stockEl) stockEl.textContent = inStock;
        const borrowedEl = document.querySelector('[data-stat="borrowed_items"]');
        if (borrowedEl) borrowedEl.textContent = borrowed;
        const pendingEl = document.querySelector('[data-stat="pending_borrowings"]');
        if (pendingEl) pendingEl.textContent = pending;
        const maintEl = document.querySelector('[data-stat="maintenance_items"]');
        if (maintEl) maintEl.textContent = maintenance;

        // 渲染物料表格
        const tbody = document.querySelector('#inventory-table tbody');
        if (tbody) {
            tbody.innerHTML = items.map(i => `
                <tr>
                    <td>${i.name}</td>
                    <td>${i.serial_number || '-'}</td>
                    <td>${i.category || '-'}</td>
                    <td><span class="badge badge-${i.status === '在库' ? 'success' : i.status === '借出' ? 'primary' : 'warning'}">${i.status}</span></td>
                    <td>
                        <button onclick="editInventoryItem('${i.id}')">编辑</button>
                        <button onclick="deleteInventoryItem('${i.id}')">删除</button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('加载物料管理失败:', e);
    }
}

// ==================== 培训管理 ====================
async function loadTrainingManagement() {
    try {
        const trainings = await DataLayer.getTrainingStats();
        const tbody = document.querySelector('#training-table tbody');
        if (!tbody) return;

        tbody.innerHTML = trainings.map(t => `
            <tr>
                <td>${t.name}</td>
                <td>${t.requiredCount}</td>
                <td>${t.completedCount}</td>
                <td>${t.completionRate}%</td>
                <td><button onclick="viewTrainingDetail('${t.id}')">详情</button></td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('加载培训管理失败:', e);
    }
}

// ==================== 审批中心 ====================
async function loadApprovalCenter() {
    try {
        const pendingBorrowings = (await DataLayer.getAllBorrowings()).filter(b => b.status === '审批中');
        const pendingOvertime = (await DataLayer.getAllOvertime()).filter(o => o.status === '待确认');

        const container = document.querySelector('#approval-list');
        if (!container) return;

        let html = '';

        // 物料审批
        if (pendingBorrowings.length > 0) {
            html += '<h4>物料领用申请</h4>';
            html += pendingBorrowings.map(b => `
                <div class="approval-card">
                    <p>${b.profiles?.name} 申请领用 ${b.inventory_items?.name} (${b.inventory_items?.serial_number})</p>
                    <p>预计归还: ${b.expected_return ? new Date(b.expected_return).toLocaleDateString() : '未设置'}</p>
                    <button onclick="approveBorrowing('${b.id}', true)">批准</button>
                    <button onclick="approveBorrowing('${b.id}', false)">拒绝</button>
                </div>
            `).join('');
        }

        // 加班审批
        if (pendingOvertime.length > 0) {
            html += '<h4>加班确认</h4>';
            html += pendingOvertime.map(o => `
                <div class="approval-card">
                    <p>${o.profiles?.name} ${o.record_date} 加班 ${o.duration_hours}h (${o.type})</p>
                    <p>${o.content || '无备注'}</p>
                    <button onclick="confirmOvertime('${o.id}', true)">确认</button>
                    <button onclick="confirmOvertime('${o.id}', false)">驳回</button>
                </div>
            `).join('');
        }

        container.innerHTML = html || '<p>暂无待审批事项</p>';
    } catch (e) {
        console.error('加载审批中心失败:', e);
    }
}

async function approveBorrowing(borrowingId, approve) {
    try {
        await DataLayer.approveBorrowing(borrowingId, approve);
        alert(approve ? '已批准' : '已拒绝');
        await loadApprovalCenter();
        await loadInventoryManagement();
    } catch (e) {
        alert('操作失败: ' + e.message);
    }
}
