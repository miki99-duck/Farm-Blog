---
tags: [js]
---

# 第4章 异步编程：Promise / async-await / 事件循环

> 一句话讲清：**JS 是单线程的，但靠"事件循环"把耗时操作排队执行不卡界面；
> Promise 是异步结果的"信封"，async/await 是让异步代码长得像同步的语法糖。**
> Java 对照：Promise ≈ CompletableFuture；async/await ≈ 异步方法的同步化写法；
> 事件循环 ≈ Java 主线程 + 任务队列（但 Java 多线程，JS 只有一条主线程）。

## 4.1 为什么需要异步：不说谎的例子

```js
// 同步代码：请求发出，线程干等 —— 浏览器会卡死
// ❌ 别这么做
const start = Date.now();
while (Date.now() - start < 3000) {}   // 模拟 3 秒卡顿
console.log('卡完了');
```

```js
// 异步代码：先"发出请求"，结果到了再回来执行回调
console.log('1. 开始');
setTimeout(() => console.log('3. 定时器回调'), 1000);
console.log('2. 主流程继续');          // 不必等定时器
// 输出顺序：1 → 2 → 3
```

理解核心：**JS 主线程不等待耗时操作，把"完成后要干什么"登记下来，先往下跑。
等操作完成，事件循环再回头执行登记的回调。**——这就是"非阻塞"。

## 4.2 回调地狱：异步的原始形态（认识它，别写它）

```js
// 回调嵌套：顺序调用三个接口，逻辑越套越深
getToken(token => {
  getDevice(token, deviceId => {
    getHistory(deviceId, history => {
      console.log(history);   // 三层缩进（真实项目能到五层+）
    });
  });
});
```

三大问题：1) 可读性崩溃 2) 错误处理散落 3) 难以并行/串行控制。
→ Promise 就是为了治它而生的。

## 4.3 Promise：异步结果的"信封"

```js
// 创建：new Promise((resolve, reject) => ...)
const fetchDevice = (id) => new Promise((resolve, reject) => {
  setTimeout(() => {
    if (id > 0) resolve({ id, name: '设备' + id });   // 成功：拆信封
    else reject(new Error('id 非法'));                 // 失败：扔信封
  }, 200);
});

// 使用：.then 拿结果，.catch 接错误，.finally 收尾
fetchDevice(1)
  .then(device => console.log('拿到:', device.name))
  .catch(err => console.error('失败:', err.message))
  .finally(() => console.log('无论成败都会执行'));

// 链式串联：then 返回 Promise 就能继续（替代回调嵌套）
fetchDevice(1)
  .then(device => fetchHistory(device.id))   // 返回新 Promise
  .then(history => console.log('历史:', history))
  .catch(err => console.error(err));
```

Promise 三状态（面试必背）：pending（等待中）→ fulfilled（成功 resolve）/ rejected（失败 reject），
**状态一旦改变不可逆**。

并行工具（业务高频）：

```js
// Promise.all：全部成功才继续（一个失败全失败）—— 相当于"等所有"
const [user, devices] = await Promise.all([
  fetchUser(), fetchDevices(),
]);

// Promise.allSettled：不管成败都等全部结果（适合批量，一个失败不影响看别的）
const results = await Promise.allSettled(devices.map(fetchOne));
results.forEach(r => r.status === 'fulfilled' ? handleOk(r.value) : handleErr(r.reason));

// Promise.race：谁先完成用谁（超时器/竞速）
const withTimeout = Promise.race([fetchDevice(1), timeout(3000)]);
```

## 4.4 async / await：让异步代码"说人话"

```js
// async 函数：内部 await 阻塞"看起来"，实际不卡主线程
async function loadDashboard() {
  try {
    // await 会"暂停"函数继续往下，但让出主线程 —— 只是语法上的暂停
    const device = await fetchDevice(1);      // 等 Promise 落定
    const history = await fetchHistory(device.id);
    return { device, history };               // async 函数返回的是 Promise！

    // 串行写法：一目了然 = 回调地狱的可读版
  } catch (err) {
    // try-catch 接错误：和同步代码一样自然（回调时代做不到）
    console.error('加载失败:', err);
    return null;
  }
}

// 使用：async 函数一定返回 Promise，要 await 或 .then 拿结果
const data = await loadDashboard();
```

await 的规则（面试容易问）：
- await 只能用在 async 函数里（顶层 await 在现代模块支持）；
- `await` 后面接任意值，非 Promise 会被包装成已成功的 Promise（`await 5` 得到 5）；
- 不写 await 的 Promise 调用 = 发出去不管（异步执行，不阻塞）。

串行 vs 并行（性能关键）：

