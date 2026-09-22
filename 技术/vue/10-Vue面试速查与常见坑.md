# 第10章 Vue 面试速查与常见坑（考前 30 分钟）

> 使用方式：先自己答再对答案；★ 最高频。答不上来回对应章节。
> 这章也是 RuoYi 页面出问题时的"排查字典"——Vue 的坑大多集中在响应式、
> 生命周期时机、异步更新三点。

## A. 知识点速查（45 问版）

### 响应式与数据（9）

1. Vue2 响应式原理？★★
   答：defineProperty 逐属性劫持 + 依赖收集（Watcher）；改属性触发视图更新。
2. Vue2 响应式边界？★
   答：新增属性不响应（$set）、数组下标赋值不响应（splice/$set）；Vue3 Proxy 消除。
3. Vue3 响应式原理？
   答：new Proxy 代理整个对象，增删属性/下标都拦截。
4. data 为什么是函数？★
   答：组件复用要独立状态实例；对象 return 会共享引用。
5. v-if 和 v-show 区别？★
   答：v-if 销毁/创建，v-show display 切换；频繁切换用 v-show。
6. v-for 为什么需要 key？★
   答：diff 识别元素身份，防错乱、提性能；用唯一 id 不用 index。
7. 修改数据后 DOM 不更新？
   答：异步批量更新；this.$nextTick 等 DOM 更新后操作。
8. key 用 index 有什么问题？★
   答：列表增删/重排时复用错节点，输入框值错乱、状态错位。
9. 深度监听怎么写？注意事项？
   答：watch: { obj: { handler, deep: true } }；开销大，能用路径监听不用 deep。

### 组件与通信（10）

10. 什么是单向数据流？★★
    答：props 只读父传子；子不能再改，要改通过 $emit 让父改。
11. 父传子/子传父？★★
    答：父传子 props；子传父 this.$emit('event', data) + @event 监听。
12. props 能直接改吗？想改怎么办？
    答：不能；data 初始化 / computed / $emit 回传。
13. 插槽是什么？具名/作用域插槽？★
    答：父向子指定位置塞内容；<slot name="x"> 配 #x；<slot :row="row"> 配 #x="{ row }"。
14. provide/inject 场景？
    答：跨多层传上下文（配置/能力）；隐式耦合，别滥用。
15. ref 拿到什么？
    答：子组件实例/DOM，可调方法（如表单校验）；v-for 里是数组。
16. EventBus 为什么慎用？
    答：难追踪、易泄漏、隐式耦合；全局状态用 Vuex/Pinia。
17. 组件通信方式总表？★
    答：props（父子）、$emit（子父）、插槽（填充）、provide/inject（跨层）、
    ref（越权调用）、Vuex（全局）。
18. 生命周期顺序？★
    答：beforeCreate → created → beforeMount → mounted → beforeUpdate → updated
    → beforeDestroy → destroyed；父 created 先、子 mounted 先。
19. created 和 mounted 区别？★
    答：created data 可用但 DOM 无；mounted DOM 就绪可绑第三方。

### computed / watch / 方法（6）

20. computed 和 watch 区别？★
    答：computed 缓存+派生值；watch 副作用+监听变化；能用 computed 不用 watch。
21. computed 和 methods 区别？★
    答：computed 有缓存（依赖不变不重算），methods 每次调用都执行。
22. computed 为什么能缓存？
    答：依赖收集，依赖变才重算。
23. watch 的 deep 和 immediate？★
    答：deep 深监听对象内部；immediate 创建时立即执行一次。
24. computed 能做到 watch 的事吗？
    答：不能做副作用（请求），它必须纯；副作用放 watch。
25. 搜索条件变化自动刷新页面的套路？
    答：watch 条件 → 重置 pageNum=1 → 重新 getList。

### Vuex 与路由（8）

26. Vuex 五大件？★
    答：state/getters/mutations/actions/modules。
27. 为什么 mutation 必须同步？★
    答：DevTools 需要精确记录变更；异步放 actions。
28. actions 和 mutations 区别？★
    答：actions 可异步调接口、提交多个 mutation；mutations 同步改 state。
29. 页面刷新 Vuex 丢失？
    答：初始化时从 localStorage/cookie 恢复（RuoYi token 存 cookie）。
30. $router 和 $route 区别？★
    答：$router 实例管跳转；$route 当前路由信息（path/query/meta）。
31. query 和 params 区别？★
    答：query 在 ? 后刷新保留；params 需 name 才稳定、刷新易丢。
32. 路由守卫？动态路由权限？★★
    答：beforeEach 检查 token → getInfo 拿权限 → generateRoutes →
    router.addRoutes 动态挂载 → 菜单渲染 + v-hasPermi 按钮显隐 → 后端 @PreAuthorize 兜底。
33. 路由懒加载？
    答：() => import('@/views/x') 按需打包，首屏只加载当前页 chunk。

### Element UI 与工程（7）

34. el-table 自定义列怎么拿行数据？★
    答：<template slot-scope="scope">，scope.row 是当前行。
35. 新增/编辑复用弹窗？
    答：同一 dialog；编辑先查详情回填；提交按 id 有无分 add/update；成功刷新列表。
36. 表单校验流程？
    答：rules + el-form-item prop 对应 + this.$refs.form.validate(callback)。
37. 分页和查询联动？
    答：queryParams 带 pageNum/pageSize；:page.sync :limit.sync + @pagination 再查。
38. v-hasPermi 原理？
    答：自定义指令检查 store permissions，没有则移除元素。
39. 过滤器为什么没了？（Vue3）
    答：Vue3 删除 filter，用函数/计算属性。
40. Vue2→Vue3 全局 API 变化？
    答：Vue.use→app.use、Vue.prototype→globalProperties、new Vue→createApp。

