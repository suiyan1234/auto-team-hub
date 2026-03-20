/**
 * Auto Team Hub - 图表主题配置
 * 统一Chart.js样式，改这里全站图表生效
 */

const ChartConfig = {
    // 默认配色方案
    colors: {
        primary: ['#3b82f6', '#06b6d4', '#8b5cf6', '#f97316', '#10b981', '#ef4444'],
        department: {
            software: '#3b82f6',   // 蓝
            hardware: '#10b981',   // 绿
            automation: '#8b5cf6', // 紫
            robotics: '#f97316',   // 橙
            management: '#64748b'  // 灰
        },
        status: {
            online: '#10b981',      // 在线-绿
            busy: '#f59e0b',        // 忙碌-黄
            offline: '#64748b',     // 离线-灰
            running: '#3b82f6',     // 运行中-蓝
            idle: '#10b981',        // 空闲-绿
            maintenance: '#ef4444', // 维护中-红
            todo: '#64748b',        // 待执行-灰
            progress: '#3b82f6',    // 进行中-蓝
            done: '#10b981',        // 已完成-绿
            warning: '#f97316',     // 警告-橙
            danger: '#ef4444',      // 危险-红
            critical: '#dc2626'     // 严重-深红
        },
        alert: {
            info: '#3b82f6',
            warning: '#f97316',
            danger: '#ef4444',
            success: '#10b981'
        }
    },

    // Chart.js 默认配置
    defaults: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: '#94a3b8',
                    font: { family: 'Inter, sans-serif', size: 12 },
                    usePointStyle: true,
                    padding: 20
                }
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#e2e8f0',
                bodyColor: '#94a3b8',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                displayColors: true
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255,255,255,0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#94a3b8',
                    font: { family: 'Inter, sans-serif', size: 11 }
                }
            },
            y: {
                grid: {
                    color: 'rgba(255,255,255,0.05)',
                    drawBorder: false
                },
                ticks: {
                    color: '#94a3b8',
                    font: { family: 'Inter, sans-serif', size: 11 }
                }
            }
        },
        animation: {
            duration: 750,
            easing: 'easeOutQuart'
        }
    },

    // 图表类型特定配置
    types: {
        // 柱状图（部门统计等）
        bar: {
            borderRadius: 6,
            borderSkipped: false,
            barPercentage: 0.7,
            categoryPercentage: 0.8
        },

        // 折线图（趋势等）
        line: {
            tension: 0.4,  // 平滑曲线
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#0f172a',
            pointBorderWidth: 2,
            fill: true
        },

        // 饼图/环形图（占比等）
        doughnut: {
            cutout: '60%',
            borderWidth: 0,
            hoverOffset: 4
        },

        // 雷达图（能力评估等）
        radar: {
            borderWidth: 2,
            pointRadius: 3,
            angleLines: { color: 'rgba(255,255,255,0.1)' },
            gridLines: { color: 'rgba(255,255,255,0.1)' },
            pointLabels: { color: '#94a3b8' }
        },

        // 散点图（人效矩阵等）
        scatter: {
            pointRadius: 8,
            pointHoverRadius: 10
        }
    },

    // 预设图表配置（直接使用）
    presets: {
        // 部门加班统计柱状图（参考你提供的图片样式）
        deptOvertime: {
            type: 'bar',
            options: {
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '加班时长（小时）',
                            color: '#64748b'
                        }
                    }
                }
            }
        },

        // 个人加班趋势
        personalOvertime: {
            type: 'line',
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true }
                },
                elements: {
                    line: { borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)' }
                }
            }
        },

        // 测试类型占比
        testTypePie: {
            type: 'doughnut',
            options: {
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12 }
                    }
                }
            }
        },

        // 设备稼动率
        equipmentUtilization: {
            type: 'bar',
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { max: 100, ticks: { callback: v => v + '%' } }
                }
            }
        },

        // 人效分析矩阵（散点图）
        efficiencyMatrix: {
            type: 'scatter',
            options: {
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const p = ctx.raw;
                                return `${p.name}: 加班${p.x}h, 产出${p.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: '加班时长（小时）', color: '#64748b' }
                    },
                    y: {
                        title: { display: true, text: '产出效率', color: '#64748b' }
                    }
                }
            }
        }
    },

    // 创建图表的工厂方法
    create(ctx, type, data, customOptions = {}) {
        const baseConfig = {
            type: this.types[type] ? type : 'bar',
            data: data,
            options: {
                ...this.defaults,
                ...(this.types[type] || {}),
                ...customOptions
            }
        };

        // 深度合并options
        if (customOptions.scales) {
            baseConfig.options.scales = {
                x: { ...this.defaults.scales.x, ...(customOptions.scales.x || {}) },
                y: { ...this.defaults.scales.y, ...(customOptions.scales.y || {}) }
            };
        }

        return new Chart(ctx, baseConfig);
    },

    // 使用预设创建
    createPreset(ctx, presetName, data, customOptions = {}) {
        const preset = this.presets[presetName];
        if (!preset) throw new Error(`Unknown preset: ${presetName}`);

        return this.create(ctx, preset.type, data, {
            ...preset.options,
            ...customOptions
        });
    },

    // 更新图表数据
    update(chart, newData) {
        chart.data = newData;
        chart.update('active');
    },

    // 销毁图表（防止内存泄漏）
    destroy(chart) {
        if (chart) {
            chart.destroy();
        }
    }
};

// 导出
window.ChartConfig = ChartConfig;
