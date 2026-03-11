// 从全局变量获取 Vue 和 Supabase
const { createApp, ref, computed, onMounted } = Vue;
const { createClient } = supabase;

// ==================== 配置区（修改这里）====================
// 把您 Supabase 项目的信息填在这里：
const SUPABASE_URL = 'https://dlwypgzfoldhzajbnaxv.supabase.co';  // ← 修改
const SUPABASE_KEY = 'sb_publishable_jU_gprs9slrLe2o-GS1T-g_4kNreKy3';                      // ← 修改
const ADMIN_URL = 'https://auto-team-hub.vercel.app'; // ← 部署管理员后台后修改

// 创建 Supabase 客户端
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==================== 路由系统（简单版）====================
// 不用 vue-router，自己写一个简易路由
const routes = {
    '/login': 'Login',
    '/dashboard': 'Dashboard',
    '/personnel': 'Personnel',
    '/equipment': 'Equipment',
    '/cases': 'Cases',
    '/inventory': 'Inventory',
    '/activities': 'Activities',
    '/profile': 'Profile'
};

// 当前页面状态
const currentPage = ref(window.location.pathname);
const user = ref(null);
const isLoading = ref(true);

// 检查登录状态
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        // 获取用户信息
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        user.value = { ...session.user, ...profile };
        
        // 如果是管理员，跳转到后台
        if (profile?.role === 'admin') {
            window.location.href = ADMIN_URL;
            return;
        }
    }
    
    isLoading.value = false;
    
    // 未登录且不在登录页，强制跳转
    if (!session && currentPage.value !== '/login') {
        navigateTo('/login');
    }
}

// 跳转函数
function navigateTo(path) {
    window.history.pushState({}, '', path);
    currentPage.value = path;
}

// 监听浏览器前进后退
window.addEventListener('popstate', () => {
    currentPage.value = window.location.pathname;
});

// ==================== 创建 Vue 应用 ====================
const app = createApp({
    setup() {
        onMounted(checkAuth);
        
        return {
            currentPage,
            user,
            isLoading,
            supabase: supabaseClient
        };
    },
    
    // 动态渲染不同页面
    template: `
        <div v-if="isLoading" class="min-h-screen flex items-center justify-center">
            <div class="text-blue-400">加载中...</div>
        </div>
        
        <template v-else>
            <!-- 登录页不需要侧边栏 -->
            <login-page 
                v-if="currentPage === '/login'" 
                @login-success="checkAuth"
                :supabase="supabase">
            </login-page>
            
            <!-- 其他页面需要布局 -->
            <app-layout 
                v-else 
                :current-page="currentPage"
                :user="user"
                @navigate="navigateTo"
                @logout="handleLogout">
                
                <!-- 根据当前页面显示不同内容 -->
                <dashboard-page v-if="currentPage === '/dashboard'" :supabase="supabase"></dashboard-page>
                <personnel-page v-else-if="currentPage === '/personnel'" :supabase="supabase"></personnel-page>
                <equipment-page v-else-if="currentPage === '/equipment'" :supabase="supabase"></equipment-page>
                <cases-page v-else-if="currentPage === '/cases'" :supabase="supabase"></cases-page>
                <inventory-page v-else-if="currentPage === '/inventory'" :supabase="supabase"></inventory-page>
                
                <div v-else class="glass-card p-8 text-center text-gray-400">
                    页面开发中...
                </div>
            </app-layout>
        </template>
    `
});

// 注册全局方法
app.config.globalProperties.$navigate = navigateTo;
