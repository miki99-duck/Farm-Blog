---
tags: [css]
---

# 第9章 SCSS 基础与 RuoYi 样式结构

> 一句话讲清：**SCSS 是 CSS 的"增强方言"——写起来更少、更清晰，编译后还是普通 CSS。
> RuoYi-Vue 项目里的样式几乎全是 .scss，看懂它 = 看得懂项目样式层。**
> 后端类比：SCSS ≈ TypeScript 之于 JavaScript（超集 + 编译期能力 + 语法糖）。

## 9.1 SCSS 从哪来

- SASS → SCSS（Sassy CSS）语法：兼容 CSS，支持嵌套等。
- 编译：node-sass / dart-sass（RuoYi 用 node-sass，打包时编译成 css）。
- 浏览器只认 CSS；SCSS 的一切能力都是"编译期"的。

三个最常用能力（先记住）：

```
① 变量：$primary 统一颜色 → 编译成固定值
② 嵌套：选择器写成父子结构 → 编译成后代选择器
③ 混入 @mixin：可复用样式块 → 编译期展开
```

## 9.2 变量与嵌套（75% 的使用场景）

```scss
// 变量：项目级配色/尺寸定义（RuoYi 的 styles/variables.scss 就是干这个的）
$primary-color: #409eff;
$font-size-base: 14px;
$sidebar-width: 220px;

// 嵌套：写父子选择器（自动编译成后代选择器）
.navbar {
  height: 56px;
  display: flex;

  // 子元素直接缩进写
  .logo {
    font-size: 18px;
    font-weight: 600;
  }

  // & 代表"父选择器本身" —— 高频用法
  &:hover { background: #f5f5f5; }        // .navbar:hover
  &--dark { background: #304156; }        // .navbar--dark（BEM 修饰类）
  &__item { padding: 0 12px; }            // .navbar__item（BEM 元素）
}
```

编译产物（心里要有这个概念）：

```css
.navbar { height: 56px; display: flex; }
.navbar .logo { font-size: 18px; font-weight: 600; }
.navbar:hover { background: #f5f5f5; }
.navbar--dark { background: #304156; }
.navbar__item { padding: 0 12px; }
```

注意嵌套别太深（3 层以内）：`&` 用得越深，编译出的选择器越长、特定度越难控。

## 9.3 混入 @mixin 与继承 @extend

```scss
// @mixin：可带参数的样式函数（RuoYi 里做 flex 居中等）
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
@mixin ellipsis($lines: 1) {
  overflow: hidden;
  text-overflow: ellipsis;
  @if $lines == 1 {
    white-space: nowrap;
  } @else {
    display: -webkit-box;
    -webkit-line-clamp: $lines;
    -webkit-box-orient: vertical;
  }
}

.badge { @include flex-center; }                  // 编译期粘贴展开
.title { @include ellipsis(2); }                  // 两行省略号，传参
```

```scss
// @extend：继承一个选择器的全部样式（小心：会把选择器合并成组）
.btn-base { padding: 8px 16px; border-radius: 4px; }
.btn-red  { @extend .btn-base; background: red; }   // .btn-base, .btn-red { padding... }
```

对比：mixin 是"复制粘贴"，extend 是"把两个选择器并进同一规则"。
RuoYi 里看到 `@extend` 可以用，但新代码优先用 @mixin（不易产生意外选择器组）。

## 9.4 运算、插值与 @if（写样式也有逻辑）

```scss
$gap: 8px;

.card {
  // 运算：间距体系从基准推导，改一个全局间距全家变
  padding: $gap * 2;              // 16px
  margin: $gap * 0.5;             // 4px

  // 插值：动态生成类名（水平低时少见，高级用法）
  // 循环生成 1~12 的栅格类
  @for $i from 1 through 12 {
    .col-#{$i} { width: percentage($i / 12); }
  }
}
```

实际场景：**间距/字号不要散落魔法数字，用变量 + 运算构建"设计刻度"**——
改一处基准，全局节奏统一。

## 9.5 map 与 @each（主题管理利器）

```scss
// 状态色 map：一套数据驱动多套样式
$color-map: (
  primary: #409eff,
  success: #67c23a,
  danger:  #f56c6c
);

// 一次性生成 .btn-success / .btn-danger / .btn-primary
@each $name, $color in $color-map {
  .btn-#{$name} { background: $color; }
}
```

