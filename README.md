# 📈 wkl's Analysis of A-share data

> 一个轻量级的 A 股数据分析网站，提供大盘走势、资金流向、板块分析三大核心功能。
>
> 🔗 在线访问：https://2432448868.github.io/stock-frontend/

---

## 目录

- [功能展示](#-功能展示)
- [技术架构](#-技术架构)
- [核心技术实现](#-核心技术实现)
- [数据流详解](#-数据流详解)
- [项目文件结构](#-项目文件结构)
- [部署指南](#-部署指南)
- [开发踩坑记录](#-开发踩坑记录)
- [优化方向](#-优化方向)
- [待开发功能](#-待开发功能)
- [技术栈](#-技术栈)

---

## 🎯 功能展示

### 📈 大盘走势

实时展示 A 股三大指数（上证指数、深证成指、创业板指）的行情数据。

| 特性 | 说明 |
|------|------|
| **指数卡片** | 实时显示最新点位、涨跌额、涨跌幅，点击切换 K 线 |
| **日 K 线图** | 近 120 个交易日的蜡烛图 + 成交量，红涨绿跌 |
| **周 K 线图** | 近 52 周的蜡烛图，适合看中长期趋势 |
| **分时图** | 当日 240 条 1 分钟数据，折线面积图 |
| **图表交互** | 底部滑块缩放拖拽，鼠标悬停十字准星 tooltip |
| **数据来源** | JSONP 直连东方财富 K 线 API，**真正实时** |

### 💰 资金流向

展示行业/概念板块的主力资金净流入排行。

| 特性 | 说明 |
|------|------|
| **资金概览** | 主力净流入总额、流入/流出总额、上涨/下跌板块数 |
| **排行表格** | 按主力净流入降序，展示净流入金额、占比、超大单/大单明细 |
| **可视化** | 资金流向柱状条，红流入绿流出，长度按比例 |
| **维度切换** | 行业资金流 / 概念资金流两个 Tab |
| **更新频率** | 每 15 分钟（GitHub Actions 定时抓取） |

### 📊 板块分析

全量 A 股板块涨跌排行，支持搜索和排序。

| 特性 | 说明 |
|------|------|
| **全量数据** | 行业板块 496 个、概念板块 495 个、地域板块 31 个 |
| **市场概览** | 板块总数、上涨/下跌/平盘数、平均涨幅、最强/最弱板块 |
| **搜索过滤** | 实时搜索板块名称或代码，300ms 防抖 |
| **列排序** | 点击表头按涨跌幅/涨跌额/上涨数/下跌数/总市值排序 |
| **领涨股** | 每个板块显示领涨股名称 + 个股涨跌幅 |
| **涨跌着色** | 行背景红涨绿跌渐变，涨幅越大颜色越深 |

### 🧠 市场洞察

基于规则引擎的智能分析面板（零 API 成本），打开首页即显示市场体检报告：

| 模块 | 说明 |
|------|------|
| **🌡️ 市场温度** | 0-100° 温度值 + 温度条，过热/偏暖/中性/偏冷/冰点五档 |
| **💰 主力资金** | 净流入/流出总额 + 多空判断 |
| **🏆 强势 TOP5** | 涨幅最大的 5 个板块 + 领涨股 |
| **💀 弱势 TOP5** | 跌幅最大的 5 个板块 |
| **🧲 资金最爱/最弃** | 主力净流入/流出 TOP5 |
| **🔄 轮动信号** | 蓄势板块（资金进但没涨）+ 获利了结（涨了但资金跑） |
| **⚠️ 风险提示** | 极端涨跌、单边行情、资金集中度、主力撤退预警 |

### 🌓 其他特性

| 特性 | 说明 |
|------|------|
| **明暗主题** | 右上角 🌙/☀️ 一键切换，跟随系统偏好，localStorage 持久化 |
| **自动刷新** | 交易时间（北京时间 9:15-15:05 工作日），15~45 分钟随机间隔 |
| **响应式** | 768px 断点，移动端自动隐藏次要列 |
| **Favicon** | SVG 蓝色折线图图标，深色底色，跟主题统一 |
| **数据校验** | 异常数据自动拦截（涨跌停超限/字段缺失/格式错误） |
| **错误降级** | 网络失败时自动显示 localStorage 缓存数据 + 过期提示 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                          数据获取层                               │
│                                                                 │
│  ① GitHub Actions 定时抓取（每 15 分钟）                           │
│     fetch-data.js → 东方财富 push2 API → data/*.json             │
│     git commit & push → 触发 Pages 自动重新部署                    │
│                                                                 │
│  ② JSONP 直连（前端浏览器）                                        │
│     push2his.eastmoney.com → K 线数据 → 实时渲染 ECharts           │
│                                                                 │
│  ③ Cloudflare Worker（已部署，因 502 暂未启用）                     │
│     KV 缓存 10s TTL → 东方财富 API → REST 接口                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          前端展示层                               │
│                                                                 │
│  纯静态 HTML + CSS + JS（单文件 ~640 行）                          │
│  ECharts 5（CDN 引入）                                           │
│  部署：GitHub Pages（push to main 自动部署）                       │
│                                                                 │
│  ● 大盘走势 → JSONP 实时拉取 K 线数据                              │
│  ● 资金流向 → fetch data/capital-*.json                          │
│  ● 板块分析 → fetch data/*.json + 搜索/排序                       │
│  ● 明暗主题切换（CSS 变量 + localStorage）                         │
└─────────────────────────────────────────────────────────────────┘
```

### 为什么选择这个架构？

**决策过程**：

1. **最初方案**：前端直接调东方财富 API → 被 CORS 拦截
2. **尝试 Vercel**：Vercel Serverless Functions 做代理 → 能用但想换平台
3. **尝试 Cloudflare Worker**：Worker 代理 + KV 缓存 → 东方财富返回 502（封了云服务器 IP）
4. **最终方案**：GitHub Actions 抓取 → 静态 JSON → GitHub Pages 部署

**核心原因**：东方财富的 push2 API **封禁了云服务器 IP**（Cloudflare、Vercel 等），但 **GitHub Actions 的 Azure IP 没被封**。所以用 GitHub Actions 作为"中间人"抓取数据，存成静态 JSON 文件，前端直接读。

**K 线例外**：K 线 API（`push2his.eastmoney.com`）支持 JSONP 回调，浏览器可以直接调用，所以大盘走势是真正的实时数据。

---

## 🔧 核心技术实现

### 1. 数据抓取脚本（fetch-data.js）

**运行环境**：Node.js 20（GitHub Actions 托管）

**数据源**：`https://push2.eastmoney.com/api/qt/clist/get`

**分页机制**：东方财富 API 单页上限 100 条，通过 `pn`（页码）参数循环翻页，合并全量数据。

```javascript
// 分页抓取逻辑
while (allItems.length < total) {
  const { items, total } = await fetchPage(filterStr, fid, sort, fields, 100, page);
  allItems = allItems.concat(items);
  if (items.length < 100) break;  // 最后一页
  page++;
}
```

**抓取内容**：

| 数据类型 | 输出文件 | 数量 | 排序方式 |
|----------|---------|------|---------|
| 行业板块 | `industry.json` | 496 条 | 按涨跌幅降序 |
| 概念板块 | `concept.json` | 495 条 | 按涨跌幅降序 |
| 地域板块 | `region.json` | 31 条 | 按涨跌幅降序 |
| 行业资金流 | `capital-industry.json` | 100 条 | 按主力净流入降序 |
| 概念资金流 | `capital-concept.json` | 100 条 | 按主力净流入降序 |

**板块数据字段映射**：

| 东方财富字段 | 含义 | 说明 |
|-------------|------|------|
| `f12` | 板块代码 | 如 `BK1572` |
| `f14` | 板块名称 | 如 `油气及炼化工程` |
| `f2` | 最新价 | 原始值需 `/100` |
| `f3` | 涨跌幅 | 原始值需 `/100`，单位 % |
| `f4` | 涨跌额 | 原始值需 `/100` |
| `f5` | 成交量 | 原始值 |
| `f6` | 成交额 | 原始值 |
| `f8` | 换手率 | ⚠️ 板块接口不返回此字段（为 null） |
| `f15` | 最高价 | 原始值需 `/100` |
| `f16` | 最低价 | 原始值需 `/100` |
| `f17` | 开盘价 | 原始值需 `/100` |
| `f18` | 昨收价 | 原始值需 `/100` |
| `f20` | 总市值 | 单位：元 |
| `f21` | 流通市值 | 单位：元 |
| `f104` | 上涨家数 | 板块内上涨股票数量 |
| `f105` | 下跌家数 | 板块内下跌股票数量 |
| `f106` | 平盘家数 | 板块内平盘股票数量 |
| `f128` | 领涨股名称 | 如 `博迈科` |
| `f136` | 领涨股涨幅 | 原始值需 `/100` |
| `f140` | 领涨股代码 | 如 `603727` |

**资金流向字段映射**：

| 字段 | 含义 | 说明 |
|------|------|------|
| `f62` | 主力净流入 | 单位：元，正值流入负值流出 |
| `f184` | 主力净流入占比 | 单位：% |
| `f66` | 超大单净流入 | 单位：元 |
| `f69` | 超大单净流入占比 | 单位：% |
| `f72` | 大单净流入 | 单位：元 |
| `f75` | 大单净流入占比 | 单位：% |
| `f78` | 中单净流入 | 单位：元 |
| `f81` | 中单净流入占比 | 单位：% |

### 2. 定时任务（GitHub Actions）

**工作流文件**：`.github/workflows/update-stock-data.yml`

```yaml
on:
  schedule:
    - cron: '*/15 1-7 * * 1-5'   # UTC 时间，对应北京时间 9:00-15:00
  workflow_dispatch:                # 支持手动触发
```

**执行流程**：

```
cron 触发（交易时间每 15 分钟）
  → checkout 代码
  → setup Node.js 20
  → node fetch-data.js（抓取东方财富 → 写入 data/*.json）
  → git add data/
  → git diff --staged（检查是否有变更）
  → 有变更 → git commit & push → 触发 Pages 重新部署
  → 无变更 → 跳过（避免无效部署）
```

**频率选择依据**：

| 频率 | 请求量/天 | IP 封禁风险 | 数据延迟 |
|------|-----------|-------------|----------|
| 5 分钟 | ~1,200 | 中等 | 5 分钟 |
| **15 分钟（当前）** | **~400** | **很低** | **15 分钟** |
| 30 分钟 | ~200 | 几乎没有 | 30 分钟 |

选择 15 分钟的理由：
- GitHub Actions 的 IP 是 Azure 共享 IP，经常轮换，被封风险低
- 400 次/天的请求量对东方财富来说微不足道
- 15 分钟延迟对板块级别的分析完全够用
- 每月约 200 分钟 Actions 时间，远在免费额度（2000 分钟）内

### 3. 大盘 K 线（JSONP 实时数据）

**为什么 K 线能直连而板块不行？**

| 接口 | 域名 | JSONP 支持 | 浏览器直连 |
|------|------|-----------|-----------|
| K 线 API | `push2his.eastmoney.com` | ✅ 支持 `cb` 回调 | ✅ 可用 |
| 板块 API | `push2.eastmoney.com` | ❌ 不支持 | ❌ CORS 被封 |

**JSONP 实现**：

```javascript
function jsonp(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const cbName = '_jcb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const timer = setTimeout(() => { cleanup(); reject(new Error('JSONP 超时')); }, timeout);
    function cleanup() { clearTimeout(timer); delete window[cbName]; document.getElementById(cbName)?.remove(); }
    window[cbName] = data => { cleanup(); resolve(data); };
    const el = document.createElement('script');
    el.id = cbName;
    el.src = url + (url.includes('?') ? '&' : '?') + 'cb=' + cbName;
    el.onerror = () => { cleanup(); reject(new Error('JSONP 加载失败')); };
    document.head.appendChild(el);
  });
}
```

**K 线 API 参数**：

| 参数 | 值 | 说明 |
|------|-----|------|
| `secid` | `1.000001` | 上证 = `1.` 前缀，深证/创业板 = `0.` 前缀 |
| `klt` | `101` / `102` / `1` | 日K / 周K / 分时 |
| `fqt` | `1` | 前复权 |
| `lmt` | `120` / `52` / `240` | 返回条数 |
| `fields2` | `f51,f52,f53,f54,f55,f56` | 日期,开盘,收盘,最高,最低,成交量 |

**K 线返回数据格式**：

```json
{
  "data": {
    "name": "上证指数",
    "klines": [
      "2026-07-15,3963.73,3955.58,3981.67,3943.70,576209492",
      "2026-07-16,3912.38,3882.41,3940.45,3867.60,535281873"
    ]
  }
}
```

每条 K 线数据格式：`日期, 开盘价, 收盘价, 最高价, 最低价, 成交量`

### 4. ECharts 图表配置

**K 线图（日K/周K）**：

- 蜡烛图（candlestick）：红涨绿跌（`color: #ff4d4f`, `color0: #00b96b`）
- 成交量柱状图：颜色跟随涨跌
- dataZoom 滑块：底部拖拽缩放，默认显示最近 40% 数据
- 双 grid 布局：上方 60% 价格图，下方 16% 成交量图

**分时图**：

- 折线面积图：蓝色线条 + 渐变填充
- 成交量柱状图：半透明蓝色
- smooth 平滑曲线

**主题适配**：

```javascript
// 明暗模式切换时重新初始化 ECharts
function setTheme(theme) {
  if (chart) {
    chart.dispose();
    chart = echarts.init(el, theme === 'light' ? undefined : 'dark');
    klineCache = {};
    loadChartData(selectedIdx, currentKlt);
  }
}
```

### 5. 前端交互实现

**搜索过滤**：

```javascript
// 300ms 防抖，匹配板块名称和代码
searchInput.addEventListener('input', e => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    searchQuery = e.target.value.trim().toLowerCase();
    render();  // 重新过滤 + 排序 + 渲染
  }, 300);
});
```

**列排序**：

```javascript
// 支持数值排序和中文拼音排序
const sorted = [...filtered].sort((a, b) => {
  let va, vb;
  switch (sortColumn) {
    case 'rank':  va = data.indexOf(a); vb = data.indexOf(b); break;
    case 'name':  va = a.f14 || ''; vb = b.f14 || ''; break;
    case 'f3':    va = a.f3 ?? 0; vb = b.f3 ?? 0; break;
    // ...
  }
  if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb, 'zh') : vb.localeCompare(va, 'zh');
  return sortDir === 'asc' ? va - vb : vb - va;
});
```

**交易时间判断**：

```javascript
function isTradingTime() {
  const now = new Date();
  // 转换为北京时间（UTC+8）
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  const t = beijing.getHours() * 60 + beijing.getMinutes();
  // 9:15 = 555, 15:05 = 905, 周一到周五
  return t >= 555 && t <= 905 && beijing.getDay() >= 1 && beijing.getDay() <= 5;
}
```

### 6. 明暗主题切换

**CSS 变量方案**：

```css
/* 暗色主题（默认） */
:root {
  --bg0: #0d1117; --bg1: #161b22; --bg2: #21262d;
  --border: #30363d; --t1: #e6edf3; --t2: #8b949e;
  --accent: #2563eb; --up: #ff4d4f; --down: #00b96b;
}

/* 亮色主题 */
[data-theme="light"] {
  --bg0: #f0f2f5; --bg1: #ffffff; --bg2: #f6f8fa;
  --border: #d0d7de; --t1: #1f2328; --t2: #656d76;
  --accent: #2563eb; --up: #cf1322; --down: #389e0d;
}
```

**切换逻辑**：

```javascript
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'light' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
  // ECharts 也同步切换
  if (chart) { chart.dispose(); chart = echarts.init(el, theme === 'light' ? undefined : 'dark'); }
}

// 初始化：读取 localStorage → 跟随系统偏好
const saved = localStorage.getItem('theme');
if (saved) setTheme(saved);
else if (window.matchMedia('(prefers-color-scheme: light)').matches) setTheme('light');
```

### 7. Cloudflare Worker 后端（备用方案）

**当前状态**：已部署但因东方财富 502 未启用。代码保留在 `stock-backend/` 目录。

**设计思路**：

```
前端 GET /?type=industry
  → Worker 检查 KV 缓存（key: "sector:industry:f3:desc"）
    → 命中 → 直接返回缓存 JSON（10s 内）
    → 未命中 → fetch 东方财富 API → 数据格式转换 → 写入 KV（TTL 10s）→ 返回
```

**核心特性**：
- KV 缓存 10 秒 TTL，近实时
- Promise.race 5 秒超时保护
- 完整 CORS 支持（`Access-Control-Allow-Origin: *`）
- `/ping` 存活检测 + `/health` 诊断接口
- 数据格式转换：东方财富字段码 → 语义化命名

**502 问题原因**：东方财富封禁了 Cloudflare 边缘节点 IP 段，但 GitHub Actions 的 Azure IP 未被封禁。

---

## 🔄 数据流详解

### 板块数据流（15 分钟延迟）

```
东方财富 push2 API
       │
       ▼ (GitHub Actions 每 15 分钟)
  fetch-data.js
  - 分页抓取（每页 100 条）
  - 合并全量数据
       │
       ▼
  data/*.json（写入仓库）
       │
       ▼ (git push 触发)
  GitHub Pages 重新部署
       │
       ▼
  前端 fetch JSON → 渲染表格
```

### K 线数据流（实时）

```
用户打开大盘走势页面
       │
       ▼
  JSONP 请求 push2his.eastmoney.com
  - 动态创建 <script> 标签
  - cb 回调函数接收数据
       │
       ▼
  ECharts 渲染 K 线图
  - 蜡烛图 + 成交量
  - dataZoom 缩放
       │
       ▼
  缓存到 klineCache（同 Tab 不重复请求）
```

### 资金流向数据流（15 分钟延迟）

```
东方财富 push2 API（f62 主力净流入字段）
       │
       ▼ (GitHub Actions 每 15 分钟)
  fetch-data.js
  - 按主力净流入降序
  - 取前 100 条
       │
       ▼
  data/capital-*.json
       │
       ▼
  前端 fetch → 渲染排行表格
  - 资金概览统计
  - 可视化柱状条
```

---

## 📁 项目文件结构

```
stock-frontend/
├── index.html                          # HTML 骨架（~55 行，纯结构）
├── package.json                        # Vite 构建配置
├── vite.config.js                      # Vite 配置文件
├── fetch-data.js                       # 数据抓取脚本（Node.js，GitHub Actions 运行）
├── src/
│   ├── main.js                         # 入口：主题切换 / 导航 / 自动刷新
│   ├── state.js                        # 全局共享状态
│   ├── utils.js                        # 工具函数（格式化 / 缓存 / 时区）
│   ├── styles/
│   │   └── main.css                    # 全部样式（含明暗主题变量）
│   ├── market.js                       # 📈 大盘走势（ECharts K 线图）
│   ├── capital.js                      # 💰 资金流向
│   ├── sector.js                       # 📊 板块分析（搜索 / 排序）
│   └── insight.js                      # 🧠 市场洞察（规则引擎）
├── public/
│   ├── favicon.svg                     # 蓝色折线图图标
│   └── data/
│       ├── industry.json               # 行业板块（496 条）
│       ├── concept.json                # 概念板块（495 条）
│       ├── region.json                 # 地域板块（31 条）
│       ├── capital-industry.json       # 行业资金流向（100 条）
│       ├── capital-concept.json        # 概念资金流向（100 条）
│       ├── kline-*.json                # K 线数据（3 指数 × 3 周期）
│       └── history/                    # 历史数据存档（30 天）
├── .github/workflows/
│   ├── static.yml                      # GitHub Pages 部署（npm build → dist/）
│   └── update-stock-data.yml           # 定时数据抓取（15~45 分钟随机）
├── .gitignore
├── PROJECT-SUMMARY.md                  # 项目技术总结文档
└── README.md                           # 本文件

stock-backend/                          # Cloudflare Worker（备用，当前未启用）
├── src/index.ts                        # Worker 主逻辑（TypeScript）
├── wrangler.toml                       # Worker 配置 + KV 绑定
└── package.json
```

### 构建产物（dist/）

| 文件 | 大小 | 说明 |
|------|------|------|
| index.html | 3.82 KB | HTML 骨架 + 引入 JS/CSS |
| JS（压缩） | 23 KB | 源码 57KB → 构建 23KB（-60%） |
| CSS（压缩） | 6.92 KB | 全部样式 |
| data/*.json | ~265 KB | 静态数据文件（原样复制） |

---

## 🚀 部署指南

### 前端部署（GitHub Pages）

1. Fork 或克隆本仓库
2. 进入仓库 **Settings → Pages**
3. Source 选择 **GitHub Actions**
4. 推送代码到 `main` 分支，自动执行 `npm ci → npm run build → 部署 dist/`

### 本地开发

```bash
npm install       # 安装依赖
npm run dev       # 启动开发服务器（HMR 热更新）
npm run build     # 构建生产版本到 dist/
npm run preview   # 预览构建产物
```

### 数据抓取配置

GitHub Actions 工作流已配置好，无需额外操作：
- **定时抓取**：交易时间每 15 分钟自动执行
- **手动触发**：在 Actions 页面点击 "Run workflow"

### 后端部署（可选，当前因 502 未启用）

```bash
cd stock-backend
npm install
npx wrangler kv:namespace create "STOCK_CACHE"
# 将返回的 id 填入 wrangler.toml
npx wrangler deploy
```

---

## 🕳️ 开发踩坑记录

### 坑 1：GitHub Pages 404

**现象**：前端加载数据报 `Unexpected token '<'`，JSON 文件返回 404 HTML 页面

**原因**：GitHub Pages 的 Source 配置应选 **"GitHub Actions"** 而非 "Deploy from a branch"。工作流类型和 Pages Source 必须匹配。

**解决**：Settings → Pages → Source → 选择 "GitHub Actions"

### 坑 2：fetch-data.js 变量重复声明

**现象**：GitHub Actions 定时任务执行失败，脚本直接报错

**原因**：`const fs = require('fs')`（第 3 行）和函数内 `const fs = SECTOR_TYPES[type]`（第 15 行）重复声明。`const` 不允许同一作用域重复定义。

**解决**：将函数内变量改名为 `filterStr`

**教训**：Node.js 脚本也要做语法检查（`node -c`），不能只测功能。

### 坑 3：Cloudflare Worker 访问东方财富 502

**现象**：Worker 所有请求东方财富 API 都返回 502 Bad Gateway

**原因**：东方财富封禁了 Cloudflare 边缘节点的 IP 段。但 GitHub Actions 的 Azure IP 没被封。

**解决**：放弃 Worker 实时代理方案，改用 GitHub Actions 定时抓取静态 JSON。

**教训**：国内金融 API 普遍有反爬策略，不同云厂商 IP 待遇不同。选择数据方案前必须实际测试连通性。

### 坑 4：JSONP 超时导致 Worker 卡死

**现象**：Worker 所有接口（包括 /health 和 /ping）都无响应，浏览器显示超时

**原因**：`AbortController` 在 Cloudflare Workers 环境下不生效，fetch 请求永远不返回，整个 Worker 实例卡死。

**解决**：改用 `Promise.race` + `setTimeout` 实现超时控制。

```javascript
// ❌ Workers 下不生效
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);
await fetch(url, { signal: controller.signal });

// ✅ 正确做法
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('请求超时')), 5000);
});
await Promise.race([fetch(url), timeoutPromise]);
```

### 坑 5：let 暂时性死区（TDZ）

**现象**：`ReferenceError: Cannot access 'chart' before initialization`

**原因**：`setTheme()` 在脚本顶部执行时访问了 `chart` 变量，但 `let chart = null` 声明在脚本中部。`let` 声明的变量在声明之前处于"暂时性死区"，访问会报错。

**解决**：所有全局变量声明移到脚本最顶部，在任何函数调用之前。

### 坑 6：东方财富板块接口不返回换手率

**现象**：换手率列全部显示 `-`

**原因**：板块级 API 不返回 `f8`（换手率）字段，所有记录的 f8 值为 `null`。换手率只在个股数据中有效。

**解决**：将换手率列替换为总市值列（`f20`，有数据）。

**教训**：API 文档缺失时，必须先检查实际返回的字段和值，不能凭字段名猜测。

---

## 🔧 优化方向

### 性能优化

| 优化点 | 状态 | 说明 |
|--------|------|------|
| JSON 文件体积 | ✅ 已完成 | 只保留前端需要的字段，体积缩减 41%（450KB→265KB） |
| ECharts 懒加载 | ✅ 已完成 | 从 `<head>` 移除，点大盘走势 Tab 才动态加载（省 ~1MB 首屏） |
| 首次加载优化 | ✅ 已完成 | 市场洞察为默认 Tab（纯数据计算秒开），ECharts 按需加载 |
| K 线数据稳定性 | ✅ 已完成 | 从 JSONP 改为 GitHub Actions 抓取静态 JSON，彻底解决加载失败 |
| ECharts 按需引入 | ⏳ 暂缓 | 全量 1MB → 按需 ~400KB，但 CDN 只加载一次且有缓存，收益小 |
| 虚拟滚动 | ⏳ 暂缓 | 500 条数据浏览器渲染无卡顿，暂不需要 |

### 架构优化

| 优化点 | 状态 | 说明 |
|--------|------|------|
| 数据格式语义化 | ✅ 已完成 | 抓取时转换 f14→name, f3→changePercent 等，代码可读性拉满 |
| 错误降级 | ✅ 已完成 | 网络失败时显示 localStorage 缓存数据 + 黄色过期提示条 |
| 抓取频率随机化 | ✅ 已完成 | 50% 概率随机跳过，实际间隔 15~45 分钟，避免固定频率被反爬 |
| 自动重试机制 | ✅ 已完成 | 网络抖动自动重试 3 次（指数退避 2s/4s/6s） |
| 单文件拆分/Vite | ✅ 已完成 | 拆分为 10 个模块，JS 压缩 57KB→23KB（-60%），GitHub Actions 自动构建 |
| 部署速度 | ❌ 不做 | GitHub Pages 部署速度可接受 |

### 数据质量优化

| 优化点 | 状态 | 说明 |
|--------|------|------|
| 历史数据积累 | ✅ 已完成 | 每天自动存档到 `data/history/`，保留 30 天，自动清理 |
| 数据校验 | ✅ 已完成 | 板块：涨跌停 ±22% 内/市值非负；资金流：金额有效；K 线：格式校验 |
| 节假日处理 | ✅ 已完成 | 内置 2026 年 A 股休市日表，法定节假日不空跑 GitHub Actions |
| 时区统一 | ✅ 已完成 | 新增 `getBeijingNow()` 统一函数，全部改用 UTC 方法计算北京时间 |

---

## 🎯 待开发功能

### 🔥 高优先级（推荐优先做）

| 功能 | 说明 | 技术难度 | 价值 |
|------|------|---------|------|
| ✅ **市场洞察** | 规则引擎分析面板，市场温度/资金/轮动/风险提示 | ⭐⭐ | 已完成 |
| **自选关注列表** | 用户收藏板块，置顶显示，localStorage 存储 | ⭐⭐ | 高频使用 |
| **板块历史走势** | 选中板块的涨跌幅历史曲线（需积累历史数据） | ⭐⭐⭐ | 趋势分析 |
| **涨跌幅预警** | 板块涨跌幅超阈值时浏览器通知 / 飞书推送 | ⭐⭐ | 实时监控 |
| **个股查询** | 输入股票代码/名称，查看所属板块 + 实时行情 | ⭐⭐⭐ | 核心功能 |
| **北向资金** | 沪深港通北向资金流入/流出实时数据 | ⭐⭐ | 市场风向标 |

### 📈 中优先级

| 功能 | 说明 | 技术难度 |
|------|------|---------|
| **龙虎榜数据** | 每日龙虎榜，机构/游资买卖明细 | ⭐⭐⭐ |
| **涨停/跌停统计** | 每日涨停/跌停数量趋势图，情绪指标 | ⭐⭐ |
| **板块相关性分析** | 分析哪些板块经常同涨同跌，发现联动关系 | ⭐⭐⭐⭐ |
| **技术指标** | 板块指数 MA/MACD/KDJ/RSI 技术分析 | ⭐⭐⭐ |
| **板块轮动图** | 可视化板块资金流转关系 | ⭐⭐⭐⭐ |

### 💡 低优先级（锦上添花）

| 功能 | 说明 | 技术难度 |
|------|------|---------|
| **数据导出** | 导出当前板块数据为 Excel/CSV | ⭐ |
| **PWA 支持** | 添加 manifest + service worker，可安装到手机桌面 | ⭐⭐ |
| **全局搜索** | 顶栏搜索框搜索所有板块 + 个股，跳转详情 | ⭐⭐ |
| **数据对比** | 选择多个板块对比涨跌幅走势 | ⭐⭐⭐ |
| **日历模式** | 日历视图展示每天的板块涨跌情况 | ⭐⭐ |

---

## 🛠️ 技术栈

| 层级 | 技术 | 用途 | 成本 |
|------|------|------|------|
| **前端** | Vite + 原生 JS（ES Modules） | 模块化开发，按需构建 | 免费 |
| **构建** | Vite 5 | 开发热更新 + 生产构建（JS -60%） | 免费 |
| **图表** | ECharts 5（CDN 懒加载） | K 线图、分时图可视化 | 免费 |
| **静态部署** | GitHub Pages | 网站托管（npm build → dist/） | 免费 |
| **定时任务** | GitHub Actions | 数据定时抓取（15~45 分钟随机） | 免费（2000 分钟/月） |
| **数据源** | 东方财富 API | A 股板块 / 资金流 / K 线数据 | 免费 |
| **后端（备用）** | Cloudflare Workers + KV | 实时 API 代理（因 502 未启用） | 免费（10 万次/天） |
| **版本控制** | Git + GitHub | 代码管理 + 数据版本化 | 免费 |

---

## 📄 License

MIT

---

*最后更新：2026-07-21*
