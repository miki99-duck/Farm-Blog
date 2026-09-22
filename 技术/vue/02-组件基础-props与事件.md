# 第2章 组件基础：props、自定义事件与生命周期

> 一句话讲清：**组件 = 可复用的"视图 + 数据 + 逻辑"单元；父组件通过 props 把数据
> 传给子组件（单向数据流），子组件通过 $emit 发事件告诉父组件"发生什么了"。**
> Java 对照：组件 ≈ 类；props ≈ 构造参数（只读）；$emit ≈ 回调/观察者通知：
> 父组件（调用方）决定怎么处理。

## 2.1 为什么组件化：复用与隔离

```vue
<!-- 没有组件：每个页面复制粘贴一段"设备状态标签"的模板+逻辑 -->
<!-- 有组件：写一次，到处用 -->
<DeviceStatus :online="row.online" @change="onStatusChange" />
<DeviceStatus :online="row2.online" @change="onStatusChange" />
```

组件的好处（面试背）：**复用（写一次用 N 次）、隔离（样式 scoped、状态独立）、
可维护（改一处全生效）。**

## 2.2 定义一个组件（三块结构第1章见过，重点是粘合的"接口"）

```vue
<!-- components/DeviceStatus.vue -->
<template>
  <span :class="['tag', online ? 'tag--success' : 'tag--info']">
    {{ online ? '在线' : '离线' }}
  </span>
</template>

<script>
export default {
  name: 'DeviceStatus',
  // props：对外声明"我这个组件需要外部给我什么"（只读，不能改！）
  props: {
    online: {
      type: Boolean,      // 类型校验（String/Number/Boolean/Array/Object/Function）
      required: true,     // 必填
      // default: false   // 非必填时的默认值
    }
  }
}
</script>

<style scoped>
.tag { padding: 2px 10px; border-radius: 12px; font-size: 12px; }
.tag--success { background: #f0f9eb; color: #67c23a; }
.tag--info { background: #f4f4f5; color: #909399; }
</style>
```

## 2.3 使用组件：父传子（props）★单向数据流

```vue
<!-- 父页面使用 -->
<template>
  <div>
    <!-- 传静态值/动态值（: 是 v-bind） -->
    <DeviceStatus :online="true" />
    <DeviceStatus :online="row.online" />
  </div>
</template>

<script>
import DeviceStatus from '@/components/DeviceStatus'

export default {
  name: 'DeviceList',
  components: { DeviceStatus },    // 局部注册
  data() {
    return { row: { online: true } }
  }
}
</script>
```

**单向数据流**（面试必考）：props 是父 → 子，子组件**不能修改 props**：

```js
// ❌ 错误：直接改 props
props: ['online'],
methods: {
  change() { this.online = false; }   // 报错/产生诡异行为
}
```

子组件想"改"怎么办？——三个正确姿势（面试标准答案）：
1. 用 props 初始化自己的 data：`data() { return { isOnline: this.online } }`
2. 需要计算 → computed 基于 props 派生
3. 真正要通知父组件改 → $emit 事件，让父改（见 2.4）

## 2.4 子传父：自定义事件 $emit ★

```vue
<!-- 子组件：DeviceStatus.vue 加一个"点击切换"能力 -->
<template>
  <span class="tag" @click="toggle">...</span>
</template>
<script>
export default {
  props: { online: Boolean },
  methods: {
    toggle() {
      // $emit(事件名, 参数)：通知父组件"我这边发生了 click-toggle"
      this.$emit('toggle', !this.online);
    }
  }
}
</script>

<!-- 父组件：监听事件 -->
<template>
  <DeviceStatus :online="row.online" @toggle="row.online = $event" />
  <!-- $event = 事件参数（这里就是 !online） -->
</template>
```

也可以带多个参数/对象：

```js
// 子
this.$emit('status-change', { id: this.deviceId, online: newVal });
// 父
<DeviceStatus @status-change="handleChange" />
// methods: handleChange(payload) { console.log(payload.id, payload.online); }
```

