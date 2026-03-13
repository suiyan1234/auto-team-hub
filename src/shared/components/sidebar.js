/**
 * Auto Team Hub - 侧边栏组件
 */

const SidebarComponent = {
    // 当前激活的菜单
    activeMenu: '',

    // 渲染侧边栏
    render(containerId = 'sidebar-container', role = 'user') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const menus = this.getMenus(role);
        
        container.innerHTML = `
            <div class="flex flex-col h-full">
                <!-- Logo -->
                <div class="p-6 border-b border-slate-800">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-600 via-cyan-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <i class="fas fa-robot text-white text-xl"></i>
                        </div>
                        <div>
                            <h1 class="font-bold text-lg text-white tracking-tight">Auto Team Hub</h1>
                            <p class="text-xs text-slate-400">${role === 'user' ? '用户中心' : '管理控制台'}</p>
                        </div>
                    </div>
                </div>

                <!-- 菜单 -->
                <nav class="flex-1 py-4 space-y-1 overflow-y-auto">
                    ${menus.map(menu => this.renderMenuItem(menu)).join('')}
                </nav>

                <!-- 底部 -->
                <div class="p-4 border-t border-slate-800">
                    <button onclick="SidebarComponent.logout()" class="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors flex items-center space-x-2">
                        <i class="fas fa-sign-out-alt w-6 text-center"></i>
                        <span>退出登录</span>
                    </button>
                </div>
            </div>
        `;

        // 标记当前激活
        this.highlightActive();
    },

    // 获取菜单配置
    getMenus(role) {
        const commonMenus = [
            { id: 'dashboard', label: '仪表板', icon: 'fa-th-large', path: role === 'user' ? '/user/index.html' : '/admin/index.html' }
        ];

        if (role === 'user') {
            return [
                ...commonMenus,
                { id: 'tasks', label: '我的任务', icon: 'fa-tasks', path: '/user/index.html#tasks' },
                { id: 'overtime', label: '加班记录', icon: 'fa-clock', path: '/user/index.html#overtime' },
                { id: 'profile', label: '个人信息', icon: 'fa-user', path: '/user/index.html#profile' }
            ];
        }

        // admin / super_admin
        const adminMenus = [
            { id: 'personnel', label: '人员管理', icon: 'fa-users', path: '/admin/personnel.html' },
            { id: 'cases', label: 'Test Case', icon: 'fa-clipboard-check', path: '/admin/cases.html' },
            { id: 'equipment', label: '设备资源', icon: 'fa-server', path: '/admin/equipment.html' },
            { id: 'overtime', label: '加班管控', icon: 'fa-clock', path: '/admin/overtime.html' },
            { id: 'inventory', label: '物料管理', icon: 'fa-boxes', path: '/admin/inventory.html' }
        ];

        if (role === 'super_admin') {
            adminMenus.push({ id: 'settings', label: '系统设置', icon: 'fa-cog', path: '/admin/settings.html' });
        }

        return [...commonMenus, ...adminMenus];
    },

    // 渲染单个菜单项
    renderMenuItem(menu) {
        const isActive = this.activeMenu === menu.id;
        
        return `
            <a href="${menu.path}" 
               data-menu-id="${menu.id}"
               class="nav-item flex items-center px-6 py-3 text-slate-300 hover:text-white transition-all ${isActive ? 'active' : ''}"
               onclick="SidebarComponent.handleClick('${menu.id}', event)">
                <i class="fas ${menu.icon} w-6 text-center mr-3"></i>
                <span>${menu.label}</span>
                ${menu.badge ? `<span class="ml-auto bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">${menu.badge}</span>` : ''}
            </a>
        `;
    },

    // 处理点击
    handleClick(menuId, event) {
        // 如果是锚点导航，不阻止默认行为
        const href = event.currentTarget.getAttribute('href');
        if (href.includes('#')) {
            this.setActive(menuId);
            return true; // 允许默认跳转
        }
        
        // 普通页面跳转
        event.preventDefault();
        this.setActive(menuId);
        window.location.href = href;
    },

    // 设置激活状态
    setActive(menuId) {
        this.activeMenu = menuId;
        this.highlightActive();
    },

    // 高亮当前菜单
    highlightActive() {
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.menuId === this.activeMenu) {
                el.classList.add('active');
            }
        });
    },

    // 根据当前页面自动设置激活
    autoActivate() {
        const path = window.location.pathname;
        const hash = window.location.hash.slice(1);
        
        // 先尝试匹配hash
        if (hash) {
            this.setActive(hash);
            return;
        }
        
        // 匹配路径
        const menuMap = {
            '/user/index.html': 'dashboard',
            '/admin/index.html': 'dashboard',
            '/admin/personnel.html': 'personnel',
            '/admin/cases.html': 'cases',
            '/admin/equipment.html': 'equipment',
            '/admin/overtime.html': 'overtime',
            '/admin/inventory.html': 'inventory',
            '/admin/settings.html': 'settings'
        };
        
        const menuId = menuMap[path] || 'dashboard';
        this.setActive(menuId);
    },

    // 登出
    async logout() {
        if (await Utils.confirm('确定要退出登录吗？')) {
            await API.auth.signOut();
            window.location.href = '/auth/login.html';
        }
    }
};

// 导出
window.SidebarComponent = SidebarComponent;
