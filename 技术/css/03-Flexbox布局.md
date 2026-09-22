---
tags: [css]
---

# 第3章 Flexbox 布局

> 一句话讲清：**给容器一行 `display: flex`，它的子元素就进入一个"弹性盒子"体系：
> 主轴自动排列、交叉轴对齐、空间可以伸缩分配。**现代布局 70% 用它解决。
> 后端类比：flex 容器 ≈ 一个 ArrayList，子项 ≈ 元素，flex 属性 ≈ 每个元素的"分配权重"。

## 3.1 上手：一个 flex 就够了

```html
<div class="row">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
</div>
```

```css
.row { display: flex; }
.item { padding: 12px; }
/* 结果：A B C 横向排成一行，高度自动拉伸对齐 */
```

对比不用 flex（div 是块级，默认上下堆叠）——flex 让子元素**默认横向排布**，
这是第一个心智转变：**display: flex 改变的是"子元素的排列方式"。**

## 3.2 两根轴：主轴（main axis）与交叉轴（cross axis）

```
默认（flex-direction: row）：
  主轴 ────────────────→   (水平，从左到右)
  交叉轴 ↓                (垂直，从上到下)

flex-direction: column：
  主轴 ↓                  (垂直，从上到下)
  交叉轴 ────────→        (水平)
```

| 属性 | 作用 | 说明 |
|------|------|------|
| flex-direction | 主轴方向 | row（默认）/ column / row-reverse / column-reverse |
| justify-content | **主轴**方向的对齐 | flex-start / center / space-between / space-around / space-evenly |
| align-items | **交叉轴**（单行）对齐 | stretch（默认拉满）/ center / flex-start / flex-end / baseline |
| align-content | 交叉轴（多行）对齐 | 只有换行后才有意义，类似 justify-content 的副本 |
| flex-wrap | 是否换行 | nowrap（默认，会挤压）/ wrap（常用） |

### 高频组合 1：水平+垂直居中（面试必背）

```css
.center {
  display: flex;
  justify-content: center;  /* 主轴居中 */
  align-items: center;      /* 交叉轴居中 */
}
```

这一个组合解决"把按钮/卡片/内容盒子放到父容器正中间"的 90% 需求。

### 高频组合 2：左右两端分布

```css
.navbar {
  display: flex;
  justify-content: space-between;  /* 首项靠左、末项靠右 */
  align-items: center;             /* 垂直居中 */
}
/* 典型：左侧 logo，右侧菜单按钮 */
```

### 高频组合 3：等宽三列

```css
.columns { display: flex; }
.column { flex: 1; }        /* 每列平分剩余空间 */
```

## 3.3 三个核心属性：flex-grow / flex-shrink / flex-basis

flex 是三个子属性的简写，理解它才能控制"空间怎么分"：

```
flex: grow  shrink  basis
       放大    收缩    基础大小
       默认:  0      1     auto
```

```css
/* flex: 1  →  flex: 1 1 0% 的简写：全部基于 0 按比例瓜分剩余空间 */
.item { flex: 1; }          /* 平分剩余空间 */

.item--2 { flex: 2; }       /* 拿 2 份，比 flex:1 的宽一倍 */

/* flex: none → flex: 0 0 auto：不伸缩，纯靠内容宽度 */
.logo { flex: none; }       /* 固定内容宽，不参与挤压 */
```

面试追问：flex: 1 和 flex: auto 的区别？
答：flex: 1 = `1 1 0%`（从 0 开始按比例分）；flex: auto = `1 1 auto`（先按内容宽，
再瓜分剩余，内容宽的更宽）。栅格等分用 flex: 1，需要按内容自适应用 flex: auto。

### 防挤压：flex-shrink 是"缩骨功"

```css
.row { display: flex; }
.title { flex-shrink: 0; }      /* 不允许被压缩，保持内容完整 */
.desc  { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 典型场景：列表里"标题固定，描述文字超长省略号" */
```

## 3.4 典型实战：弹性布局三件套

代码1：导航栏（RuoYi 顶栏同款结构）

```html
<header class="topbar">
  <div class="brand">华润燃气平台</div>
  <nav class="menu">…菜单…</nav>
  <div class="user">管理员</div>
</header>
```

