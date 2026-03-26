/**
 * Auto Team Hub - 侧边栏组件
 */

const SidebarComponent = {
    activeMenu: '',

    render(containerId = 'sidebar', role = 'user') {
        const container = document.getElementById(containerId);
        if (!container) return;

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

        this.autoActivate();
    },

    getMenus(role) {
        const commonMenus = [
            { 
                id: 'dashboard', 
                label: '仪表板', 
                icon: 'fa-th-large', 
                path: role === 'user' ? '/public/user/index.html' : '/public/admin/index.html' 
            }
        ];

        if (role === 'user') {
            return [
                ...commonMenus,
                { id: 'tasks', label: '我的任务', icon: 'fa-tasks', path: '/public/user/index.html#tasks' },
                { id: 'overtime', label: '加班记录', icon: 'fa-clock', path: '/public/user/index.html#overtime' },
                { id: 'profile', label: '个人信息', icon: 'fa-user', path: '/public/user/index.html#profile' }
            ];
        }

        const adminMenus = [
            { id: 'personnel', label: '人员管理', icon: 'fa-users', path: '/public/admin/personnel.html' },
            { id: 'cases', label: 'Test Case', icon: 'fa-clipboard-check', path: '/public/admin/cases.html' },
            { id: 'equipment', label: '设备资源', icon: 'fa-server', path: '/public/admin/equipment.html' },
            { id: 'overtime', label: '加班管控', icon: 'fa-clock', path: '/public/admin/overtime.html' },
            { id: 'inventory', label: '物料管理', icon: 'fa-boxes', path: '/public/admin/inventory.html' }
        ];

        if (role === 'super_admin') {
            adminMenus.push({ 
                id: 'settings', 
                label: '系统设置', 
                icon: 'fa-cog', 
                path: '/public/admin/settings.html' 
            });
        }

        return [...commonMenus, ...adminMenus];
    },

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

    handleClick(menuId, event) {
        const href = event.currentTarget.getAttribute('href');
        
        if (href.includes('#')) {
            this.setActive(menuId);
            return true;
        }
        
        event.preventDefault();
        this.setActive(menuId);
        window.location.href = href;
    },

    setActive(menuId) {
        this.activeMenu = menuId;
        this.highlightActive();
    },

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

    autoActivate() {
        const path = window.location.pathname;
        const hash = window.location.hash.slice(1);
        
        if (hash) {
            this.setActive(hash);
            return;
        }
        
        const menuMap = {
            '/public/user/index.html': 'dashboard',
            '/public/admin/index.html': 'dashboard',
            '/public/admin/personnel.html': 'personnel',
            '/public/admin/cases.html': 'cases',
            '/public/admin/equipment.html': 'equipment',
            '/public/admin/overtime.html': 'overtime',
            '/public/admin/inventory.html': 'inventory',
            '/public/admin/settings.html': 'settings'
        };
        
        const menuId = menuMap[path] || 'dashboard';
        this.setActive(menuId);
    },

    // ✅ 关键修复：跳转到根目录的登录页
    async logout() {
        if (!confirm('确定要退出登录吗？')) {
            return;
        }

        try {
            localStorage.removeItem('overtime_filter_user');
            
            const { error } = await supabase.auth.signOut();
            
            if (error) {
                console.error('Sign out error:', error);
            }

            // ✅ 根据您的项目结构，跳转到根目录的登录页
            // 方式1：绝对路径（如果部署在域名根目录）
            window.location.href = '/index.html';
            
            // 方式2：相对路径（从 public/admin/ 或 public/user/ 回到根目录）
            // window.location.href = '../../index.html';
            
        } catch (err) {
            console.error('Logout exception:', err);
            window.location.href = '/index.html';
        }
    }
};

window.SidebarComponent = SidebarComponent;
