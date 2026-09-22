# 第10章 CSS 面试速查与常见坑（考前 30 分钟）

> 使用方式：每类问题先自己答，再对答案。带 ★ 的是面试最高频。
> 答不上来的回对应章节精读。这一章也是写页面遇到问题时优先翻的"字典"。

## A. 知识点速查（35 问版）

### 选择器与层叠（6）

1. 优先级排序？★
   答：!important > 内联 > ID > (类/属性/伪类) > (标签/伪元素) > 浏览器默认；同级比书写顺序。
2. (0,2,0,0) vs (0,0,10,0)？
   答：前者。高位优先，10 个类打不过 2 个 ID。（第1章 1.3）
3. :is() 和 :where() 区别？
   答：行为一致分组；:is 取参数最高特定度，:where 恒为 0，易覆盖。
4. :has() 干嘛的？
   答：父选择器——选中包含某子元素的父元素（现代增强选择器）。
5. 哪些属性继承？
   答：color、font-*、line-height、text-align 继承；盒模型/布局不继承。
6. @layer 解决什么问题？
   答：把"靠后写覆盖"变成显式层顺序，团队协作更可控。

### 盒模型与单位（6）

7. content-box vs border-box？★
   答：width 是否含 padding/border；项目一律 border-box（全局 * 设置）。
8. margin 塌陷是什么？怎么避免？★
   答：垂直相邻 margin 合并取大；避免：flex/grid 布局、父加 overflow:hidden 或 flow-root。
9. rem 和 em？★
   答：rem 相对根字号，em 相对当前字号；嵌套 em 叠加放大，布局用 rem。
10. 百分比高度为什么会失效？
    答：父级高度由内容撑开时，百分比无从计算；高度链需显式设置。
11. CSS 变量 vs SCSS 变量？★
    答：CSS 变量运行态可改（JS/换肤），SCSS 编译期定死；设计态用 SCSS、动态用 CSS。
12. 为什么盒子总宽老算不对？
    答：默认 content-box，padding/border 外挂；border-box 后写多少就是多少。

### 布局（8）

13. 水平垂直居中全家桶？★★
    答：flex（justify+align:center）；grid place-items:center；绝对定位+margin:auto；
    不知尺寸用 transform:translate(-50%,-50%)。
14. flex 的主轴/交叉轴谁管对齐？
    答：justify-content 管主轴，align-items 管交叉轴；主轴方向由 flex-direction 决定。
15. flex: 1 是什么？★
    答：flex: 1 1 0%（放大1、收缩1、基础0）；按比例瓜分剩余空间。
16. 子项被压扁怎么办？
    答：flex-shrink: 0；长文本场景配 min-width: 0。
17. flex 和 grid 怎么选？★
    答：一维用 flex，二维/整页骨架/卡片墙用 grid。
18. grid 三件套？
    答：grid-template-columns / rows / gap；等宽列 repeat(3, 1fr)。
19. auto-fill + minmax 干嘛的？
    答：免媒体查询的响应式：至少 N px 一列，宽了加列、窄了换行。
20. 网格跨列怎么写？
    答：grid-column: 1 / -1 占满整行；span 2 = 跨两列。

### 定位与层叠（5）

21. position 五兄弟？★
    答：static/relative（占位+锚点）/absolute（找定位祖先）/fixed（视口）/sticky（吸顶）。
22. absolute 相对谁？
    答：最近的带 position 的祖先；没有就一路到根。
23. z-index 为什么不生效？★
    答：先比较两个元素"层叠上下文祖先"的层级，同组内才比 z-index；
    transform/opacity/fixed 等会创建新上下文。
24. BFC 是什么？怎么创建？★
    答：独立渲染结界；overflow:hidden、display:flow-root、flex/grid、absolute/fixed。
25. BFC 三大作用？
    答：防 margin 塌陷、包裹浮动、隔离文字环绕。

### 响应式与性能（5）

26. 响应式三件套？
    答：弹性单位（rem/vw/%）、弹性布局（flex/grid）、断点媒体查询。
27. 移动优先怎么写？
    答：默认窄屏样式 + @media (min-width: 断点) 增强。
28. clamp() 作用？
    答：min 与 max 之间随视口平滑缩放，减少断点。
29. 图片防溢出？
    答：max-width: 100%; height: auto。
30. transform/opacity 为什么动画流畅？★★
    答：只触发合成层（GPU），不触发 Layout/Paint；width/left 会重排掉帧。

### 动画与 SCSS（5）

31. transition 和 animation 区别？
    答：transition 需要触发 + 两个状态；animation 用 @keyframes 预编排可循环。
