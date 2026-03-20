/**
 * Auto Team Hub - 通用工具函数
 */

const Utils = {
    // ==========================================
    // 日期时间处理
    // ==========================================
    
    // 格式化日期
    formatDate(date, format = 'YYYY-MM-DD') {
        if (!date) return '-';
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);
    },

    // 格式化时间
    formatTime(date) {
        if (!date) return '-';
        const d = new Date(date);
        return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    },

    // 格式化日期时间
    formatDateTime(date) {
        if (!date) return '-';
        return `${this.formatDate(date)} ${this.formatTime(date)}`;
    },

    // 相对时间（几分钟前）
    timeAgo(date) {
        const now = new Date();
        const past = new Date(date);
        const diff = Math.floor((now - past) / 1000);

        if (diff < 60) return '刚刚';
        if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
        
        return this.formatDate(date);
    },

    // 获取本周开始日期
    getWeekStart() {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(now.setDate(diff));
    },

    // 获取本月开始日期
    getMonthStart() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    },

    // ==========================================
    // 数据处理
    // ==========================================

    // 深拷贝
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // 对象转FormData
    toFormData(obj) {
        const formData = new FormData();
        Object.entries(obj).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, value);
            }
        });
        return formData;
    },

    // 数组分组
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key];
            result[group] = result[group] || [];
            result[group].push(item);
            return result;
        }, {});
    },

    // 数组去重
    unique(array, key) {
        if (key) {
            const seen = new Set();
            return array.filter(item => {
                const val = item[key];
                if (seen.has(val)) return false;
                seen.add(val);
                return true;
            });
        }
        return [...new Set(array)];
    },

    // 搜索过滤
    filterByKeyword(array, keyword, fields) {
        if (!keyword) return array;
        const lower = keyword.toLowerCase();
        return array.filter(item => 
            fields.some(field => 
                String(item[field] || '').toLowerCase().includes(lower)
            )
        );
    },

    // 排序
    sortBy(array, key, ascending = true) {
        return [...array].sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            if (aVal < bVal) return ascending ? -1 : 1;
            if (aVal > bVal) return ascending ? 1 : -1;
            return 0;
        });
    },

    // ==========================================
    // Excel/CSV 处理
    // ==========================================

    // CSV转JSON（简单版）
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, i) => {
                obj[h] = values[i] || '';
            });
            return obj;
        }).filter(obj => Object.values(obj).some(v => v));
    },

    // JSON转CSV
    toCSV(data, headers = null) {
        if (!data || !data.length) return '';
        
        const cols = headers || Object.keys(data[0]);
        const headerRow = cols.join(',');
        
        const rows = data.map(row => 
            cols.map(col => {
                const val = row[col];
                // 处理逗号和引号
                if (val === null || val === undefined) return '';
                const str = String(val);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',')
        );
        
        return [headerRow, ...rows].join('\n');
    },

    // 下载CSV
    downloadCSV(data, filename = 'export.csv') {
        const csv = this.toCSV(data);
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        this.downloadBlob(blob, filename);
    },

    // 下载JSON
    downloadJSON(data, filename = 'export.json') {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        this.downloadBlob(blob, filename);
    },

    // 通用下载
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // 读取文件
    readFile(file, type = 'text') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            
            if (type === 'dataurl') reader.readAsDataURL(file);
            else if (type === 'arraybuffer') reader.readAsArrayBuffer(file);
            else reader.readAsText(file);
        });
    },

    // ==========================================
    // UI 工具
    // ==========================================

    // 显示提示
    toast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${this.getToastIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // 动画
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });
        
        // 自动移除
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
        return container;
    },

    getToastIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    },

    // 确认对话框
    confirm(message, title = '确认') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <h3 class="text-xl font-bold text-white mb-4">${title}</h3>
                    <p class="text-slate-300 mb-6">${message}</p>
                    <div class="flex justify-end gap-3">
                        <button class="btn btn-secondary" id="btn-cancel">取消</button>
                        <button class="btn btn-danger" id="btn-confirm">确认</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector('#btn-cancel').onclick = () => {
                modal.remove();
                resolve(false);
            };
            
            modal.querySelector('#btn-confirm').onclick = () => {
                modal.remove();
                resolve(true);
            };
            
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(false);
                }
            };
        });
    },

    // 加载状态
    setLoading(element, loading = true) {
        if (loading) {
            element.dataset.originalText = element.innerHTML;
            element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载中...';
            element.disabled = true;
        } else {
            element.innerHTML = element.dataset.originalText || element.innerHTML;
            element.disabled = false;
        }
    },

    // 表单验证
    validateForm(formElement, rules = {}) {
        const errors = {};
        const data = new FormData(formElement);
        const values = Object.fromEntries(data);
        
        Object.entries(rules).forEach(([field, rule]) => {
            const value = values[field];
            
            if (rule.required && !value) {
                errors[field] = rule.message || '此项必填';
            }
            
            if (value && rule.min && value.length < rule.min) {
                errors[field] = `最少${rule.min}个字符`;
            }
            
            if (value && rule.max && value.length > rule.max) {
                errors[field] = `最多${rule.max}个字符`;
            }
            
            if (value && rule.pattern && !rule.pattern.test(value)) {
                errors[field] = rule.message || '格式不正确';
            }
            
            if (value && rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                errors[field] = '邮箱格式不正确';
            }
        });
        
        return {
            valid: Object.keys(errors).length === 0,
            errors,
            values
        };
    },

    // 显示表单错误
    showFormErrors(formElement, errors) {
        // 清除旧错误
        formElement.querySelectorAll('.error-message').forEach(el => el.remove());
        formElement.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        
        // 显示新错误
        Object.entries(errors).forEach(([field, message]) => {
            const input = formElement.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('error');
                const errorEl = document.createElement('span');
                errorEl.className = 'error-message';
                errorEl.style.cssText = 'color: #ef4444; font-size: 0.75rem; margin-top: 0.25rem; display: block;';
                errorEl.textContent = message;
                input.parentNode.appendChild(errorEl);
            }
        });
    },

    // ==========================================
    // 路由/导航
    // ==========================================

    // 跳转（带权限检查）
    async navigate(path) {
        const role = API.auth.getRole();
        
        // 检查权限
        if (path.startsWith('/admin') && role === 'user') {
            this.toast('无权访问', 'error');
            return;
        }
        
        if (path.startsWith('/user') && role !== 'user') {
            window.location.href = '/admin/index.html';
            return;
        }
        
        window.location.href = path;
    },

    // 获取URL参数
    getQueryParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    },

    // 设置URL参数（不跳转）
    setQueryParam(name, value) {
        const url = new URL(window.location.href);
        url.searchParams.set(name, value);
        window.history.replaceState({}, '', url);
    },

    // ==========================================
    // 本地存储
    // ==========================================

    storage: {
        prefix: 'auto_team_hub_',
        
        get(key) {
            try {
                const item = localStorage.getItem(this.prefix + key);
                return item ? JSON.parse(item) : null;
            } catch {
                return null;
            }
        },
        
        set(key, value) {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
        },
        
        remove(key) {
            localStorage.removeItem(this.prefix + key);
        },
        
        clear() {
            Object.keys(localStorage)
                .filter(k => k.startsWith(this.prefix))
                .forEach(k => localStorage.removeItem(k));
        }
    },

    // ==========================================
    // 其他工具
    // ==========================================

    // 防抖
    debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    // 节流
    throttle(fn, limit = 300) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // 生成随机ID
    generateId(prefix = '') {
        return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    // 文件大小格式化
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // 数字千分位
    formatNumber(num) {
        return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
    },

    // 百分比
    formatPercent(value, total) {
        if (!total) return '0%';
        return Math.round((value / total) * 100) + '%';
    }
};

// 导出
window.Utils = Utils;
