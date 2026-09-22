# 第1章 CSS 基础：选择器、优先级与层叠

> 一句话讲清：CSS 有三件事——**选到谁（选择器）→ 谁说了算（优先级）→ 最终长啥样（层叠）**。
> 后端工程师类比：选择器 = SQL 的 WHERE，优先级 = Java 的方法重载解析，层叠 = 继承体系里的覆盖规则。

## 1.1 CSS 是怎么生效的

三种方式，优先级从低到高（内联最高）：

```html
<!-- ① 外部样式（正规做法，推荐） -->
<link rel="stylesheet" href="/css/app.css">

<!-- ② 内嵌样式（单页/临时调试） -->
<style>
  .btn { color: blue; }
</style>

<!-- ③ 内联样式（尽量不用，无法复用、特定度最高） -->
<button style="color: red;">点我</button>
```

后端工程师立刻会问的问题：多个规则冲突了怎么办？——这就是后两节的内容。

## 1.2 选择器：你怎么"选中"元素

### 基础四件套

```css
/* 标签选择器：命中所有 button */
button { cursor: pointer; }

/* 类选择器：命中 class="btn" 的元素（最常用） */
.btn { padding: 8px 16px; }

/* ID 选择器：命中 id="header" 的元素（页面唯一，别滥用） */
#header { height: 60px; }

/* 通配符：命中所有元素 */
* { box-sizing: border-box; }
```

### 组合器（关系选择）

```css
/* 后代："div 里的所有 p"，不管多深 */
div p { line-height: 1.6; }

/* 子代：只命中 div 的直接子元素 p */
div > p { margin: 0; }

/* 相邻兄弟：紧跟在 h2 后面的第一个 p */
h2 + p { color: #666; }

/* 通用兄弟：h2 后面所有的 p */
h2 ~ p { margin-left: 1em; }
```

### 属性与状态选择器（RuoYi 表单里很常用）

```css
/* 属性选择器：命中带 disabled 属性的 input */
input[disabled] { background: #f5f5f5; }

/* 命中 type="text" 的 input（注意 [type="..."] 精确匹配） */
input[type="text"] { border: 1px solid #ccc; }

/* 伪类：状态 */
.btn:hover { background: #409eff; }        /* 悬停 */
.btn:active { background: #337ecc; }       /* 按下 */
input:focus { border-color: #409eff; }     /* 聚焦 */

/* 结构性伪类：nth-child 是高频考点 */
li:nth-child(2n) { background: #fafafa; }  /* 偶数行斑马纹 */
li:first-child { font-weight: bold; }
li:last-child { border-bottom: none; }
```

### 现代选择器（老教程没有，面试加分）

```css
/* :is() —— 分组选择器的"或"，特定度取参数里最大的那个 */
/* 等价于 header p, main p, footer p，但写法更紧凑 */
:is(header, main, footer) p { color: #333; }

/* :where() —— 和 :is 一样分组，但特定度恒为 0（好覆盖） */
:where(.card, .panel) h3 { margin-bottom: 8px; }  /* 后面任意规则都能覆盖它 */

/* :has() —— 父选择器！选中"包含某子元素"的父元素（2023 年后全浏览器支持） */
/* 例：卡片里如果有图片，就让标题变色 */
.card:has(img) .card-title { color: #409eff; }

/* :not() —— 排除 */
input:not([disabled]) { background: #fff; }
```

## 1.3 优先级（特异度）：谁说了算

面试必考。CSS 给每条规则算一个"权重"，数值越大越优先：

```
内联样式          →  (1, 0, 0, 0)
ID 选择器         →  (0, 1, 0, 0)   每个 ID 加 1 个 b
类/属性/伪类      →  (0, 0, 1, 0)   每个类加 1 个 c
标签/伪元素       →  (0, 0, 0, 1)   每个标签加 1 个 d
```

比较规则：**从高位到低位逐个比，某一位大就直接赢，不看后面**。
`(0, 1, 0, 0)` > `(0, 0, 15, 0)`（15 个类也打不过 1 个 ID）。

代码1：算一算谁生效

```html
<div id="app" class="box">
  <p class="text" id="intro">这段文字什么颜色？</p>
</div>
```

