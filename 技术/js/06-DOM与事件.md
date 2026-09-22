# 第6章 DOM 与事件

> 一句话讲清：**DOM 是"浏览器中的 HTML 树"，JS 通过 API 增删改查这棵树；
> 事件是"用户操作/系统通知"广播，JS 挂在树上监听。** Vue/RuoYi 帮你封装了大部分
> DOM 操作，但事件机制（冒泡/委托/防抖）是面试必考、也是排查问题必备。
> Java 对照：DOM ≈ XML 文档对象模型；事件监听 ≈ 观察者模式/回调注册。

## 6.1 查找元素：四种选择器（现在几乎只用 querySelector 家族）

```html
<div class="card" id="device-card" data-id="7">
  <h3 class="card-title">调压器</h3>
  <button class="btn">刷新</button>
</div>
```

```js
// 一个选择器搞定所有查找（CSS 语法原样使用！）
document.querySelector('.card');           // 第一个 .card
document.querySelector('#device-card');    // 按 id
document.querySelectorAll('.btn');         // 所有 .btn（NodeList，可 forEach）
document.querySelector('.card .card-title'); // 后代选择器照常可用

// 老 API（知道即可，少用）
// document.getElementById/getElementsByClassName/getElementsByTagName
```

工程观点：**Vue 里几乎不用手工查 DOM（$refs 例外）；原生操作用在不引入框架的场景
或临时脚本。但面试手写题会考：给一个节点找父/子/兄弟。**

```js
const card = document.querySelector('.card');
card.parentElement;        // 父元素
card.children;             // 子元素集合
card.nextElementSibling;   // 下一个兄弟
card.dataset.id;           // "7"（data-* 属性）
```

## 6.2 改内容与样式：三个高频操作

```js
const node = document.querySelector('.card-title');

// ① 改文本（安全：不会当 HTML 执行）
node.textContent = '压力传感器A';

// ② 改 HTML（危险！用户输入会 XSS，见 6.5）
// node.innerHTML = '<b>bold</b>';

// ③ 改样式（两种方式）
node.style.color = 'red';              // 内联：优先级高于 class
node.classList.add('active');          // 推荐：加类而不是直接改样式
node.classList.remove('active');
node.classList.toggle('active');       // 有则删无则加（开关最常用）

// ④ 属性
node.setAttribute('data-status', 'online');
node.getAttribute('data-status');      // "online"
```

工程原则：**样式用 class 控制，JS 只切 class**（Vue 的 :class 就是这思想的框架化）。

## 6.3 事件：三种绑定方式与核心机制

```js
// ① 内联（古董，禁用）
// <button onclick="fn()">x</button>

// ② on 属性（一个元素一个处理函数，后写覆盖前写）
btn.onclick = () => console.log('点1');
btn.onclick = () => console.log('点2');   // 只有点2执行

// ③ addEventListener（现代标准：可绑多个、可移除）
const handler = () => console.log('点击');
btn.addEventListener('click', handler);
btn.removeEventListener('click', handler);   // 移除必须同一函数引用（匿名函数没法移除）
```

常用事件类型：click、dblclick、mouseenter/mouseleave、input（输入实时）、
change（失焦后变化）、submit（表单）、keydown/keyup（回车）、scroll、resize。

```js
// 表单提交阻止刷新（经典）
form.addEventListener('submit', e => {
  e.preventDefault();        // 阻止默认行为（刷新页面）
  sendData();                // 自己发请求
});

// 回车触发搜索
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') search();
});
```

## 6.4 事件冒泡与捕获：为什么点子元素也触发父元素的监听

事件传播三阶段（面试必背）：**捕获（父→子）→ 目标 → 冒泡（子→父）**。

```
捕获阶段：document → ... → 目标元素的父级 → 目标
目标阶段：到达目标元素
冒泡阶段：目标 → 父级 → ... → document    ← 默认监听在冒泡阶段触发
```

```js
outer.addEventListener('click', () => console.log('outer'));
inner.addEventListener('click', () => console.log('inner'));
// 点 inner，输出顺序：inner → outer（事件冒泡到 outer）

// 阻止冒泡
inner.addEventListener('click', e => {
  e.stopPropagation();        // 不再往上冒泡（点内层不会触发外层）
});

// 阻止默认行为（链接跳转、表单提交）
e.preventDefault();
```

