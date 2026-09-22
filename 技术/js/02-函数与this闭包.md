# 第2章 函数与 this（JS 的灵魂）

> 一句话讲清：**函数在 JS 里是一等公民（能当参数、能当返回值），this 是"谁调用指向谁"
> 的隐式参数，闭包是"函数连同它出生时的环境打包带走"。**
> Java 对照：函数 ≈ 方法，但可以独立存在、可以传来传去（Java 8 的 Function/Lambda 是后来补的）；
> this ≈ Java 的 this，但 JS 的 this 不绑定定义位置（箭头函数除外）。

## 2.1 三种定义方式（能力相同，细节不同）

```js
// ① 函数声明：有提升，可以先调用后定义
function add(a, b) { return a + b; }
add(1, 2);   // 3

// ② 函数表达式：赋给变量，无提升（必须先定义再调用）
const sub = function (a, b) { return a - b; };
sub(3, 1);   // 2

// ③ 箭头函数（现代主力）：更短 + this 是词法绑定（见 2.4）
const mul = (a, b) => a * b;     // 单表达式可省 return 和大括号
mul(2, 3);   // 6

// ④ 立即执行函数 IIFE（老代码常见：隔离作用域）
(function () { console.log('只执行一次'); })();
```

RuoYi 代码里三种都有：普通函数方法、箭头函数（回调里最多）、IIFE 在旧工具文件里。

## 2.2 参数：默认值、剩余参数

```js
// 默认参数：不给就兜底
function greet(name = '游客') {
  return `你好，${name}`;
}
greet();          // "你好，游客"
greet('李四');     // "你好，李四"

// 剩余参数：收集"多余"参数为数组（注意区分 arguments）
function buildUrl(path, ...params) {
  return `${path}?ids=${params.join(',')}`;
}
buildUrl('/api/devices', 1, 2, 3);
// "/api/devices?ids=1,2,3"

// 传参技巧：对象解构参数（命名参数风格，比位置参数可读）
function queryDevices({ page = 1, size = 10, status } = {}) {
  return `page=${page}&size=${size}&status=${status ?? 'all'}`;
}
queryDevices({ size: 20 });
// "page=1&size=20&status=all"
```

## 2.3 闭包：函数 + 出生环境的"打包"

```js
function counter() {
  let count = 0;              // 这个变量"活"在函数内部
  return function () {        // 返回的函数把 count 一起带走了
    count++;
    return count;
  };
}

const c1 = counter();
c1();  // 1
c1();  // 2 —— count 还活着，而且只有这个函数能碰它
const c2 = counter();
c2();  // 1 —— 另一个独立的 count
```

闭包三要素（面试背）：
1. 函数内部定义函数；
2. 内层函数引用外层变量；
3. 外层函数把内层函数 return 出去 → **外层变量不销毁，被"私有化"**。

闭包的作用（工程上）：
- **私有变量**：模拟 Java 的 private（上面 counter 的 count）；
- **柯里化/高阶函数**（2.5）；
- **防抖节流**（第6章）——闭包保存 timer；
- 经典坑：循环中用 var 创建闭包，全拿到同一个变量（第1章 1.7 已演示，用 let 修复）。

## 2.4 this：谁调用指向谁（重灾区）

this 的确定规则（普通函数）：**运行时看"调用点"**，不看你写在哪。

```js
// 规则1：直接调用（无修饰）→ this 是 undefined（严格模式）或全局对象
function show() { console.log(this); }
show();                      // 浏览器: window / undefined(strict)

// 规则2：作为对象方法调用 → this 指向该对象
const obj = { name: '设备A', show() { console.log(this.name); } };
obj.show();                  // "设备A" —— obj 调的，this=obj

// 规则3：call/apply/bind 显式指定
function hi() { console.log(this.name); }
hi.call({ name: 'X' });      // "X"
const bound = hi.bind({ name: 'Y' });
bound();                     // "Y"

// 规则4：箭头函数 → 没有自己的 this！沿"定义处"向上找（词法绑定）
const obj2 = {
  name: '设备B',
  arrow: () => console.log(this.name),    // ❌ this 是外层（定义处），不是 obj2
  normal() { console.log(this.name); }    // ✅ this=obj2
};
obj2.arrow();   // undefined —— 箭头不绑定调用者
obj2.normal();  // "设备B"
```