```css
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;   /* 左/中/右三段 */
  height: 56px;
  padding: 0 16px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
}
.menu { display: flex; gap: 8px; } /* 菜单项之间用 gap 间距（现代替代 margin） */
```

代码2：卡片列表（flex wrap 自适应换行）

```css
.card-list {
  display: flex;
  flex-wrap: wrap;              /* 换行 */
  gap: 16px;                    /* 间距，modern flex 直接支持 */
}
.card {
  flex: 1 1 260px;              /* 基础 260px，空间够就放大，不够就换行 */
  max-width: 33%;               /* 最多三列 */
  padding: 16px;
  border: 1px solid #eee;
  border-radius: 8px;
}
```

代码3：两列布局（左侧定宽 + 右侧自适应）——后台管理最常用

```css
.layout {
  display: flex;
  min-height: 100vh;
}
.sidebar { width: 220px; flex-shrink: 0; }   /* 定宽不被压 */
.main {
  flex: 1;
  overflow: auto;               /* 内容超了自己滚动 */
  padding: 16px;
}
```

## 3.5 垂直居中：全家桶（面试高频，一次答全）

| 方案 | 写法 | 适用 |
|------|------|------|
| flex 法（首选） | 父 display:flex + align-items:center | 基本所有场景 |
| grid 法 | 父 display:grid + place-items:center | 单元素居中一体式写法 |
| 绝对定位法 | 子 position:absolute + inset:0 + margin:auto | 复杂/需要脱离文档流 |
| line-height 法 | 单行文字容器 line-height == height | 单行文本（旧方案） |
| transform 法 | 子 absolute + top:50% + translate(-50%,-50%) | 不知道自身尺寸时 |

```css
/* grid 一行居中 */
.center-grid { display: grid; place-items: center; }

/* 绝对定位法：四边为 0 + margin:auto，无需知道尺寸 */
.center-abs {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 200px; height: 100px;
}
```

面试标准答案：**"首选 flex（父容器 justify-content:center + align-items:center）；
不知道尺寸用 transform 偏移；grid 的 place-items 是最短写法。"**

## 3.6 gap：用间距告别 margin 地狱

```css
/* 旧做法：每个子元素 margin-left: 8px，还要去掉第一个 */
.row > * + * { margin-left: 8px; }

/* 新做法（2021 后全浏览器支持）：容器级间距 */
.row { display: flex; gap: 8px; }
/* 子元素之间自动 8px，首尾无多余间距 */
```

gap 也支持 grid；这是"间距问题"的现代标准答案。

## 3.7 常见坑快查

| 坑 | 现象 | 解决 |
|----|------|------|
| 子项被压缩变形 | 长文本撑爆布局 | flex-shrink: 0 或 min-width: 0 |
| flex: 0 了还是变形 | 文本换行 | min-width: 0（flex 项默认 min-width:auto 导致不缩小） |
| 居中只生效一个方向 | 只写了 justify-content | 两轴都要：justify + align |
| 子元素高度不相等 | align-items 默认 stretch | 想要顶部对齐用 align-items: flex-start |
| 老项目垂直居中失效 | 用了 line-height 但多行 | 换 flex 方案 |

## 3.8 面试自测

- Q：justify-content 和 align-items 分别管哪根轴？
  A：justify 管主轴，align 管交叉轴；主轴方向由 flex-direction 决定（别只记"横竖"）。
- Q：flex: 1 具体是什么？
  A：flex: 1 1 0%；三兄弟：放大比例、收缩比例、基础尺寸。
- Q：子元素放不下被压扁怎么办？
  A：flex-shrink: 0 或 min-width: 0。
- Q：flex 和 Grid 什么时候选哪个？
  A：一维排布（一行/一列）用 flex；二维（行列同时控制）用 grid，下一章讲。

## 小结

- display:flex 让子元素进"弹性盒子"，主轴排列 + 交叉轴对齐。
- 居中全家桶首选 flex：justify-content:center + align-items:center。
- flex: 1 = 平分剩余空间；flex-shrink: 0 = 免疫压缩；gap 管间距。
- 一维布局 flex，二维布局 grid（下一章）。

下一篇：第4章 Grid 布局（二维布局第二主力）。