```js
// ❌ 串行：第二个请求等第一个，浪费（两个请求无依赖却排队）
async function slow() {
  const a = await fetchDevice(1);
  const b = await fetchDevice(2);   // 白白多等一个网络往返
}

// ✅ 并行：同时发出两个请求（Promise.all 或先取 Promise 再 await）
async function fast() {
  const p1 = fetchDevice(1);        // 已经发出去了
  const p2 = fetchDevice(2);        // 同时发出
  const [a, b] = await Promise.all([p1, p2]);  // 一起等待
}
```

面试金句："**多个无依赖的请求要并行（Promise.all），有依赖的才 await 串联**；await 一次只等一个，串行是新手最常见的性能坑。"

## 4.5 事件循环：单线程怎么做到"不卡"（面试重灾区）

JS 运行时核心模型：

```
 ┌────────────────────────────┐
 │    调用栈 Call Stack（主线程）│  ← 同步代码在这里跑
 └────────────────────────────┘
        ↘ 遇到异步 → 交给 Web APIs（定时器/网络/IO）
        ↘ 完成 → 回调进"任务队列"
 ┌────────────────────────────┐
 │ 宏任务队列：setTimeout/setInterval/I/O     │
 │ 微任务队列：Promise.then/await 之后        │
 └────────────────────────────┘
 事件循环：调用栈清空 → 先清空"微任务队列" → 再取一个"宏任务" → 循环
```

```js
console.log('1 同步');
setTimeout(() => console.log('4 宏任务'), 0);
Promise.resolve().then(() => console.log('2 微任务'));
Promise.resolve().then(() => console.log('3 微任务'));
// 输出：1 → 2 → 3 → 4
```

为什么 2/3 在 4 前面：**每轮事件循环先清空微任务队列，再取下一个宏任务。**
（setTimeout 即使 0ms 也是宏任务，要排在微任务后面。）

面试输出题高频模板（背结论）：

```js
setTimeout(() => console.log('a'));      // 宏任务
new Promise(r => { console.log('b'); r(); })   // Promise 构造器是同步执行！
  .then(() => console.log('c'));        // 微任务
console.log('d');
// 答案：b d c a
// 解释：Promise 构造函数里的代码立即执行(b)；then 注册为微任务；
//       d 同步；本轮微任务先执行 c；最后宏任务 a。
```

核心结论三条（足够应付 90% 题）：
1. **同步代码先跑完**；
2. **Promise 构造器是同步的，.then 是微任务**；
3. **每轮先微任务后宏任务**（微任务队列清空才算一轮）。

## 4.6 防抖与节流（异步思想的工程应用，面试手写必考）

```js
// 防抖 debounce：停止触发后 delay 才执行（搜索框、窗口 resize）
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);              // 每次触发都取消上一个
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
// 用户疯狂输入时只触发最后一次

// 节流 throttle：固定间隔执行（滚动加载、按钮防连点）
function throttle(fn, interval = 300) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}
// 高频触发时保证至少 interval 才执行一次
```

记忆：**防抖"等你不动了再干"（最后一下），节流"限速器"（定时一个）**。
两个都是闭包（第2章）的经典应用——timer/last 被私有保存。

## 4.7 异步常见坑快查

| 坑 | 现象 | 解法 |
|----|------|------|
| 忘记 await | 拿到 Promise 而非结果 | 检查调用处；ts 会提示 |
| 串行 await 慢了 | 无依赖请求排队 | Promise.all 并行 |
| catch 没接到错误 | await 在非 async 函数 | 函数加 async 或用 .catch |
| 微任务/宏任务顺序记错 | 输出题全错 | 背"先微后宏" |
| 回调里的 this 丢了 | 见第2章 | 箭头函数 |
| unhandled rejection | 没人 catch 的失败 | 全局 window.onunhandledrejection 兜底 |

## 4.8 面试自测

- Q：Promise 三状态？★
  A：pending/fulfilled/rejected，状态一旦确定不可逆。
- Q：async/await 的原理？★
  A：语法糖：async 函数返回 Promise；await 暂停函数等待结果，内部本质仍是 then 回调。
- Q：为什么说 await 是"假阻塞"？
  A：只挂起当前 async 函数，主线程照常执行其他任务（微任务/宏任务照跑）。
- Q：事件循环的执行顺序？★★
  A：同步栈 → 微任务清空 → 宏任务；微任务优先于宏任务。
- Q：防抖和节流区别？★
  A：防抖只执行最后一次（等停下），节流按固定间隔执行。

## 小结

- JS 单线程不等待：耗时操作登记回调，事件循环回头执行。
- Promise 治回调地狱：then/catch/all/race；async/await 是它的"人话版"。
- 无依赖请求必须并行：Promise.all 或先取 Promise 再等。
- 事件循环："先微后宏"背下来，输出题全对。
- 防抖节流 = 闭包 + 定时器，面试手写必背。

下一篇：第5章 字符串与正则（解析、校验、替换高频场景）。