现代 Vue3 写法用 emit 声明（第8章对比）。记住**组件事件的命名建议 kebab-case**
（@my-event），因为 HTML 属性名大小写不敏感。

## 2.5 生命周期详解（面试重点，配合第1章总览）

```
创建阶段                   挂载阶段                      更新阶段               销毁
beforeCreate             beforeMount                    beforeUpdate        beforeDestroy
   ↓                       ↓                                ↓                  ↓
created                  mounted                         updated            destroyed
（data可用）         （DOM 就绪，图表/第三方库在这）    （数据变了，DOM已更新）  （清理定时器/监听）

beforeCreate → created：初始化响应式数据、methods
created → beforeMount → mounted：渲染 DOM
（父组件先 created，子组件先 mounted，再父 mounted —— 面试细节题）
```

每个阶段的"能干什么"（记忆卡）：

| 阶段 | 能用什么 | 别干什么 |
|------|---------|---------|
| beforeCreate | 几乎不能用（data 还没有） | 访问 this.xxx |
| created | data/methods 齐全 | 操作 DOM（还没渲染） |
| mounted | DOM 就绪 | 阻塞网络请求放这里做初始化 |
| beforeDestroy | 清理定时器/解绑监听/取消订阅 | 再操作数据 |
| destroyed | 组件没了 | — |

```js
// RuoYi 里最常见的生命周期用法
created() {
  this.getList();                  // 进页面加载数据
},
mounted() {
  // DOM 渲染完成后初始化图表/地图/第三方
  this.initEchart();
},
beforeDestroy() {
  clearInterval(this.timer);       // 防内存泄漏（定时器不清会一直跑）
  window.removeEventListener('resize', this.onResize);
}
```

面试问答："为什么异步请求放在 created 而不是 mounted？"——created 更早执行,
data 已可用；mounted 用于需要 DOM 的场景。两者均可发请求，created 更早。

## 2.6 注册与引用：局部 vs 全局

```js
// 局部注册（RuoYi 常规）：用哪个引哪个，组件作用域只在当前文件
import DeviceStatus from '@/components/DeviceStatus'
export default { components: { DeviceStatus } }

// 全局注册（main.js）：到处可用不用引（Element UI 就是全局注册的）
// main.js
import ElementUI from 'element-ui'
Vue.use(ElementUI)      // 之后所有页面直接 <el-button> 可用
```

## 2.7 常见坑快查

| 坑 | 现象 | 解法 |
|----|------|------|
| 子组件改 props | 控制台警告/视图错乱 | 事件回调父组件改（2.4） |
| 事件监听没反应 | 事件名大小写 | kebab-case：@my-event |
| 组件没渲染 | 忘了 components 注册 | 局部注册检查 import+components |
| 子组件状态被重置 | 组件被 v-if 销毁重建 | key 保持/数据提升父级 |
| 参数类型不对 | props 校验警告 | props type 声明 |
| 生命周期里外挂没清理 | 内存泄漏/重复触发 | beforeDestroy 清理 |

## 2.8 面试自测

- Q：什么是单向数据流？为什么必须单向？★
  A：props 只读、父传子；改只能通过事件回传。数据流可预测、好调试。
- Q：父传子和子传父分别怎么写？★
  A：父传子 props（:attr）；子传父 $emit('event', payload)（@event 监听）。
- Q：props 能直接改吗？改了怎么办？
  A：不能；用 data 初始化 / computed / $emit 通知父级。
- Q：组件生命周期顺序？★
  A：created → mounted → updated → destroyed；父 created 先于子，子 mounted 先于父。
- Q：mounted 里干什么？
  A：DOM 操作/图表/第三方库初始化；定时器要在 beforeDestroy 清理。

## 小结

- 组件 = 复用+隔离；对外接口 = props（入）+ $emit（出）。
- 单向数据流：父传子 props，子传父事件，全局共享用 Vuex（第5章）。
- 生命周期：created 发请求、mounted 操作 DOM、beforeDestroy 清理。
- 面试主战场：单向数据流、props/$emit、生命周期时序。

下一篇：第3章 组件通信进阶（插槽 / provide-inject / ref / 事件总线）。