// ============================================================
// Auto Team Hub - 用户页面数据集成示例
// 路径: public/user/js/user.js (替换或补充现有代码)
// ============================================================

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
    await initUserPage();
});

async function initUserPage() {
    // 1. 获取当前用户信息
    const user = await DataLayer.getCurrentUser();
    if (!user) {
        window.location.href = '/auth/login.html';
        return;
    }

    // 2. 渲染个人信息
    renderProfile(user.profile);

    // 3. 加载加班数据
    await loadOvertimeData();

    // 4. 加载任务数据
    await loadTaskData();

    // 5. 加载物料数据
    await loadInventoryData();

    // 6. 加载动态
    await loadActivities();

    // 7. 设置状态修改事件
    setupStatusUpdate();

    // 8. 订阅实时更新
    DataLayer.subscribeToMyTasks((payload) => {
        console.log('任务更新:', payload);
        loadTaskData(); // 实时刷新
    });
}

// 渲染个人信息
function renderProfile(profile) {
    const els = {
        name: document.querySelector('[data-field="name"]'),
        nickname: document.querySelector('[data-field="nickname_id"]'),
        employeeId: document.querySelector('[data-field="employee_id"]'),
        department: document.querySelector('[data-field="department"]'),
        position: document.querySelector('[data-field="position"]'),
        joinDate: document.querySelector('[data-field="join_date"]'),
        status: document.querySelector('[data-field="status"]'),
        currentTask: document.querySelector('[data-field="current_task"]'),
        skills: document.querySelector('[data-field="skills"]')
    };

    if (els.name) els.name.textContent = profile.name || '-';
    if (els.nickname) els.nickname.textContent = profile.nickname_id || '-';
    if (els.employeeId) els.employeeId.textContent = profile.employee_id || '-';
    if (els.department) els.department.textContent = profile.departments?.name || profile.department_id || '-';
    if (els.position) els.position.textContent = profile.position || '-';
    if (els.joinDate) els.joinDate.textContent = profile.join_date || '-';
    if (els.status) els.status.textContent = profile.status || '空闲';
    if (els.currentTask) els.currentTask.textContent = profile.current_task || '无进行任务';
    if (els.skills) els.skills.innerHTML = (profile.skills || []).map(s => `<span class="skill-tag">${s}</span>`).join('');

    // 计算年资
    if (profile.join_date) {
        const years = ((new Date() - new Date(profile.join_date)) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1);
        const seniorityEl = document.querySelector('[data-field="seniority"]');
        if (seniorityEl) seniorityEl.textContent = years + ' 年';
    }
}

// 设置状态修改
function setupStatusUpdate() {
    const statusSelect = document.querySelector('#work-status');
    const taskInput = document.querySelector('#current-task-input');
    const saveBtn = document.querySelector('#save-status-btn');

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const status = statusSelect ? statusSelect.value : '空闲';
            const task = taskInput ? taskInput.value : '';
            try {
                await DataLayer.updateMyStatus(status, task);
                alert('状态已更新');
                // 刷新显示
                const user = await DataLayer.getCurrentUser();
                renderProfile(user.profile);
            } catch (e) {
                alert('更新失败: ' + e.message);
            }
        });
    }
}

// 加载加班数据
async function loadOvertimeData() {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7); // "2026-05"
        const records = await DataLayer.getMyOvertime(currentMonth);
        const stats = await DataLayer.getOvertimeStats(null, new Date().getFullYear());

        // 本月加班时长
        const monthHours = records
            .filter(r => r.status === '已确认')
            .reduce((s, r) => s + parseFloat(r.duration_hours), 0);

        const monthEl = document.querySelector('[data-stat="month_overtime"]');
        if (monthEl) monthEl.textContent = monthHours.toFixed(1) + 'h';

        // 本年累计
        const yearEl = document.querySelector('[data-stat="year_overtime"]');
        if (yearEl) yearEl.textContent = stats.confirmed.toFixed(1) + 'h';

        // 本周加班
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekHours = records
            .filter(r => new Date(r.record_date) >= weekStart && r.status === '已确认')
            .reduce((s, r) => s + parseFloat(r.duration_hours), 0);
        const weekEl = document.querySelector('[data-stat="week_overtime"]');
        if (weekEl) weekEl.textContent = weekHours.toFixed(1) + 'h';

        // 渲染历史记录表格
        renderOvertimeTable(records);
    } catch (e) {
        console.error('加载加班数据失败:', e);
    }
}

function renderOvertimeTable(records) {
    const tbody = document.querySelector('#overtime-history tbody');
    if (!tbody) return;
    tbody.innerHTML = records.map(r => `
        <tr>
            <td>${r.record_date}</td>
            <td>${r.start_time} - ${r.end_time}</td>
            <td>${r.duration_hours}h</td>
            <td>${r.type}</td>
            <td>${r.content || '-'}</td>
            <td><span class="badge badge-${r.status === '已确认' ? 'success' : r.status === '已驳回' ? 'danger' : 'warning'}">${r.status}</span></td>
        </tr>
    `).join('');
}

