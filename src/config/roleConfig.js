/**
 * Auto Team Hub - 角色权限配置
 * 定义不同角色的权限范围
 */

const RoleConfig = {
    // 角色定义
    roles: {
        user: {
            id: 'user',
            label: '普通用户',
            description: '只能查看和操作自己的数据',
            level: 1
        },
        admin: {
            id: 'admin',
            label: '管理员',
            description: '可以管理所有数据，但不能修改系统设置',
            level: 2
        },
        super_admin: {
            id: 'super_admin',
            label: '超级管理员',
            description: '系统最高权限，可以修改所有设置',
            level: 3
        }
    },

    // 权限定义
    permissions: {
        // 人员管理
        'personnel.view': { roles: ['user', 'admin', 'super_admin'] },
        'personnel.create': { roles: ['admin', 'super_admin'] },
        'personnel.update': { roles: ['admin', 'super_admin'], self: true },  // self: 可以修改自己
        'personnel.delete': { roles: ['super_admin'] },
        'personnel.import': { roles: ['admin', 'super_admin'] },

        // 设备管理
        'equipment.view': { roles: ['user', 'admin', 'super_admin'] },
        'equipment.create': { roles: ['admin', 'super_admin'] },
        'equipment.update': { roles: ['admin', 'super_admin'] },
        'equipment.delete': { roles: ['super_admin'] },
        'equipment.book': { roles: ['user', 'admin', 'super_admin'] },

        // Test Case管理
        'cases.view': { roles: ['user', 'admin', 'super_admin'], assigned: true },  // assigned: 只能看分配的
        'cases.create': { roles: ['admin', 'super_admin'] },
        'cases.update': { roles: ['admin', 'super_admin'], assigned: true, fields: ['progress', 'actual_result'] },
        'cases.delete': { roles: ['super_admin'] },
        'cases.assign': { roles: ['admin', 'super_admin'] },
        'cases.import': { roles: ['admin', 'super_admin'] },

        // 加班管理
        'overtime.view': { roles: ['user', 'admin', 'super_admin'], self: true },
        'overtime.create': { roles: ['user', 'admin', 'super_admin'], self: true },
        'overtime.approve': { roles: ['admin', 'super_admin'] },
        'overtime.stats': { roles: ['admin', 'super_admin'] },

        // 物料管理
        'inventory.view': { roles: ['user', 'admin', 'super_admin'] },
        'inventory.create': { roles: ['admin', 'super_admin'] },
        'inventory.update': { roles: ['admin', 'super_admin'] },
        'inventory.request': { roles: ['user', 'admin', 'super_admin'] },
        'inventory.approve': { roles: ['admin', 'super_admin'] },

        // 系统管理
        'settings.view': { roles: ['user', 'admin', 'super_admin'] },
        'settings.update': { roles: ['super_admin'] },
        'audit.view': { roles: ['super_admin'] },
        'system.backup': { roles: ['super_admin'] },
        'system.restore': { roles: ['super_admin'] }
    },

    // 菜单权限（控制侧边栏显示）
    menus: {
        user: [
            { id: 'dashboard', label: '我的仪表板', icon: 'fa-home', path: '/user/index.html' },
            { id: 'tasks', label: '我的任务', icon: 'fa-tasks', path: '/user/index.html#tasks' },
            { id: 'overtime', label: '加班记录', icon: 'fa-clock', path: '/user/index.html#overtime' },
            { id: 'profile', label: '个人信息', icon: 'fa-user', path: '/user/index.html#profile' }
        ],
        admin: [
            { id: 'dashboard', label: '总览仪表板', icon: 'fa-th-large', path: '/admin/index.html' },
            { id: 'personnel', label: '人员管理', icon: 'fa-users', path: '/admin/personnel.html' },
            { id: 'cases', label: 'Test Case', icon: 'fa-clipboard-check', path: '/admin/cases.html' },
            { id: 'equipment', label: '设备资源', icon: 'fa-server', path: '/admin/equipment.html' },
            { id: 'overtime', label: '加班管控', icon: 'fa-clock', path: '/admin/overtime.html' },
            { id: 'inventory', label: '物料管理', icon: 'fa-boxes', path: '/admin/inventory.html' },
            { id: 'settings', label: '系统设置', icon: 'fa-cog', path: '/admin/settings.html', role: 'super_admin' }
        ]
    },

    // 字段级权限（控制表单字段的编辑权限）
    fieldPermissions: {
        'personnel.name': { roles: ['admin', 'super_admin'], editable: false },  // 姓名不可改
        'personnel.role': { roles: ['admin', 'super_admin'] },
        'personnel.dept': { roles: ['admin', 'super_admin'] },
        'personnel.skill': { roles: ['user', 'admin', 'super_admin'], self: true },
        'personnel.status': { roles: ['user', 'admin', 'super_admin'], self: true },
        'personnel.task': { roles: ['user', 'admin', 'super_admin'], self: true },
        'cases.progress': { roles: ['user', 'admin', 'super_admin'], assigned: true },
        'cases.automation_progress': { roles: ['admin', 'super_admin'] }
    },

    // 权限检查方法
    checkPermission(permission, userRole, options = {}) {
        const perm = this.permissions[permission];
        if (!perm) return false;

        // 检查角色
        if (perm.roles.includes(userRole)) return true;

        // 检查是否是自己的数据
        if (perm.self && options.isSelf) return true;

        // 检查是否是分配的数据
        if (perm.assigned && options.isAssigned) {
            // 检查字段权限
            if (options.field && perm.fields) {
                return perm.fields.includes(options.field);
            }
            return true;
        }

        return false;
    },

    // 获取用户菜单
    getMenus(userRole) {
        const menus = [...this.menus.user];  // 所有用户都有用户端菜单
        
        if (userRole === 'admin' || userRole === 'super_admin') {
            menus.push(...this.menus.admin);
        }

        // 过滤需要特定角色的菜单
        return menus.filter(m => !m.role || m.role === userRole);
    },

    // 检查字段是否可编辑
    canEditField(fieldPath, userRole, isSelf = false) {
        const field = this.fieldPermissions[fieldPath];
        if (!field) return false;

        if (!field.roles.includes(userRole)) return false;
        if (field.editable === false) return false;
        if (field.self && !isSelf) return false;

        return true;
    }
};

// 导出
window.RoleConfig = RoleConfig;