**事件委托（面试高频 + 工程实用）**：与其给每个子元素绑监听，
不如把监听挂到父元素，利用冒泡统一处理：

```js
// 需求：列表里有 1000 个 li，点击打印内容
// ❌ 逐个绑：1000 个监听器
// ✅ 委托：1 个监听器，冒泡统一收
list.addEventListener('click', e => {
  const item = e.target.closest('li');   // 向上找最近的 li（防点空白）
  if (item) console.log('点击了', item.textContent);
});
```

优点：动态新增的 li 不用重新绑（事件自动冒泡到父级）；监听器数量 O(1)。

## 6.5 XSS 第一条防线：不要 innerHTML 用户输入

```js
// ❌ 危险：用户输入 <img src=x onerror=alert(1)> 会被当 HTML 执行
box.innerHTML = userInput;

// ✅ 安全：只当文本
box.textContent = userInput;

// 需要轻量富文本时：白名单过滤（DOMPurify 库），而不是直接拼
```

RuoYi 场景：富文本组件（editor）自己处理了安全，但你手写渲染接口返回的 HTML 时要警惕。

## 6.6 高频工程操作：防抖/节流接事件（回顾第4章）、懒加载

```js
// 搜索框：输入防抖（第4章定义的 debounce 直接可用）
const onInput = debounce(e => search(e.target.value), 300);
searchInput.addEventListener('input', onInput);

// 滚动加载：节流 + 判断接近底部
window.addEventListener('scroll', throttle(() => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
    loadMore();   // 接近底部加载下一页
  }
}, 200));
```

## 6.7 DOM 与渲染性能（面试加分）

```
操作 DOM → 触发重排/重绘（CSS 第7章讲过渲染管线）
```

```js
// ❌ 循环里改 DOM：每次都重排
for (let i = 0; i < 100; i++) {
  list.appendChild(createRow(i));     // 100 次重排
}

// ✅ 批量片段：一次插入
const frag = document.createDocumentFragment();
for (let i = 0; i < 100; i++) {
  frag.appendChild(createRow(i));
}
list.appendChild(frag);               // 1 次重排

// ✅ 或者干脆改 innerHTML 一次（数据量大且安全时）
list.innerHTML = rows.map(r => `<li>${r}</li>`).join('');
```

面试金句："**减少 DOM 操作次数：批量插入用 DocumentFragment，样式批量切换用
classList + class，读样式集中读取（避免读写交错强制同步布局）。**"

## 6.8 常见坑快查

| 坑 | 现象 | 解法 |
|----|------|------|
| 元素还没渲染就操作 | 拿到 null | 放 DOMContentLoaded 或脚本放 body 尾 |
| 点击子元素触发父事件 | 误触发 | e.stopPropagation() 或判断 target |
| 动态加的按钮没反应 | 事件绑在旧元素上 | 事件委托到父容器 |
| removeEventListener 无效 | 绑的是匿名函数 | 存引用再移除 |
| innerHTML 注入弹窗 | XSS | textContent 或 DOMPurify |
| for 循环里绑事件全取最后值 | var 作用域 | let / 委托 |

## 6.9 面试自测

- Q：事件传播三阶段？★
  A：捕获 → 目标 → 冒泡；默认监听在冒泡阶段触发。
- Q：事件委托是什么？为什么好？★
  A：监听挂父级靠冒泡统一处理；省监听器、动态元素免重绑。
- Q：stopPropagation 和 preventDefault 区别？★
  A：前者停冒泡（事件传不上去），后者阻止浏览器默认行为（跳转/提交）。
- Q：怎么安全地插入用户内容？
  A：textContent；富文本用白名单库（DOMPurify）。
- Q：批量渲染 1000 条怎么优化？
  A：DocumentFragment 一次插入 / 虚拟滚动 / 分页。

## 小结

- 查找用 querySelector/querySelectorAll，修改样式用 classList。
- 事件三阶段，监听默认走冒泡；委托省监听器、兼容动态元素。
- 安全红线：用户输入只进 textContent。
- 渲染性能：批量操作 DOM、读写分离。

下一篇：第7章 浏览器与网络（Fetch/Axios、同源策略、RuoYi 的 request.js）。