32. @keyframes 怎么定义？
    答：0%/100% 或 from/to 关键帧，animation 引用名称+时长+次数。
33. SCSS 三大核心能力？
    答：变量、嵌套（& 父选择器）、@mixin 传参复用。
34. scoped 原理？穿透怎么写？
    答：编译加 data-v 属性 + 属性选择器限定；子组件内部用 :deep()。
35. SCSS 变量能动态换肤吗？
    答：不能。运行时换肤用 CSS 变量（document 改 setProperty）。

## B. 高频手写题（面试现场写，每题 <2 分钟）

```css
/* 1. 垂直水平居中一个 200x100 的盒子（父已是相对定位） */
.box {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 200px; height: 100px;
}

/* 2. 三列等宽 + 间距 */
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

/* 3. 文字超长省略号（单行） */
.ellipsis { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

/* 4. 两行省略号 */
.clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* 5. 元素固定在页面右下角 */
.fab { position: fixed; right: 24px; bottom: 24px; }

/* 6. 顶部吸顶导航 */
.sticky { position: sticky; top: 0; z-index: 100; }

/* 7. 全屏遮罩（弹窗背景） */
.mask { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; }
```

## C. 常见坑速查表（写页面时翻）

| # | 坑 | 症状 | 解法（章节） |
|---|----|------|-------------|
| 1 | 样式改了不生效 | 被更高特定度覆盖 | 检查 DevTools 删线；提高特定度（1.5） |
| 2 | 盒子比预期宽 | content-box | 全局 border-box（2.2） |
| 3 | 两个上下 div 间距比预期小 | margin 塌陷 | flex 或 flow-root（2.3） |
| 4 | 字越嵌套越大 | em 叠加 | 换 rem（2.5） |
| 5 | 子元素挤压变形 | flex 默认收缩 | flex-shrink:0 / min-width:0（3.3） |
| 6 | absolute 跑错位置 | 父没定位 | 父加 relative（5.1） |
| 7 | z-index 9999 还压不住 | 祖先有 transform/fixed | 排查层叠上下文（5.2） |
| 8 | fixed 弹窗被裁剪 | 祖先 overflow/transform | 移出该容器（5.5） |
| 9 | 手机上页面被"缩小" | 缺 viewport meta | 加 <meta name="viewport">（6.7） |
| 10 | 图片撑破布局 | 无 max-width | max-width:100%（6.5） |
| 11 | hover 动效闪跳 | transition 写在 hover 上 | 写默认状态（7.1） |
| 12 | 动画结束跳回原位 | 无 fill-mode | animation-fill-mode: forwards（7.3） |
| 13 | scoped 改不了组件内部 | 作用域隔离 | :deep()（9.6） |
| 14 | 变量没生效 | 文件没导入 | 确认 @use/@import（9.8） |

## D. 面试问答套路（一页版）

1. "你不熟悉的 CSS 属性怎么处理？"
   答：查 MDN 文档 + 看 caniuse 兼容性 + 本地最小复现验证。不瞎记 API 名。
2. "有没有踩过样式 bug？"（必问，准备好案例）
   答：z-index 压不住 → 定位到祖先 transform 创建了层叠上下文；或
   scoped 改不动 Element UI → 用 :deep() 解决。讲清楚"现象→定位→修复→预防"。
3. "flex 和 grid 你倾向哪个？"
   答：一维 flex、二维 grid；整页骨架 grid areas，组件内部 flex。
4. "移动端适配怎么做的？"
   答：viewport meta + 弹性布局（flex/grid/clamp）+ 移动优先断点 + rem 字体。
5. "怎么提升页面渲染性能？"
   答：动画只用 transform/opacity；减少重排（批量改 DOM、避免深嵌套）；
   图片懒加载 + 尺寸占位；CSS 用类而非长选择器。

## E. 30 分钟冲刺路线

```
前 10 分钟：A 组 ★ 题过一遍（1/7/9/13/14/21/23/24/30）
中 10 分钟：B 组手写题默写 7 个
后 10 分钟：C 组坑表扫一遍 + 想好"踩过什么 bug"的故事
```

## 小结

- 最重要三块：优先级、flex/grid 布局、层叠上下文(z-index)——占比 60%。
- 手写题都是"短小日常"：居中、省略号、三列、fixed/sticky。
- 面试案例准备一个真实踩坑经历，比背十条概念有用。
- 现代性加分：@layer、:has()、clamp()、prefers-reduced-motion 随口能提。

至此《CSS 教程（后端工程师版）》10 章全部完成。