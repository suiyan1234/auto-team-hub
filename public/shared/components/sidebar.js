/**
 * Auto Team Hub - 侧边栏组件
 * 统一的管理员/用户侧边栏，支持角色切换
 */

const SidebarComponent = {
    // 当前激活的菜单
    activeMenu: '',

    /**
     * 渲染侧边栏
     * @param {string} containerId - 容器ID，默认 'sidebar'
     * @param {string} role - 角色：'user' | 'admin' | 'super_admin'
     */
    render(containerId = 'sidebar', role = 'user') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Sidebar container #${containerId} not found`);
            return;
        }

        const menus = this.getMenus(role);
        
        container.innerHTML = `
            <div class="flex flex-col h-full gradient-bg text-white">
                <!-- Logo -->
                <div class="p-6 border-b border-white/20">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-600 via-cyan-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <i class="fas fa-robot text-white text-xl"></i>
                        </div>
                        <div>
                            <h1 class="font-bold text-lg text-white tracking-tight">Auto Team Hub</h1>
                            <p class="text-xs text-white/70">${role === 'user' ? '用户中心' : '管理控制台'}</p>
                        </div>
                    </div>
                </div>

                <!-- 菜单 -->
                <nav class="flex-1 py-4 space-y-1 overflow-y-auto px-3">
                    ${menus.map(menu => this.renderMenuItem(menu)).join('')}
                </nav>

                <!-- 底部退出按钮 -->
                <div class="p-4 border-t border-white/20">
                    <button onclick="SidebarComponent.logout()" 
                            class="w-full px-4 py-3 rounded-lg flex items-center space-x-3 text-red-300 hover:text-red-200 hover:bg-red-900/30 transition-all group">
                        <i class="fas fa-sign-out-alt w-5 text-center group-hover:scale-110 transition-transform"></i>
                        <span>退出登录</span>
                    </button>
                </div>
            </div>
        `;

        // 根据当前页面自动设置激活状态
        this.autoActivate();
    },

    /**
     * 获取菜单配置
     */
    getMenus(role) {
        const commonMenus = [
            { 
                id: 'dashboard', 
                label: '仪表板', 
                icon: 'fa-th-large', 
                path: role === 'user' ? '/user/index.html' : '/admin/index.html' 
            }
        ];

        if (role === 'user') {
            return [
                ...commonMenus,
                { id: 'tasks', label: '我的任务', icon: 'fa-tasks', path: '/user/index.html#tasks' },
                { id: 'overtime', label: '加班记录', icon: 'fa-clock', path: '/user/index.html#overtime' },
                { id: 'profile', label: '个人信息', icon: 'fa-user', path: '/user/index.html#profile' }
            ];
        }

        // admin / super_admin 菜单
        const adminMenus = [
            { id: 'personnel', label: '人员管理', icon: 'fa-users', path: '/admin/personnel.html' },
            { id: 'cases', label: 'Test Case', icon: 'fa-clipboard-check', path: '/admin/cases.html' },
            { id: 'equipment', label: '设备资源', icon: 'fa-server', path: '/admin/equipment.html' },
            { id: 'overtime', label: '加班管控', icon: 'fa-clock', path: '/admin/overtime.html' },
            { id: 'inventory', label: '物料管理', icon: 'fa-boxes', path: '/admin/inventory.html' }
        ];

        if (role === 'super_admin') {
            adminMenus.push({ 
                id: 'settings', 
                label: '系统设置', 
                icon: 'fa-cog', 
                path: '/admin/settings.html' 
            });
        }

        return [...commonMenus, ...adminMenus];
    },

    /**
     * 渲染单个菜单项
     */
    renderMenuItem(menu) {
        const isActive = this.activeMenu === menu.id;
        
        return `
            <a href="${menu.path}" 
               data-menu-id="${menu.id}"
               class="nav-item flex items-center px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all ${isActive ? 'active bg-white/20 text-white' : ''}"
               onclick="SidebarComponent.handleClick('${menu.id}', event)">
                <i class="fas ${menu.icon} w-5 text-center mr-3"></i>
                <span>${menu.label}</span>
                ${menu.badge ? `<span class="ml-auto bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">${menu.badge}</span>` : ''}
            </a>
        `;
    },

    /**
     * 处理菜单点击
     */
    handleClick(menuId, event) {
        const href = event.currentTarget.getAttribute('href');
        
        // 如果是锚点导航（#），允许默认行为
        if (href.includes('#')) {
            this.setActive(menuId);
            return true;
        }
        
        // 普通页面跳转，手动处理
        event.preventDefault();
        this.setActive(menuId);
        window.location.href = href;
    },

    /**
     * 设置激活状态
     */
    setActive(menuId) {
        this.activeMenu = menuId;
        this.highlightActive();
    },

    /**
     * 高亮当前菜单
     */
    highlightActive() {
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('active', 'bg-white/20', 'text-white');
            el.classList.add('text-white/80');
            
            if (el.dataset.menuId === this.activeMenu) {
                el.classList.add('active', 'bg-white/20', 'text-white');
                el.classList.remove('text-white/80');
            }
        });
    },

    /**
     * 根据当前页面自动设置激活
     */
    autoActivate() {
        const path = window.location.pathname;
        const hash = window.location.hash.slice(1);
        
        // 优先匹配 hash
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

    /**
     * 退出登录
     */
    async logout() {
        // 使用原生 confirm，不依赖 Utils
        if (!confirm('确定要退出登录吗？')) {
            return;
        }

        try {
            // 清除本地存储的过滤条件等临时数据
            localStorage.removeItem('overtime_filter_user');
            
            // 调用 Supabase 退出
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                console.error('Sign out error:', error);
                alert('退出失败：' + error.message);
                return;
            }

            // 跳转到登录页
            window.location.href = '/auth/login.html';
            
        } catch (err) {
            console.error('Logout exception:', err);
            alert('退出时发生错误，请刷新页面重试');
        }
    }
};

// 导出到全局
window.SidebarComponent = SidebarComponent;