// 加班录入
async function submitOvertime(formData) {
    try {
        await DataLayer.createOvertime({
            date: formData.date,
            startTime: formData.startTime,
            endTime: formData.endTime,
            duration: formData.duration,
            type: formData.type,
            content: formData.content
        });
        alert('加班记录已提交，等待审批');
        await loadOvertimeData();
    } catch (e) {
        alert('提交失败: ' + e.message);
    }
}

// 加载任务数据
async function loadTaskData() {
    try {
        const tasks = await DataLayer.getMyTasks();
        const total = tasks.length;
        const pending = tasks.filter(t => t.status === '待处理').length;
        const inProgress = tasks.filter(t => t.status === '进行中').length;
        const completed = tasks.filter(t => t.status === '已完成').length;

        // 更新统计卡片
        const totalEl = document.querySelector('[data-stat="total_tasks"]');
        if (totalEl) totalEl.textContent = total;
        const pendingEl = document.querySelector('[data-stat="pending_tasks"]');
        if (pendingEl) pendingEl.textContent = pending;
        const progressEl = document.querySelector('[data-stat="progress_tasks"]');
        if (progressEl) progressEl.textContent = inProgress;
        const completedEl = document.querySelector('[data-stat="completed_tasks"]');
        if (completedEl) completedEl.textContent = completed;

        // 自动化贡献
        const autoCases = tasks.reduce((s, t) => s + (t.automated_cases || 0), 0);
        const autoEl = document.querySelector('[data-stat="auto_cases"]');
        if (autoEl) autoEl.textContent = autoCases;

        // 渲染任务列表
        renderTaskList(tasks);
    } catch (e) {
        console.error('加载任务失败:', e);
    }
}

function renderTaskList(tasks) {
    const container = document.querySelector('#task-list');
    if (!container) return;
    container.innerHTML = tasks.map(t => `
        <div class="task-card ${t.status}">
            <h4>${t.projects?.name || '未分配项目'} - ${t.function_name}</h4>
            <p>进度: ${t.completed_cases}/${t.total_cases} | 自动化: ${t.automated_cases}</p>
            <span class="status-badge ${t.status}">${t.status}</span>
            <button onclick="updateTaskProgress('${t.id}', ${t.completed_cases + 1}, ${t.automated_cases})">+1 Case</button>
        </div>
    `).join('');
}

// 更新任务进度
async function updateTaskProgress(taskId, completed, automated) {
    try {
        await DataLayer.updateTaskProgress(taskId, completed, automated);
        await loadTaskData();
    } catch (e) {
        alert('更新失败: ' + e.message);
    }
}

// 加载物料数据
async function loadInventoryData() {
    try {
        const borrowings = await DataLayer.getMyBorrowings();
        const using = borrowings.filter(b => b.status === '使用中').length;
        const pending = borrowings.filter(b => b.status === '审批中').length;
        const returned = borrowings.filter(b => b.status === '已归还').length;

        const usingEl = document.querySelector('[data-stat="using_items"]');
        if (usingEl) usingEl.textContent = using;
        const pendingEl = document.querySelector('[data-stat="pending_items"]');
        if (pendingEl) pendingEl.textContent = pending;
        const returnedEl = document.querySelector('[data-stat="returned_items"]');
        if (returnedEl) returnedEl.textContent = returned;

        // 渲染物料表格
        renderInventoryTable(borrowings);
    } catch (e) {
        console.error('加载物料失败:', e);
    }
}

function renderInventoryTable(borrowings) {
    const tbody = document.querySelector('#my-inventory tbody');
    if (!tbody) return;
    tbody.innerHTML = borrowings.map(b => `
        <tr>
            <td>${b.inventory_items?.name || '-'}</td>
            <td>${b.inventory_items?.serial_number || '-'}</td>
            <td>${new Date(b.borrowed_at).toLocaleDateString()}</td>
            <td>${b.expected_return ? new Date(b.expected_return).toLocaleDateString() : '-'}</td>
            <td><span class="badge badge-${b.status === '使用中' ? 'primary' : b.status === '已归还' ? 'success' : 'warning'}">${b.status}</span></td>
            <td>${b.status === '使用中' ? `<button onclick="returnItem('${b.id}')">归还</button>` : '-'}</td>
        </tr>
    `).join('');
}

// 归还物料
async function returnItem(borrowingId) {
    try {
        await DataLayer.returnItem(borrowingId);
        alert('归还申请已提交');
        await loadInventoryData();
    } catch (e) {
        alert('归还失败: ' + e.message);
    }
}

// 申请领用物料
async function borrowItem(itemId, expectedReturn) {
    try {
        await DataLayer.borrowItem(itemId, expectedReturn);
        alert('领用申请已提交，等待审批');
    } catch (e) {
        alert('申请失败: ' + e.message);
    }
}

// 加载动态
async function loadActivities() {
    try {
        const activities = await DataLayer.getRecentActivities(10);
        const container = document.querySelector('#activity-feed');
        if (!container) return;
        container.innerHTML = activities.map(a => `
            <div class="activity-item">
                <span class="time">${new Date(a.created_at).toLocaleString()}</span>
                <span class="type">${a.type}</span>
                <p>${a.content}</p>
            </div>
        `).join('');
    } catch (e) {
        console.error('加载动态失败:', e);
    }
}
