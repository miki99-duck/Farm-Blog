# 第4章 Grid 布局

> 一句话讲清：**Flexbox 管一维（一行或一列），Grid 管二维（可同时控制行和列）。
> 给容器一行 `display: grid` + 定义行/列轨道，子元素就按"网格地图"排队就座。**
> 面试策略：flex 是必答主力，grid 答得出"轨道的三件套 + 几个典型场景"就是加分项。

## 4.1 上手：三列等宽（对比 flex 的写法）

```css
/* flex 版：子元素按比例瓜分，靠子元素配合 */
.row { display: flex; }
.col { flex: 1; }

/* grid 版：一切在容器上定义，子元素完全不用管 */
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;   /* 三列，fr=剩余空间单位 */
  gap: 16px;
}
```

理解：**grid 是"画好网格，孩子入座"；flex 是"孩子们挤成一排再分空间"。**
fr 是 grid 里的"份"单位，等价思维对应 flex: 1 的瓜分逻辑。

## 4.2 轨道三件套：template-columns / rows / gap

```css
.grid {
  display: grid;
  grid-template-columns: 200px 1fr 2fr;  /* 固定 + 自适应 + 自适应（按2:1分） */
  grid-template-rows: auto 1fr auto;      /* 行：内容高 + 撑满 + 内容高（经典页脚结构） */
  gap: 12px;                             /* 行列间距一体 */
}
```

repeat() 语法（高频）：等宽列最常用

```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);   /* 与 1fr 1fr 1fr 等价 */
  /* minmax：最小 px 保底，最大 fr 伸展 —— 自适应卡片的灵魂 */
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
/* auto-fill + minmax：宽度够就多排一列，不够自动换行 → 纯 CSS 响应式卡片墙 */
```

## 4.3 经典实战：圣杯布局（头部+侧栏+内容+底部）

```html
<div class="layout">
  <header class="hd">顶部</header>
  <aside class="side">侧栏</aside>
  <main class="main">内容区</main>
  <footer class="ft">底部</footer>
</div>
```

```css
.layout {
  display: grid;
  grid-template-columns: 220px 1fr;   /* 侧栏 + 主区 */
  grid-template-rows: 56px 1fr 40px;  /* 头部 + 内容 + 底部 */
  grid-template-areas:                /* 用名字给孩子"指路" */
    "hd   hd"
    "side main"
    "ft   ft";
  height: 100vh;   /* 根元素也要满高，见第2章 7 高度链 */
}
.hd   { grid-area: hd; }
.side { grid-area: side; }
.main { grid-area: main; border: 1px solid #eee; border-radius: 8px; }
.ft   { grid-area: ft; }
```

这是 RuoYi 后台布局（侧边菜单 + 顶栏 + 内容区）的 grid 版本，
比一堆 float/absolute 的实现清晰十倍。**grid-template-areas 是最容易理解的写布局方式：看着像什么，就是什么。**

## 4.4 子元素显式指定位置：列号墙

```css
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
/* 让孩子跨越多列：grid-column 用"线号"，线从 1 开始 */
.feature { grid-column: 1 / 3; }  /* 占第1~2列（从线1到线3） */
.hero    { grid-column: 1 / -1; } /* -1 到最后一列：占满整行 */
.span2   { grid-column: span 2; } /* 直接说"跨2列"，不用数线 */
```

面试常考：grid-column: 1 / -1 让元素横跨整行（如通栏标题、banner）。

## 4.5 对齐家族（grid 里也有，缩写更爽）

```css
.justify-items: center;   /* 子项在"格子"内水平居中 */
.align-items: center;     /* 子项在"格子"内垂直居中 */
.place-items: center;     /* 全写：格子内居中 */
/* 还嫌不够：justify/align-content 控制"整组格子"在容器中的分布 */
```

## 4.6 响应式卡片墙（grid 的招牌场景）

```css
.card-wall {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.card { padding: 16px; border: 1px solid #eee; border-radius: 8px; }
```

效果：桌面 4~5 列，变窄自动减列，手机自动变 1 列——**没有一行媒体查询**。
对比 flex 版需要 flex: 1 1 260px + max-width 的配合，grid 的这一行是完整的。

追问：auto-fill 和 auto-fit 的区别？
答：auto-fill 排满为止（宁可留空列）；auto-fit 排不满就拉伸占满。
一般用 auto-fit 更常用（不留空）。

## 4.7 画一个真正的"九宫格仪表盘"

```css
.dashboard {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 120px);
  gap: 12px;
}
.panel { border: 1px solid #eee; border-radius: 8px; padding: 12px; }
.panel--wide { grid-column: span 2; }   /* 横跨两列 */
.panel--tall { grid-row: span 2; }      /* 纵跨两行 */
```

IoT 项目的大屏/看板就是这种结构：6~9 个面板，宽高组合成不同形态。

## 4.8 grid vs flex 选择表（面试加分）

| 场景 | 选谁 |
|------|------|
| 一行按钮居中对齐 | flex |
| 三列等宽卡片，自动换行 | grid |
| 顶部 + 侧栏 + 内容 + 底部整页骨架 | grid（areas） |
| 列表项：图标+标题+描述在一行 | flex |
| 子元素按比例瓜分剩余空间 | flex |
| 需要行列同时控制（表格/看板） | grid |
| "不知道多少列、自适应" | grid auto-fill + minmax |

口诀：**一维 flex，二维 grid；整页骨架和卡片墙用 grid，组件内部一行用 flex。**

## 4.9 面试自测

- Q：fr 单位是什么？
  A：grid 的剩余空间分配单位，1fr 等同 flex:1 的瓜分逻辑。
- Q：repeat(auto-fill, minmax(240px, 1fr)) 什么意思？
  A：至少 240px 一列，宽了自动加列，窄了自动换行——纯 CSS 响应式。
- Q：grid-template-areas 有什么好处？
  A：布局直接"像画图一样"声明结构，可读性碾压旧方案。
- Q：grid-column: 1 / -1 是什么？
  A：从第 1 条线跨到最后一条线，即占满整行。

## 小结

- grid = 二维布局：行轨道、列轨道、gap、区域命名。
- 三件套：grid-template-columns / rows / gap。
- auto-fill + minmax = 免媒体查询的响应式卡片墙。
- 骨架用 areas，看板用 1fr + span，组件内部仍用 flex。

下一篇：第5章 定位与层叠上下文（position 与 z-index 的爱恨情仇）。