### 高频场景：回调里的 this 丢失

```js
const device = {
  name: 'CR007',
  timer: null,
  start() {
    // ❌ 普通函数回调：this 变 undefined，访问 this.name 会炸
    // this.timer = setInterval(function () { console.log(this.name); }, 1000);

    // 修复1：箭头函数（继承外层 this）—— 现代首选
    this.timer = setInterval(() => console.log(this.name), 1000);

    // 修复2：先存 this（老代码写法）
    // const self = this;
    // this.timer = setInterval(function () { console.log(self.name); }, 1000);

    // 修复3：bind
    // this.timer = setInterval(function(){...}.bind(this), 1000);
  }
};
```

面试标准答案：**"this 由调用方式决定（谁调用指向谁）；回调函数里 this 会丢，
用箭头函数继承外层 this 解决；call/apply/bind 可显式绑定；箭头函数没有自己的 this。"**

## 2.5 高阶函数：函数当参数/返回值（数组章节的地基）

```js
// 函数作为参数：工具函数（Java 8 的 Function 接口就是这套思想）
function withLog(fn) {
  return function (...args) {
    console.log('调用参数:', args);
    const result = fn(...args);
    console.log('返回:', result);
    return result;
  };
}
const loggedAdd = withLog((a, b) => a + b);
loggedAdd(1, 2);   // 打印参数 + 返回 3

// 函数作为返回值：柯里化（固定一个参数，返回更窄的函数）
const createAdder = (base) => (n) => base + n;
const addTen = createAdder(10);
addTen(5);   // 15
```

## 2.6 call / apply / bind（三兄弟区别）

| 方法 | 立即执行？ | 传参方式 | 用途 |
|------|-----------|---------|------|
| fn.call(obj, a, b) | ✅ | 逐个传 | 临时指定 this |
| fn.apply(obj, [a, b]) | ✅ | 数组传 | 参数本来是数组时 |
| fn.bind(obj) | ❌ 返回新函数 | 之后调用时传 | 固定 this 长期用 |

```js
// apply 经典用途：找数组最大/最小
const nums = [3, 1, 9, 4];
Math.max.apply(null, nums);      // 9（老写法）
Math.max(...nums);               // 9（现代写法，展开运算符，见第3章）
```

## 2.7 常见坑快查

| 坑 | 现象 | 原因/解法 |
|----|------|----------|
| 回调里 this undefined | 方法内部用 this 访问属性 | 箭头函数 / bind / 存 self |
| 闭包变量全是最后值 | 循环里创建回调 | let 循环变量 |
| 函数声明重复 | 覆盖 silent | 函数表达式 + const |
| 箭头函数当构造函数 | new 报错 | 箭头没有 prototype；需要 this 场景用普通函数 |
| arguments 在箭头函数里 | 未定义 | 用剩余参数 ...args |

## 2.8 面试自测

- Q：this 的指向规则？★
  A：谁调用指向谁；直接调用 undefined/global；方法调用对象；call/apply/bind 显式；箭头词法绑定。
- Q：闭包是什么？为什么能一直访问外层变量？★
  A：函数+环境打包；外层函数被 return 内层持有引用，作用域不被回收。
- Q：闭包有什么实际用途？
  A：私有变量、防抖节流、柯里化、模块模式。
- Q：箭头函数和普通函数区别？★
  A：写法短；无自己的 this（词法绑定）；不能 new；无 arguments；无 prototype。
- Q：apply 和 call 区别？
  A：传参方式（数组 vs 逐个）；都是立即执行。

## 小结

- 函数一等公民：可传参、可返回、可赋值——高阶函数与闭包由此而来。
- 闭包 = 函数 + 被私有化的外层变量（防抖节流的地基）。
- this 看调用点；回调丢 this 用箭头修复。
- 面试主战场：this 规则、闭包、箭头 vs 普通。

下一篇：第3章 数组与对象（写业务逻辑最频繁的一章）。