## 9.6 RuoYi-Vue 的实际样式结构（打开项目对照）

RuoYi 前端目录（典型结构）：

```
src/
├── main.js                     ← 引入全局样式
├── assets/
│   └── styles/
│       ├── index.scss          ← 主入口：@use/@import 所有样式
│       ├── variables.scss      ← 全局变量：$primary、$header 高度等
│       ├── sidebar.scss        ← 侧边栏样式（布局核心）
│       ├── element.scss        ← 对 Element UI 的覆盖定制（改样式主战场！）
│       └── ruoyi.scss          ← 业务通用样式
├── layout/
│   └── index.vue + *.scss      ← 布局组件自带样式（scoped + lang="scss"）
└── views/**/*.vue              ← 页面组件，样式写在组件内 <style scoped lang="scss">
```

三个"在项目里改样式"的实战入口：

```scss
// ① 全局改主题色：改 variables.scss
$primary-color: #409eff;      // 改成你们公司的品牌色

// ② 覆盖 Element UI 组件样式：看 element.scss
.el-button--primary {
  background-color: $primary-color;   // 覆盖时用变量，别写死
}

// ③ 页面级：scoped 样式（只作用于当前组件）
<style scoped lang="scss">
  .device-list {
    .el-table { border-radius: 8px; }   // scoped 里也能嵌套
  }
</style>
```

### scoped 原理（面试可讲）

`<style scoped>` 编译后会给当前组件的元素加一个 data-v-xxxx 属性，
选择器变成 `.device-list[data-v-xxxx]`——**限定作用域，互不污染**。
若要穿透子组件内部（如深改 Element UI 的某一层），需要 `:deep()`：

```scss
// 改 el-table 的内部单元格（Element UI 是子组件，普通选择器够不到内部）
.table-wrap {
  :deep(.el-table__cell) { padding: 6px 8px; }
}
```

## 9.7 SCSS vs CSS 变量（面试必问）

| 维度 | SCSS 变量 | CSS 变量(var()) |
|------|-----------|-----------------|
| 阶段 | 编译期，写完就定死 | 运行期，随时可变 |
| 作用域 | 编译单元的块作用域 | DOM 树作用域（可继承/覆盖） |
| 动态改（JS/换肤） | ❌ | ✅ document 改值即可 |
| 性能 | 无影响（已编译） | 略有一点点查表开销（可忽略） |

结论：**设计态/静态布局用 SCSS 变量；需要运行时切换的（主题色、暗黑模式）用 CSS 变量。**
RuoYi 主题色走 SCSS，暗黑/换肤想做动态就得引入 CSS 变量。

## 9.8 常见坑快查

| 坑 | 现象 | 解决 |
|----|------|------|
| 变量编译报错/未生效 | 变量在别的文件没导入 | 确认 variables.scss 被 @use/@import 引入 |
| 嵌套太深 | 选择器超长、样式难覆盖 | 控制在 3 层内，多用修饰类 |
| scoped 改不动子组件 | Element UI 内部样式穿透不了 | 用 :deep(.el-xxx) |
| node-sass 装不上 | 老版本与 Node 版本不匹配 | RuoYi 项目用 node-sass，Node 版本要对齐；或换 dart-sass |
| 改变量没效果 | 构建缓存 | 重启 dev / 清缓存（npm run dev 重新编译即可） |

## 9.9 面试自测

- Q：SCSS 和 CSS 关系？
  A：SCSS 是 CSS 超集/预处理器，编译成 CSS；核心能力变量、嵌套、mixin、循环。
- Q：@mixin 和 @extend 区别？
  A：mixin 展开复制（可传参），extend 合并选择器组；mixin 更可控。
- Q：scoped 怎么实现的？
  A：编译加 data-v 属性 + 属性选择器限定；穿透用 :deep()。
- Q：SCSS 变量能动态换肤吗？
  A：不能（编译期定死）；运行时换肤用 CSS 变量。

## 小结

- SCSS = 变量 + 嵌套 + mixin + 循环，编译成 CSS。
- RuoYi 样式入口：variables.scss（变量）/ element.scss（覆盖 Element UI）/ 组件 scoped。
- 改主题色改 variables，改组件内部用 :deep()。
- SCSS 变量管设计态，CSS 变量管运行态。

下一篇：第10章 CSS 面试速查与常见坑（考前 30 分钟）。