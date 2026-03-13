/**
 * Auto Team Hub - 系统基础配置
 * 修改场景：换系统名称、改API地址、调整分页等
 */

const AppConfig = {
    // 系统信息
    app: {
        name: 'Auto Team Hub',
        subtitle: '综合测试自动化中心',
        version: '1.0.0',
        logo: '/assets/images/logo.png',  // 如没有logo，使用文字
        favicon: '/assets/icons/favicon.ico'
    },

    // Supabase 配置（必须修改为你的项目信息）
    supabase: {
        url: 'https://your-project.supabase.co',      // ← 修改这里
        anonKey: 'your-anon-key-here',                 // ← 修改这里
        // 服务密钥（仅服务端使用，前端不需要）
        // serviceKey: 'your-service-role-key'
    },

    // 分页配置
    pagination: {
        defaultPageSize: 10,
        pageSizeOptions: [10, 20, 50, 100]
    },

    // 日期时间格式
    dateFormat: {
        date: 'YYYY-MM-DD',
        time: 'HH:mm',
        datetime: 'YYYY-MM-DD HH:mm',
        display: {
            date: (d) => new Date(d).toLocaleDateString('zh-CN'),
            time: (d) => new Date(d).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'}),
            datetime: (d) => new Date(d).toLocaleString('zh-CN')
        }
    },

    // 文件上传限制
    upload: {
        maxSize: 10 * 1024 * 1024,  // 10MB
        allowedTypes: {
            excel: ['.xlsx', '.xls', '.csv'],
            image: ['.png', '.jpg', '.jpeg', '.gif'],
            document: ['.pdf', '.doc', '.docx']
        }
    },

    // 超时配置（毫秒）
    timeout: {
        api: 30000,      // API请求超时
        toast: 3000,     // 提示显示时间
        session: 3600000 // 会话过期时间（1小时）
    },

    // 本地存储键名
    storage: {
        prefix: 'auto_team_hub_',
        keys: {
            user: 'user',
            token: 'token',
            settings: 'settings',
            cache: 'cache'
        }
    },

    // 功能开关
    features: {
        realtime: true,      // 开启实时订阅
        offlineCache: true,  // 开启离线缓存
        notification: true,  // 开启浏览器通知
        analytics: false     // 开启分析（如需要）
    },

    // 部门配置（与数据库dept字段对应）
    departments: {
        software: { label: '软件测试', color: '#3b82f6', icon: 'fa-code' },
        hardware: { label: '硬件测试', color: '#10b981', icon: 'fa-microchip' },
        automation: { label: '自动化测试', color: '#8b5cf6', icon: 'fa-robot' },
        robotics: { label: '机械臂研究', color: '#f97316', icon: 'fa-hand-rock' },
        management: { label: '管理', color: '#64748b', icon: 'fa-users-cog' }
    },

    // 设备类型配置
    equipmentTypes: {
        thermal: { label: '温箱', icon: 'fa-temperature-high' },
        power: { label: '电源/功耗', icon: 'fa-bolt' },
        rf: { label: 'RF/屏蔽室', icon: 'fa-broadcast-tower' },
        mechanical: { label: '机械测试', icon: 'fa-cogs' },
        automation: { label: '自动化设备', icon: 'fa-microchip' },
        robotic_arm: { label: '机械臂', icon: 'fa-robot' }
    },

    // Case优先级配置
    priorities: {
        urgent: { label: '紧急', color: '#ef4444', bg: 'bg-red-500/20' },
        high: { label: '高', color: '#f97316', bg: 'bg-orange-500/20' },
        medium: { label: '中', color: '#f59e0b', bg: 'bg-yellow-500/20' },
        low: { label: '低', color: '#3b82f6', bg: 'bg-blue-500/20' }
    },

    // Case状态配置
    caseStatus: {
        todo: { label: '待执行', color: '#64748b', icon: 'fa-circle' },
        progress: { label: '进行中', color: '#3b82f6', icon: 'fa-spinner fa-spin' },
        done: { label: '已完成', color: '#10b981', icon: 'fa-check-circle' },
        cancelled: { label: '已取消', color: '#94a3b8', icon: 'fa-times-circle' }
    },

    // 物料分类
    inventoryCategories: {
        '耗材': { icon: 'fa-box-open', color: '#3b82f6' },
        '治具': { icon: 'fa-tools', color: '#10b981' },
        '工具': { icon: 'fa-wrench', color: '#f59e0b' },
        '线材': { icon: 'fa-plug', color: '#8b5cf6' },
        '电子元件': { icon: 'fa-microchip', color: '#f97316' },
        '其他': { icon: 'fa-box', color: '#64748b' }
    },

    // 加班类型
    overtimeTypes: {
        weekday: { label: '工作日', multiplier: 1.5 },
        weekend: { label: '周末', multiplier: 2.0 },
        holiday: { label: '节假日', multiplier: 3.0 }
    },

    // 预警阈值（与数据库system_settings对应）
    thresholds: {
        overtime: {
            daily: 4,    // 单日预警
            weekly: 20,  // 周预警
            monthly: 40  // 月上限
        },
        inventory: {
            critical: 0,  // 库存为0
            warning: 1.0  // 低于阈值倍数
        },
        equipment: {
            idleTimeout: 30  // 空闲30分钟
        }
    },

    // 快捷操作
    shortcuts: {
        'Ctrl+K': '打开搜索',
        'Ctrl+N': '新建记录',
        'Ctrl+R': '刷新数据',
        'Ctrl+S': '保存',
        'Esc': '关闭弹窗'
    }
};

// 冻结配置防止运行时修改
Object.freeze(AppConfig);
Object.freeze(AppConfig.app);
Object.freeze(AppConfig.supabase);
Object.freeze(AppConfig.departments);
Object.freeze(AppConfig.equipmentTypes);

// 导出
window.AppConfig = AppConfig;
