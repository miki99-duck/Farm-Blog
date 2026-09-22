# 第11章 CSS 现代特性（2023~2026）

> 一句话讲清：布局和交互的"新武器"——容器查询、原生嵌套、颜色函数、
> 滚动驱动动画。老教程没有、面试能讲出来就是加分；写项目用得上的是前三个。
> 兼容性注意：每节都标了支持情况（以 caniuse 为准），生产环境按用户群体判断。

## 11.1 容器查询 @container：响应式从"视口"升级到"容器"

是什么：以前 @media 只能感知"整个页面宽度"；容器查询让组件感知"自己所在容器的宽度"。

为什么好：同一个卡片组件，放在窄侧栏里显示单列、放在宽主区显示两列——
过去要靠全局断点猜，现在组件自己看"爸爸有多宽"。

```css
/* ① 声明容器：任意元素都可以成为"查询参照" */
.card-list {
  container-type: inline-size;   /* 监听宽度方向（inline-size 性能最好） */
  container-name: cards;         /* 起名，便于精确查询 */
}

/* ② 在容器内部查询 */
@container cards (min-width: 400px) {
  .card { display: flex; }       /* 容器宽了：卡片内容横排 */
}
@container cards (min-width: 600px) {
  .card { grid-template-columns: 1fr auto; }
}
```

和 @media 的本质区别（面试重点）：

| | @media | @container |
|---|--------|-----------|
| 感知对象 | 整个视口 | 最近的容器祖先 |
| 复用性 | 组件换位置行为变 | 组件自带响应式，随处摆放一致 |
| 适用 | 整页布局断点 | 组件内部自适应 |

一句话："media 管页面，container 管组件。" 兼容性：2023 年后 Chrome/Safari/Firefox 全部支持。

## 11.2 原生 CSS 嵌套（2025 年全面可用）

CSS 终于原生支持嵌套，写法几乎和 SCSS 一样——**很多项目可以不装 sass 了**：

```css
.navbar {
  height: 56px;

  .logo { font-weight: 600; }        /* 嵌套后代（需 & 或选择器开头） */
  &:hover { color: #409eff; }        /* & = 父选择器 */
}
```

和 SCSS 的注意差异：
- 纯 CSS 嵌套里，`&` 可以省略（`.logo {}` 即可），但为避免歧义建议显式写。
- 嵌套深度同样别超过 3 层。
- 浏览器原生支持，零构建；老项目继续用 SCSS 也行，新项目可以少一个编译依赖。

ECMAScript 类比：这是 CSS 的"语法糖转正"，就像 async/await 当年进标准。

## 11.3 color-mix()：程序化混色，主题体系的新玩法

是什么：直接用函数把两种颜色按比例混合——不依赖 Sass 的颜色函数，运行时可算。

```css
/* 从主色派生 hover/浅色背景（不用再手工找色号） */
.btn {
  background: var(--primary);
}
.btn:hover {
  background: color-mix(in srgb, var(--primary) 85%, black);
}
.btn--soft {
  background: color-mix(in srgb, var(--primary) 12%, white);  /* 主色 12% + 白 → 浅底 */
}
```

为什么好：换肤只改 --primary 一个变量，hover/浅色/边框色全部自动派生，
不用为每个主题维护五六个色号。兼容性：2023 年后主流浏览器全支持。

配套 light-dark()：跟随系统暗色模式自动取色（2024 年后可用）：

```css
:root {
  color-scheme: light dark;
  --bg: light-dark(#ffffff, #1e1e1e);   /* 亮色给白，暗色给深 */
}
```

## 11.4 subgrid：让子网格对齐父网格轨道

是什么：grid 嵌套时，子 grid 的轨道默认自己算；subgrid 让它"继承"父网格的轨道线，
实现跨层级列对齐。

```css
/* 父网格三列 */
.board {
  display: grid;
  grid-template-columns: 200px 1fr 120px;
}
/* 子区域继承相同列（对齐卡片内部与表头） */
.row {
  display: grid;
  grid-template-columns: subgrid;   /* 列宽与父级完全一致 */
  grid-column: 1 / -1;
}
```

