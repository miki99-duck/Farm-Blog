# 第1章 Vue 基础：模板语法与响应式

> 一句话讲清：**.vue 文件 = 模板(长什么样) + 脚本(数据和逻辑) + 样式(怎么好看)；
> Vue 的核心魔法是"响应式"——你改 data，页面自动变，永远不用手动操作 DOM。**
> Java/JS 对照：data ≈ 组件状态（类似 class 字段），methods ≈ 方法，
> computed ≈ 有缓存的 getter，模板 ≈ 声明式 UI（有点像 JSP，但没有服务端渲染负担）。

## 1.1 .vue 文件三块结构（RuoYi 每个页面长这样）

```vue
<template>
  <!-- ① 模板：类 HTML，可以写指令和插值 -->
  <div class="container">
    <h2>{{ title }}</h2>
    <button @click="handleClick">点我</button>
  </div>
</template>

<script>
// ② 脚本：数据 + 逻辑
export default {
  name: 'DemoPage',
  data() {
    return {
      title: '设备管理'          // data 是函数！返回对象
    }
  },
  methods: {
    handleClick() {
      this.title = '已点击'      // 改数据 → 视图自动更新（核心！）
    }
  }
}
</script>

<style scoped>
/* ③ 样式：scoped 只作用于本组件（CSS 第9章讲过） */
.container { padding: 16px; }
</style>
```

三块的分工就是"视图 / 数据 / 样式"分离，一个组件自包含。

## 1.2 插值：把数据"放进"模板

```vue
<template>
  <div>
    <!-- 插值：Mustache 语法 -->
    <p>{{ message }}</p>
    <p>{{ user.name }} 今年 {{ user.age }} 岁</p>

    <!-- 里面可以写表达式（不能写语句） -->
    <p>{{ count + 1 }}</p>
    <p>{{ isOnline ? '在线' : '离线' }}</p>
    <p>{{ formatDate(createdAt) }}</p>          <!-- 调 methods 方法 -->

    <!-- 不转义 HTML：v-html（危险！同 JS 的 innerHTML，慎用用户输入） -->
    <div v-html="richHtml"></div>
  </div>
</template>
```

## 1.3 指令：模板里的"JS 钩子"（第一梯队）

| 指令 | 作用 | 示例 |
|------|------|------|
| v-bind (简写 :) | 单向绑定属性 | `:disabled="isSaving"` `:src="imgUrl"` |
| v-on (简写 @) | 事件绑定 | `@click="save"` `@keyup.enter="search"` |
| v-model | 表单双向绑定 | `v-model="form.name"` |
| v-if / v-else-if / v-else | 条件渲染（销毁/创建） | `v-if="type==='admin'"` |
| v-show | 条件显示（只是 display 切换） | `v-show="isVisible"` |
| v-for | 列表渲染 | `v-for="item in list" :key="item.id"` |
| v-html | 渲染 HTML（危险） | `v-html="content"` |

```vue
<template>
  <button :disabled="loading" @click="submit">
    {{ loading ? '提交中...' : '提交' }}
  </button>

  <!-- v-if vs v-show（面试必考区别） -->
  <div v-if="isLogin">已登录（条件假时直接从 DOM 移除）</div>
  <div v-show="isLogin">已登录（只是 display:none，元素还在）</div>
  <!-- 结论：频繁切换用 v-show，条件极少变用 v-if -->

  <!-- v-for 必须带 key（唯一稳定标识，diff 性能关键） -->
  <tr v-for="row in tableData" :key="row.id">
    <td>{{ row.name }}</td>
  </tr>

  <!-- class 与 style 的动态绑定（高频） -->
  <div :class="['card', { active: isActive, 'card--danger': type === 'danger' }]">
  <div :style="{ color: textColor, fontSize: fontSize + 'px' }">
</template>
```

为什么 v-for 要 key：Vue 用 key 区分"同一位置的元素是同一个还是新的"，
没有 key（或用 index）时列表重排/插入会复用错乱的 DOM 状态。面试必讲。

## 1.4 响应式原理：Vue2 怎么做 "改数据→视图更新"

```js
// Vue2 核心：Object.defineProperty 拦截属性的读写
// 概念示意（真实是每个属性被 getter/setter 劫持）：
Object.defineProperty(data, 'name', {
  get() { return value; },
  set(newVal) {
    value = newVal;
    // 通知渲染 Watcher：依赖这个属性的地方重新渲染
    notify();
  }
});
```

由此产生的**Vue2 响应式边界（面试重灾区）**：

```js
export default {
  data() {
    return {
      user: { name: '张三' },
      list: [1, 2, 3]
    }
  },
  methods: {
    addNewField() {
      // ❌ 新增属性：不是响应式的（defineProperty 只在初始化时劫持已有键）
      this.user.age = 30;          // 页面不会更新！

      // ✅ 用 Vue.set（或 this.$set）
      this.$set(this.user, 'age', 30);

      // 数组：
      // ❌ this.list[0] = 99; —— 下标赋值不响应（Vue2 没劫持下标）
      this.$set(this.list, 0, 99);  // ✅ 或 this.list.splice(0, 1, 99)
      // ✅ 数组方法 push/pop/splice 已被 Vue 重写过，是响应的
      this.list.push(4);            // 页面更新 ✅
    }
  }
}
```

Vue3 的改进：用 Proxy 全对象代理，**新增属性、数组下标直接赋值都响应**，
没有上述边界（第8章展开）。

面试金句（Vue2 响应式）：
"Vue2 初始化时用 defineProperty 逐个劫持 data 的已有属性，改值触发依赖通知；
所以运行期新增属性不响应，要 $set；数组下标赋值不响应，要 splice 或 $set；
Vue3 用 Proxy 代理整个对象，这些问题都消失了。"