```css
/* A: 特定度 (0,1,0,1) → 1 个 id + 1 个标签 */
#app p { color: blue; }

/* B: 特定度 (0,0,1,0) → 1 个类 */
.text { color: green; }

/* C: 特定度 (0,1,0,1) → 1 个 id + 1 个标签，和 A 同级，谁后写谁赢 */
div #intro { color: red; }
```

结论：B 的类(0,0,1,0) 打不过带 ID 的规则 → 蓝色还是红色取决于 A/C 的顺序，后写者胜。
标准答案是：**这题考两个知识点——ID > 类；同级比顺序。**

### !important 与内联

```css
/* !important 凌驾一切（内联样式除外），但它是"核按钮"，滥用会使维护爆炸 */
.text { color: orange !important; }
```

优先级总排序（面试背这个）：

```
!important > 内联样式 > ID > (类/属性/伪类) > (标签/伪元素) > 浏览器默认
```

后端工程师角度：!important 就像 Java 里到处用 static——能用但别用；
它往往是"上一手代码偷懒"的信号，正确做法是提高特定度或调整结构。

### 实际开发的原则（比背权重更重要）

1. **类选择器打天下**：全项目用 .btn、.card 这种类，不写 #id 样式（RuoYi 就这么干）。
2. **特定度尽量压扁**：永远写 (0, 0, 1, 0) 级别，别叠 #app .box .btn 这种长链。
3. **覆盖用同类权重 + 后写**：Element UI 的样式改不动时，优先看是不是特定度不够。

## 1.4 层叠：最终值是怎么决定的

层叠是一场"多规则对战"，决定胜负的三要素按顺序比较：

```
1. 来源与重要性：!important 的作者样式 > 作者样式 > 浏览器默认
2. 特定度：见 1.3
3. 书写顺序：同样权重，后写的赢（CSS 的"就近原则"）
```

代码2：顺序胜出的典型现场

```css
.btn { background: gray; }
.btn { background: green; }   /* 后写，赢 → 按钮是绿色 */
```

### 继承（另一条隐形规则）

有些属性（color、font-*、line-height、text-align）会**继承**给子元素；
有些不会（margin、padding、border、background、width/height）。

```css
body { font-size: 14px; color: #333; }
/* 所有子元素默认继承 14px 和 #333，不用每个元素都写 */

/* 想显式控制继承，用 inherit / initial / unset */
a { color: inherit; }        /* 链接使用父级颜色（RuoYi 列表里常见） */
h1 { margin: initial; }      /* 重置为初始值（相当于 0） */
```

后端类比：继承 ≈ 父类成员变量传给子类；initial ≈ 恢复默认构造。

### @layer：现代团队解决"顺序战争"的正规军

```css
/* 声明层的顺序就是优先级顺序：后面的层赢前面的层 */
@layer reset, components, utilities;

@layer reset {
  button { border: none; }        /* 被 utilities 覆盖 */
}
@layer utilities {
  .p-2 { padding: 8px; }
}
```

好处：不再靠"把覆盖代码写在最后"这种隐性约定，层顺序一目了然。老项目少见，新项目推荐。

## 1.5 遇到"样式不生效"的排查三步（90% 问题秒解）

```
① 选择器命中了吗？        → DevTools 里看 Elements 面板，有没有灰色删除线
② 特定度够吗？            → 是不是被更高权重（如组件库的 !important）压了
③ 书写顺序对吗？          → 同权重规则，后写的赢；检查是不是加载顺序问题
```

DevTools 的 Styles 面板会直接告诉你"哪条规则赢、为什么赢"，这是最快的调试方式。

## 1.6 面试自测

- Q：!important、内联、ID、类、标签的优先级排序？
  A：!important > 内联 > ID > 类/属性/伪类 > 标签/伪元素 > 默认。
- Q：(0,2,0,0) 和 (0,0,10,0) 谁大？
  A：前者。高位优先，10 个类也打不过 2 个 ID。
- Q：:is() 和 :where() 区别？
  A：行为相同（分组），但 :is 取参数最高特定度，:where 恒为 0。
- Q：哪些属性会继承？
  A：字体/颜色/行高类继承；盒模型/布局类不继承。

## 小结

- 三件事：选择器（选到谁）、优先级（谁说了算）、层叠（最终值）。
- 类选择器打天下，别滥用 ID 和 !important。
- 继承：字体颜色传下去，盒模型不传。
- 排查三步：命中？特定度？顺序？

下一篇：第2章 盒模型与单位（一切尺寸的地基）。