典型场景：表格行之间、卡片网格内的复杂对齐。没有它时只能手工近似或固定列宽。
兼容性：Chrome/Firefox 支持，Safari 最近版本起支持，切高级场景前查 caniuse。

## 11.5 滚动驱动动画（Scroll-Driven Animations）

是什么：动画进度由滚动条位置驱动，而不是时间驱动——**滚动本身成为动画控制器**。

```css
/* 卡片随滚动淡入 + 上浮（最常用的进场效果） */
.card {
  animation: rise linear both;
  animation-timeline: view();          /* 以"自身进入视口"为时间线 */
  animation-range: entry 0% entry 60%; /* 进入视口 0%~60% 期间播放 */
}
@keyframes rise {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: none; }
}
```

为什么以前做不到：进场动画要 JS 监听 scroll + IntersectionObserver 判断可见性；
现在纯 CSS 声明。兼容性：Chrome 支持，Safari/Firefox 逐步跟进（2025 年后可用性提升），
生产用注意降级（不影响无动画的阅读体验——动画加了是增强，不加内容完整）。

## 11.6 文本排版小特性（细节加分）

```css
/* 标题换行平衡：避免标题最后一行孤零零一个字 */
h2 { text-wrap: balance; }

/* 段落断行更自然 */
p  { text-wrap: pretty; }

/* 文字渐变（品牌标题/大屏常用） */
.gradient-text {
  background: linear-gradient(90deg, #409eff, #7c5cff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

## 11.7 过渡的"离散属性"：display 也能动画了

```css
/* 以前 display:none → block 无法过渡；现在允许离散过渡 */
.menu {
  transition: opacity .3s, display .3s allow-discrete;
}
.menu.open { display: block; opacity: 1; }
/* 配合 @starting-style 让"首次渲染"也能从透明进场 */
```

适合弹层/菜单的开合动画。兼容性：较新（Chrome 支持领先），用前查 caniuse。

## 11.8 兼容性与采用策略（面试要会说）

| 特性 | Chrome | Safari | Firefox | 建议 |
|------|--------|--------|---------|------|
| @container | ✅ | ✅ | ✅ | 可放心用于组件化系统 |
| 原生嵌套 | ✅ | ✅ | ✅ | 新项目可去 sass |
| color-mix | ✅ | ✅ | ✅ | 主题体系推荐 |
| light-dark() | ✅ | ✅ | ⚠️部分 | 暗色模式可渐进 |
| subgrid | ✅ | ⚠️新版 | ✅ | 高级布局用，先降级验证 |
| 滚动驱动动画 | ✅ | ⚠️ | ⚠️ | 作为增强，不可依赖 |
| allow-discrete | ✅ | ⚠️ | ⚠️ | 动效增强用 |

采用原则（和代码架构同一逻辑）：
1. **渐进增强**：新特性是"加分项"，核心内容不依赖它也能完整展示。
2. **先小范围**：组件库/新页面试点，再推广存量页面。
3. **降级方案**：滚动动画无 JS 兜底时内容依然可达（它本来就不影响阅读）。
4. 每次查 caniuse：https://caniuse.com（开发前 10 秒的事，别凭记忆）。

## 11.9 面试怎么讲现代特性

- 主动句："我最常用容器查询做组件级响应式，比如设备卡片在窄栏单列、宽栏双列，
  不用写全局断点。"——有真实用法，比罗列 API 加分。
- 被问"原生嵌套 vs SCSS"：答"原生嵌套能去一个构建依赖，但 SCSS 的变量/mixin
  生态成熟，项目里看场景选；我理解两者是超集与子集的关系。"
- 被问"暗色模式怎么做"：答"CSS 变量 + light-dark()/数据属性切换，
  主题色一份定义，运行态切换。"（呼应第2章 2.6 和第9章 9.7）
- 被问"怎么跟进新特性"：答"追 MDN + caniuse + 浏览器版本发布说明，
  新项目小范围试点，渐进增强不上头。"

## 小结

- 容器查询：响应式从页面级到组件级，container-type + @container。
- 原生嵌套、color-mix、light-dark：少一个编译依赖、少一堆色号。
- subgrid / 滚动驱动动画 / allow-discrete：高级场景，先降级验证。
- 采用口诀：渐进增强、先试点、查 caniuse。