## 1.5 methods / computed / watch：三个"数据加工"的对比（必考）

```vue
<script>
export default {
  data() {
    return { price: 100, count: 2, discount: 0.8 }
  },
  computed: {
    // computed：根据已有数据"算出"新值 —— 有缓存！
    // 依赖不变就不重新计算（多次引用只算一次），性能远好于 methods
    total() {
      return this.price * this.count * this.discount;
    }
  },
  watch: {
    // watch：监听数据变化做"副作用"（请求、日志、联动）
    count(newVal, oldVal) {
      console.log('数量变化', oldVal, '→', newVal);
      this.recalc();           // 变化了才触发
    },
    // 深度监听：监听对象内部变化（默认浅监听只监听引用）
    user: {
      handler(newVal) { console.log('user 变了', newVal); },
      deep: true               // 对象内部属性变化也触发（开销大，慎用）
    }
  },
  methods: {
    // methods：每次调用都执行，无缓存
    total2() { return this.price * this.count * this.discount; }
  }
}
</script>
```

选择原则（面试标准答案）：
- **模板要显示的派生值 → computed**（有缓存、声明式）；
- **数据变化要触发动作 → watch**（副作用、异步）；
- **事件/操作 → methods**；
- computed 千万别在里面发请求/改别的数据（应该是纯计算）。

## 1.6 v-model：表单双向绑定（语法糖）

```vue
<template>
  <div>
    <!-- v-model：是 :value + @input 的语法糖 -->
    <input v-model="form.name" />
    <!-- 等价于 -->
    <input :value="form.name" @input="form.name = $event.target.value" />

    <input v-model.number="form.age" />   <!-- .number：自动转数字 -->
    <input v-model.trim="form.code" />    <!-- .trim：去空格 -->
    <textarea v-model="form.desc"></textarea>

    <select v-model="form.status">
      <option value="1">在线</option>
      <option value="0">离线</option>
    </select>
  </div>
</template>

<script>
export default {
  data() {
    return { form: { name: '', age: 0, desc: '', status: '1' } }
  }
}
</script>
```

RuoYi 对照：页面顶部搜索表单就是

```js
// RuoYi 搜索区典型写法
data() {
  return {
    queryParams: { pageNum: 1, pageSize: 10, deviceName: '', status: undefined }
  }
}
```
`<el-input v-model="queryParams.deviceName" @keyup.enter="handleQuery" />`

## 1.7 生命周期：组件从出生到销毁（先总览，第2章细讲）

```
beforeCreate → created → beforeMount → mounted → beforeUpdate → updated
→ beforeDestroy → destroyed
```

关键两个：
- **created**：data 已可用，可以初始化数据（发请求）；
- **mounted**：DOM 已挂载，可以做 DOM 相关操作（图表初始化、第三库绑定）。

RuoYi 里最常看见的：

```js
created() {
  this.getList();          // 进页面就加载列表
},
methods: {
  getList() {
    this.loading = true;
    listDevice(this.queryParams).then(response => {
      this.tableData = response.rows;
      this.total = response.total;
      this.loading = false;
    });
  }
}
```

最新状态要刷新时再手动调 getList()（查完/删完都调）。

## 1.8 常见坑快查

| 坑 | 现象 | 解法 |
|----|------|------|
| 新增属性不响应 | 页面不变 | $set（1.4） |
| 数组下标赋值不变 | 页面不变 | splice / $set |
| v-for 没 key | 列表错乱/全重建 | 加 :key="唯一id" |
| v-model 改了不更新 | 用了对象新属性 | 先 $set 或初始化时声明好字段 |
| 改完数据 DOM 没立刻变 | 异步更新机制 | this.$nextTick(() => ...) 后取 DOM |
| data 忘了 return | 组件共享状态 | data 必须是函数 |
| 模板里用 undefined 属性 | 渲染报错 | 默认值 / v-if 保护 |

关于 $nextTick（面试补充）：Vue 更新 DOM 是异步批量的——你改了数据，
DOM 不会立刻变，要等本轮"微任务"才更新；所以"改完马上操作 DOM"要用 nextTick：

```js
this.count++;
console.log(document.querySelector('.num').textContent); // 旧值！
this.$nextTick(() => {
  console.log(document.querySelector('.num').textContent); // 新值 ✅
});
```

## 1.9 面试自测

- Q：v-if 和 v-show 区别？★
  A：v-if 条件假销毁元素（切换成本高），v-show 只是 display 切换；频繁切换用 v-show。
- Q：Vue2 响应式原理和边界？★★
  A：defineProperty 劫持已有属性；新增属性/$set；数组下标问题；Vue3 Proxy 解决。
- Q：computed 与 watch 区别？★
  A：computed 缓存+派生值；watch 副作用+监听变化；能用 computed 不用 watch。
- Q：v-for 为什么要 key？★
  A：diff 时识别元素身份，避免状态错乱，列表渲染性能关键。
- Q：data 为什么是函数？
  A：组件复用时要每份实例独立状态（对象 return 会共享引用）。
- Q：nextTick 干什么？
  A：等 DOM 更新完成的回调（异步批量更新机制）。

## 小结

- .vue = 模板 + 脚本 + 样式；改 data 视图自动变。
- 第一梯队指令：v-bind/v-on/v-model/v-if/v-show/v-for（带 key）。
- Vue2 响应式用 defineProperty：新增属性和数组下标是边界，用 $set。
- computed 缓存、watch 副作用、methods 事件；v-if 销毁、v-show 隐藏。

下一篇：第2章 组件基础（组件化与 props/事件，Vue 的核心思想）。