### 工程与性能（5）

41. 大数据列表渲染优化？
    答：分页/懒加载、虚拟滚动、key 唯一、避免深嵌套 watcher。
42. 为什么首屏慢？
    答：路由懒加载没做、包大没按需、请求串行；用 Vite/CDN/按需引入。
43. 内存泄漏怎么防？
    答：定时器/监听在 beforeDestroy 清理；EventBus 记得 $off。
44. MVVM 是什么？
    答：Model-View-ViewModel；Vue 是 MVVM 实践：数据模型(M)→视图(V)自动同步，
    VM 就是 Vue 实例（响应式+指令）。
45. Vue2/Vue3 选型理由（面试观点题）？
    答：Vue2 生态成熟（RuoYi）；新项目看 Vue3（Proxy、组合式、Vite、长期支持）。

## B. 高频手写题（现场写，每题 <2 分钟）

```js
// 1. 实现简易响应式（概念版，面试常让手写）
function reactive(obj) {
  Object.keys(obj).forEach(key => {
    let value = obj[key];
    Object.defineProperty(obj, key, {
      get() { return value; },
      set(newVal) { value = newVal; /* 通知更新（省略 Watcher） */ }
    });
  });
  return obj;
}

// 2. 防抖的 Vue 用法（搜索防抖，第4章 JS 已写工具）
methods: {
  onSearch: debounce(function () { this.getList(); }, 300)
}

// 3. 删除数组某项（不可变）
this.list = this.list.filter(item => item.id !== targetId);

// 4. 更新数组某一项（不可变）
this.list = this.list.map(item =>
  item.id === id ? { ...item, online: true } : item
);

// 5. 深度监听字段变化重查（watch 套路）
watch: {
  'queryParams.status'(val) {
    this.queryParams.pageNum = 1;
    this.getList();
  }
}

// 6. 路由守卫登录检查（概念版）
router.beforeEach((to, from, next) => {
  getToken() ? next() : next('/login');
});

// 7. 展开对象给 el-table 行加序号列（临时渲染技巧）
// {{ scope.$index + 1 + (queryParams.pageNum - 1) * queryParams.pageSize }}
```

## C. 常见坑速查表（debug 时翻）

| # | 坑 | 现象 | 解法（章节） |
|---|----|------|-------------|
| 1 | 新增属性页面不变 | $set 没写 | this.$set（1.4） |
| 2 | 数组改下标页面不变 | 下标赋值 | splice / $set（1.4） |
| 3 | 列表状态错乱 | key 用 index | 改唯一 id（1.3） |
| 4 | 改数据 DOM 没跟上 | 异步更新 | $nextTick（1.8） |
| 5 | 子组件改 props 警告 | 单向数据流 | $emit 回传（2.4） |
| 6 | 组件不渲染 | 忘注册 | import + components（2.6） |
| 7 | 定时器一直跑 | 没清理 | beforeDestroy clear（2.5） |
| 8 | watch 监听对象不触发 | 浅监听 | deep / 路径监听（4.2） |
| 9 | 弹窗表单残留报错 | 没 reset | destroy-on-close + resetFields（7.4） |
| 10 | 页面 404 / 菜单不显示 | 动态路由/权限 | 守卫+addRoutes（6.4/9.5） |
| 11 | 接口 401 跳循环 | 守卫误拦截 | 白名单 /next 条件（6.4） |
| 12 | 分页点了不动 | .sync 缺失 | :page.sync :limit.sync（7.3） |
| 13 | 生产环境接口 404 | baseURL | VUE_APP_BASE_API/代理（JS第8章） |
| 14 | Vue3 忘了 .value | 页面不更新 | 脚本里 .value（8.5） |

## D. 面试问答套路（一页版）

1. "Vue 双向绑定原理？"（老题必问）
   答：语法糖 + 响应式：v-model = :value + @input；
   数据劫持（defineProperty/Proxy）+ 依赖收集 + 派发更新；
   Vue3 用 Proxy 全面代理。
2. "讲讲 Vue 的生命周期？"（必问）
   答：背顺序 + 两个关键钩子（created 拿数据、mounted 操作 DOM、beforeDestroy 清理）
   + 父子的执行顺序（父 created 先，子 mounted 先）。
3. "RuoYi 项目里你负责过什么前端？"（准备好具体例子）
   答：设备管理模块：五段式页面、权限双层、请求封装……把第9章流程讲出来。
4. "为什么选 Vue 不选 React？"
   答：模板语法上手快、双向绑定直观、RuoYi 生态配套成熟；React 灵活但心智
   （JSX/不可变/状态管理）更重——适合团队情况回答，别贬低。
5. "Vue3 会了吗？"
   答：会对比（Proxy/组合式/Vite），写过 setup 语法 demo；
   RuoYi 是 Vue2，迁移时按第8章映射表改。

## E. 30 分钟冲刺路线

```
前 10 分钟：A 组 ★ 题（1/2/5/6/10/11/13/18/19/20/21/26/27/30/32/34/35）
中 10 分钟：B 组手写 7 题默写
后 10 分钟：C 组坑表 + 准备"我的 RuoYi 设备管理页面"讲法
```

## 小结

- 最高频六块：响应式边界、单向数据流、生命周期、computed/watch、
  Vuex 五件套、路由权限——占面试 70%。
- 手写题 = 响应式简化版、不可变更新、watch 套路、路由守卫。
- 面试案例：RuoYi 模块的增删改查 + 权限双层就是现成故事。
- 踩坑三源头：响应式边界、生命周期时机、异步更新——排查先想这三个。

至此《Vue 教程（RuoYi-Vue 实战版）》10 章全部完成。