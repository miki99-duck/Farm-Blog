# 第8章 Vue3 组合式 API 对比（面试与迁移的必答题）

> 一句话讲清：**Vue3 = Proxy 响应式（解决 Vue2 的响应式边界）+ 组合式 API
> （按"功能"组织代码，替代"按选项类型"分散）+ 更小的包与更快的渲染。
> 你的 RuoYi 是 Vue2，但面试必问"Vue2/Vue3 区别"，迁移时也得学。**
> 学习策略：会对比 + 会看 Vue3 代码即可，不用立刻全懂。

## 8.1 Vue3 的三大变化总览（面试先答这个框架）

```
① 响应式底层：Object.defineProperty → Proxy
   → 新增属性、数组下标赋值都响应了（2.7 之前 Vue2 的 $set 边界没了）

② 写法：选项式(Options) → 组合式(Composition，setup 函数)
   → 相关逻辑放一起（不再是 data/methods/computed 各自散落）

③ 工程：Vite 构建更快、Tree-shaking 更彻底（按需引入 API）、
   Composition API 复用之王（hooks）
```

另外：Vue3 配套生态改名——Element Plus（替代 Element UI）、vue-router 4、Vuex 4 / Pinia。

## 8.2 响应式对比（最重要的原理题）

```js
// Vue2：defineProperty 逐个属性劫持（初始化时扫描，运行期新增不响应）
// this.$set(obj, 'k', v) 来补救；数组下标不响应。

// Vue3：new Proxy(target, handlers) 代理整个对象
// 读/写/新增/删除都被拦截 → 新增属性天然响应
import { reactive, ref } from 'vue'

const state = reactive({ count: 1 });
state.count = 2;              // ✅ 响应
state.newField = 'x';         // ✅ 响应（Vue2 需要 $set）

// ref：包装基本类型为响应式（.value 取值）
const page = ref(1);
page.value = 2;               // ✅ 响应
```

面试金句："Vue3 用 Proxy 代理整个对象，运行期增删属性都能拦截；
Vue2 的 defineProperty 只在初始化时给已有属性装 setter，所以新增属性/数组下标
需要 $set 补救——这是 Vue2 响应式最大的边界。"

## 8.3 setup 与组合式 API：代码组织的革命

```vue
<script>
// Vue2 选项式：一个功能的代码分散在 data/methods/computed/watch 四处
export default {
  data() { return { keyword: '', list: [], loading: false } },
  computed: { filtered() { ... } },
  watch: { keyword() { ... } },
  methods: { fetch() { ... }, clear() { ... } }
}
</script>
```

```vue
<script setup>
// Vue3 组合式：一个"设备搜索"功能的所有代码放在一起（可抽出 hooks 复用）
import { ref, computed, watch, onMounted } from 'vue'

// —— 设备搜索功能块 ——
const keyword = ref('')
const list = ref([])
const loading = ref(false)
const filtered = computed(() => ...)
watch(keyword, () => ...)
async function fetchList() { ... }
function clear() { ... }

// —— 其他功能块接着写 ——
onMounted(fetchList)
</script>
```

好处（面试讲法）：
1. **按功能组织**：一个功能的 data+computed+methods 挨在一起，长页面不翻屏；
2. **逻辑复用**：整块功能抽成"组合式函数"（useXxx），Vue2 的 mixin 问题（命名冲突、来源不明）被解决；
3. **更好的类型推导**（配合 TS）。

```js
// 自定义 hook：设备列表逻辑，处处可复用（类似 Java 的工具类/服务）
// hooks/useDeviceList.js
import { ref, onMounted } from 'vue'
import { listDevice } from '@/api/device'

export function useDeviceList(initialQuery = {}) {
  const list = ref([])
  const loading = ref(false)
  const query = ref(initialQuery)

  async function fetchList() {
    loading.value = true
    const res = await listDevice(query.value)
    list.value = res.data
    loading.value = false
  }
  onMounted(fetchList)
  return { list, loading, query, fetchList }
}
```

## 8.4 选项式 → 组合式映射表（对照迁移时用）

| 选项式（Vue2/RuoYi 现在） | 组合式（Vue3） |
|---------------------------|----------------|
| data() { return {...} } | ref() / reactive() |
| computed: { x() {} } | const x = computed(() => ...) |
| watch: { a() {} } | watch(a, (nv, ov) => ...) |
| methods: { f() {} } | function f() { ... }（普通函数） |
| created() | setup 里直接写 / onBeforeMount |
| mounted() | onMounted(() => ...) |
| beforeDestroy() | onBeforeUnmount() |
| props: ['x'] | defineProps(['x']) |
| this.$emit('e', v) | const emit = defineEmits(['e']); emit('e', v) |
| this.$refs.xx | ref 模板引用（同名 ref 自动绑定） |
| this.$route / $router | useRoute() / useRouter() |
| Vuex mapState 等 | useStore() + computed |

