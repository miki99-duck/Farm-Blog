---
tags: [css]
---

# 第8章 实战组件（RuoYi 风格）

> 一句话讲清：**把前七章的知识组装成真实页面组件——按钮、表单、表格、导航、标签、面板。
> 每个组件都给出"能跑的最小代码 + 为什么这么写"。**
> 本章是"看得见成果"的一章：RuoYi 页面就是这些组件的组合。

## 8.1 按钮：状态的完整设计

```css
/* 基础按钮：主色、hover、active、禁用 四个状态缺一不可 */
.btn {
  display: inline-flex;              /* flex 让文字/图标垂直居中 */
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 4px;
  background: var(--primary-color, #409eff);  /* 支持主题变量 */
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}
.btn:hover  { background: #66b1ff; }
.btn:active { transform: scale(0.98); }               /* 按下的反馈 */
.btn:disabled {
  background: #a0cfff;
  cursor: not-allowed;
  opacity: .7;
}
/* 次级：描边按钮（RuoYi 的 plain 风格） */
.btn--plain {
  background: #ecf5ff;
  color: var(--primary-color, #409eff);
  border: 1px solid #b3d8ff;
}
.btn--plain:hover { background: var(--primary-color); color: #fff; }
```

设计要点：**每个可交互元素都要有 hover / active / disabled 三种状态的可见反馈**
——这是前端工程师与"只会写 div"的分水岭。

## 8.2 卡片：内容容器

```css
.card {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  box-shadow: 0 2px 8px rgba(0,0,0,.05);
  padding: 16px;
}
.card__header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
}
```

使用：RuoYi 几乎所有业务页面 = 一个 card 包住搜索区 + 表格 + 分页。

## 8.3 表单：从丑到可用

```css
/* 表单行：label 左对齐 + 控件弹性 */
.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.form-label {
  width: 80px;
  text-align: right;      /* 右对齐让视觉更整齐（Element UI 默认） */
  color: #606266;
  flex-shrink: 0;
}
.form-input {
  flex: 1;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-input:focus {
  outline: none;
  border-color: var(--primary-color, #409eff);
  box-shadow: 0 0 0 2px rgba(64,158,255,.2);   /* 聚焦光环 */
}
.form-input:disabled {
  background: #f5f7fa;
  color: #c0c4cc;
  cursor: not-allowed;
}
```

## 8.4 表格：斑马纹 + hover + 固定表头

```css
.table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table th {
  background: #f5f7fa;
  text-align: left;
  font-weight: 600;
  padding: 10px 12px;
  border-bottom: 1px solid #ebeef5;
}
.table td {
  padding: 10px 12px;
  border-bottom: 1px solid #ebeef5;
  color: #606266;
}
.table tbody tr:nth-child(even) { background: #fafafa; }  /* 斑马纹 */
.table tbody tr:hover { background: #f5f7fa; }            /* hover 高亮 */
.table td.num { text-align: right; font-variant-numeric: tabular-nums; }
/* 表格数字等宽对齐，是细节加分项 */
```

固定表头（长表格）实战：

```css
.table-wrap {
  max-height: 400px;
  overflow: auto;           /* 整个表格滚动，表头不固定 */
}
/* 或 sticky 表头（更现代，只让表头吸住） */
.table thead th { position: sticky; top: 0; background: #f5f7fa; z-index: 1; }
```

## 8.5 状态标签：让"状态字段"一目了然（IoT 设备状态最常用）

```css
.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
}
.tag--success { background: #f0f9eb; color: #67c23a; }
.tag--warning { background: #fdf6ec; color: #e6a23c; }
.tag--danger  { background: #fef0f0; color: #f56c6c; }
.tag--info    { background: #f4f4f5; color: #909399; }
```

```html
<span class="tag tag--success">运行中</span>
<span class="tag tag--danger">告警</span>
<span class="tag tag--info">离线</span>
```
这是 Element UI el-tag 的"纯 CSS 复刻"，也是面试手写高频题。

## 8.6 顶部导航 + 侧边栏（RuoYi 布局骨架）

```css
.layout { display: flex; min-height: 100vh; }

.sidebar {
  width: 220px;
  background: #304156;         /* RuoYi 深色侧栏 */
  color: #bfcbd9;
}
.sidebar .menu-item {
  padding: 14px 20px;
  cursor: pointer;
  transition: background .2s, color .2s;
}
.sidebar .menu-item:hover { background: #263445; color: #fff; }
.sidebar .menu-item.active { background: var(--primary-color); color: #fff; }  /* 选中态 */

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.main .navbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
}
.main .content { flex: 1; padding: 16px; overflow: auto; background: #f0f2f5; }
```

要点：**背景色 #f0f2f5 内容区 + 白色卡片 + 深色侧栏**就是 RuoYi 的视觉配方。

## 8.7 分页器（纯 CSS 组件感）

```css
.pagination { display: flex; justify-content: flex-end; gap: 4px; padding: 16px; }
.page-btn {
  min-width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}
.page-btn:hover { color: var(--primary-color); border-color: var(--primary-color); }
.page-btn.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
.page-btn:disabled { opacity: .5; cursor: not-allowed; }
```

## 8.8 告警条（弹窗/Toast 的视觉基础）

```css
.alert {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 4px;
  font-size: 14px;
}
.alert--error   { background: #fef0f0; color: #f56c6c; border: 1px solid #fbc4c4; }
.alert--warning { background: #fdf6ec; color: #e6a23c; border: 1px solid #f5dab1; }
.alert--success { background: #f0f9eb; color: #67c23a; border: 1px solid #c2e7b0; }
```

## 8.9 组件化思想（后端工程师视角）

CSS 组件化的核心原则和 Java 类设计一模一样：

| 原则 | CSS 对应 |
|------|---------|
| 单一职责 | 一个 class 只干一件事（.btn、.btn--primary） |
| 开闭原则 | 加需求加修饰类，不改已有类（.card--compact） |
| 避免魔法数字 | 间距/颜色/圆角抽成变量（--primary-color、--radius） |
| 命名规范 | BEM：块__元素--修饰（.card__header--fixed） |

命名规范 BEM 一分钟版：

```css
/* 块 block：组件名 */
.card {}
/* 元素 element：块__子部件 */
.card__header {}
.card__body {}
/* 修饰 modifier：块--变体 或 元素--变体 */
.card--dark {}
.card__header--fixed {}
```

RuoYi/Element UI 里看得见（el-card、el-card__header），照这个思路加自己的类就不会乱。

## 8.10 面试自测 & 手写题

- Q：手写一个 hover 变色的按钮（含禁用态）？
  A：8.1 的完整按钮五状态。
- Q：表格斑马纹怎么实现？
  A：tbody tr:nth-child(even) { background: ... }。
- Q：状态标签怎么做到"换色"？
  A：基类 .tag + 修饰类 .tag--success/-warning/-danger（BEM 实践）。
- Q：侧边栏选中态怎么做？
  A：.menu-item.active 优先级高于 hover，保证选中高亮不被 hover 覆盖（顺序在 hover 之后）。

## 小结

- 交互组件五状态：default/hover/active/disabled/focus。
- RuoYi 视觉配方：深色侧栏 + 白卡片 + #f0f2f5 内容区。
- 组件化 = BEM 命名 + 修饰类组合 + 变量统一。
- 手写题高频：按钮、斑马纹表格、状态标签、分页器、侧边导航。

下一篇：第9章 SCSS 基础与 RuoYi 样式结构（直接对接项目代码）。