## 8.5 一个功能的 Vue2 vs Vue3 对照（看代码感受差异）

```vue
<!-- Vue2 写法（RuoYi 现状） -->
<script>
export default {
  data() { return { count: 0, name: '' } },
  computed: { double() { return this.count * 2 } },
  watch: { count(v) { console.log('变化', v) } },
  methods: {
    inc() { this.count++ },
    submit() { this.$emit('save', { name: this.name, count: this.count }) }
  }
}
</script>
```

```vue
<script setup>
<!-- Vue3 写法 -->
import { ref, computed, watch } from 'vue'

const count = ref(0)
const name = ref('')
const double = computed(() => count.value * 2)
watch(count, v => console.log('变化', v))

function inc() { count.value++ }
const emit = defineEmits(['save'])
function submit() { emit('save', { name: name.value, count: count.value }) }
</script>
```

注意 Vue3 里响应式取值要 `.value`（ref 的包装）——新手最常见的"页面不更新"
就是忘了 .value；模板里自动解包不需要写 .value。

## 8.6 生态配套变化（防止面试踩坑）

```
Vue2 生态                    Vue3 生态
Element UI (Vue2)      →    Element Plus (Vue3)
vue-router 3            →    vue-router 4（createRouter/createWebHistory）
Vuex 3                  →    Vuex 4 / 推荐 Pinia（更轻、无 mutation、TS 友好）
Vue CLI/webpack         →    Vite（dev 秒启）
Vue.prototype.$xxx      →    app.config.globalProperties.xxx
new Vue({...})          →    createApp(App).mount('#app')
```

```js
// main.js 差异
// Vue2: import Vue from 'vue'; new Vue({ router, store, render: h => h(App) }).$mount('#app')
// Vue3:
import { createApp } from 'vue'
import App from './App.vue'
createApp(App).use(router).use(store).mount('#app')
```

## 8.7 RuoYi 将来要迁 Vue3，改动最大的五件事（了解即可）

1. 全局 API 全部换（Vue.use→app.use、Vue.prototype→globalProperties）；
2. Element UI → Element Plus（组件名基本不变，表单校验 API 微调）；
3. 过滤器 filter（Vue2 有、Vue3 删了）→ 改成函数/计算属性；
4. 动态路由 addRoutes → addRoute（每次一个，RuoYi 的权限要小改）；
5. main.js 入口与挂载方式。

面试可以说："我有 Vue2 项目基础，理解 Vue3 是 Proxy 响应式 + 组合式 API +
Vite 生态；迁移的改动主要在全局 API、Element Plus 和路由 API，组件逻辑
对应关系我清楚（看过映射表/写过 demo）。"

## 8.8 常见坑快查

| 坑 | 现象 | 解法 |
|----|------|------|
| 忘了 .value | 页面不更新/undefined | 脚本里 ref 一律 .value（模板里不用） |
| reactive 解构丢失响应 | const { a } = reactive(...) | toRefs / ref 单独 |
| Vue2 项目里用 Vue3 语法 | 报错 | 按项目版本写（RuoYi 是 Vue2） |
| setup 里没有 this | this.$route 是 undefined | useRoute()/useRouter() |
| 过滤器不生效 | Vue3 删了 filter | 函数/计算属性替代 |

## 8.9 面试自测

- Q：Vue2/Vue3 响应式区别？★★
  A：defineProperty vs Proxy；新增属性/数组下标；$set 存在与否。
- Q：组合式 API 好处？★
  A：按功能组织代码、逻辑复用（hooks）、类型推导更好；解决 mixin 问题。
- Q：ref 和 reactive 区别？★
  A：ref 包基本类型（.value），reactive 包对象；模板自动解包。
- Q：setup 里怎么用路由、拿 props、发事件？
  A：useRoute/useRouter、defineProps、defineEmits。
- Q：Vue3 相比的工程化优势？
  A：Vite 快、Tree-shaking、体积小、性能好（proxy + 编译优化）。

## 小结

- Vue3 三大变化：Proxy 响应式、组合式 API、Vite 生态；配套 Element Plus/Pinia。
- 映射表记住：data→ref、computed→computed、methods→function、mounted→onMounted。
- ref 要 .value；setup 无 this；过滤器删了。
- 面试金句：响应式边界消失、hooks 复用、生态换代——三句话概括。

下一篇：第9章 RuoYi 单页面全流程（把前八章串成一个真实业务模块）。