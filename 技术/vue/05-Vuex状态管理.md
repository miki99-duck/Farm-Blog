# 第5章 Vuex 状态管理（全局数据的正规军）

> 一句话讲清：**Vuex 是"全局共享的响应式仓库"——所有组件都能读（state/getters）、
> 按规矩改（mutations 同步、actions 异步），替代"各自存数据 + 事件总线互传"的混乱。**
> Java 对照：store ≈ 单例服务 + 状态字段；mutations ≈ 带校验的 setter；
> actions ≈ 服务方法（可异步）；getters ≈ 缓存 getter。

## 5.1 为什么需要 Vuex：兄弟/跨层共享的痛点

回忆第3章：父子用 props/事件，但"登录用户信息"“菜单权限”"主题"是**全站都要用**的——
每个组件层层传 props 会疯掉；EventBus 又难追踪。Vuex 就是为"全局共享 + 可追踪"而生。

适用判断（面试讲法）：
- 多组件共享、且会**被修改**的数据 → Vuex（token、用户信息、权限、全局配置）；
- 组件内部状态 → 留 data（没必要进 store）；
- 请求缓存/页面级数据 → 不一定要 store。

## 5.2 Vuex 五大件（背这张图就懂 Vuex）

```
组件 ──dispatch──➜ actions（异步：调接口）──commit──➜ mutations（同步改）──➜ state（数据）
   ▲                                                                              │
   └───────────────── getters（派生/缓存读取）←──────────────────────────────────┘
```

| 概念 | 作用 | 类比 |
|------|------|------|
| state | 数据本体（唯一数据源） | 单例的字段 |
| getters | 派生数据（缓存） | computed 的全局版 |
| mutations | 唯一允许"改 state"的地方（同步） | 带规则的 setter |
| actions | 业务动作（异步请求、提交 mutation） | service 方法 |
| modules | 按业务分模块（每个模块有自己的五件套） | 命名空间服务 |

关键约束：**组件不直接改 state；改只能走 mutations（同步）/actions（异步）**
——保证"谁改了什么"全部可追踪（DevTools 时间旅行调试）。

## 5.3 RuoYi 的 store 结构（打开项目对照）

```
src/store/
├── index.js        // 入口：new Vuex.Store({ modules })
├── getters.js      // 全局 getters
└── modules/
    ├── user.js     // 用户信息、token、登录/登出（最核心）
    ├── permission.js // 动态路由+权限（菜单怎么来）
    ├── app.js      // 侧栏折叠、设备、尺寸
    └── settings.js // 主题配置
```

## 5.4 完整用法：写一个"设备筛选偏好"模块

```js
// store/modules/devicePref.js
const state = {
  pageSize: 10,                 // 每页条数（全站记住用户偏好）
  favoriteStatus: undefined,    // 收藏的状态筛选
};

const getters = {
  // 派生：是否有筛选条件
  hasFilter: (state) => state.favoriteStatus !== undefined,
  // getters 也可以接收参数（返回函数）
  pageSizeLabel: (state) => (unit = '条') => `${state.pageSize} ${unit}`,
};

const mutations = {
  // 同步修改：唯一改 state 的地方
  SET_PAGE_SIZE(state, size) {
    state.pageSize = size;
  },
  SET_FAVORITE_STATUS(state, status) {
    state.favoriteStatus = status;
  },
};

const actions = {
  // 异步/业务动作：调接口、做日志、再提交 mutation
  setPageSize({ commit }, size) {
    commit('SET_PAGE_SIZE', size);              // 同步落地
    localStorage.setItem('devicePageSize', size); // 顺便持久化
  },
  async loadFromStorage({ commit }) {
    const saved = localStorage.getItem('devicePageSize');
    if (saved) commit('SET_PAGE_SIZE', Number(saved));
  },
};

export default { namespaced: true, state, getters, mutations, actions };
```

```js
// store/index.js 注册
import Vue from 'vue'
import Vuex from 'vuex'
import devicePref from './modules/devicePref'

Vue.use(Vuex)
export default new Vuex.Store({
  modules: { devicePref }
})
```

## 5.5 组件里怎么用（四个 API）

```vue
<script>
import { mapState, mapGetters, mapMutations, mapActions } from 'vuex'

export default {
  computed: {
    // 方式1：直接 this.$store
    a() { return this.$store.state.devicePref.pageSize },
    b() { return this.$store.getters['devicePref/hasFilter'] },

    // 方式2：mapState / mapGetters 批量映射（写业务更清爽）
    ...mapState('devicePref', ['pageSize']),
    ...mapGetters('devicePref', ['hasFilter']),
  },
  methods: {
    // 方式3：mapMutations / mapActions（组件里调用 this.setPageSize(x)）
    ...mapMutations('devicePref', ['SET_PAGE_SIZE']),
    ...mapActions('devicePref', ['loadFromStorage']),

    changeSize() {
      // 推荐：组件走 actions（actions 里提交 mutation）
      this.$store.dispatch('devicePref/setPageSize', 20);
      // 或者直接改（简单同步场景）：
      // this.SET_PAGE_SIZE(20);
    }
  }
}
</script>
```

面试核心问答："为什么组件不能直接改 state？"——
答："mutation 是唯一修改点，DevTools 能记录每次改动、可回溯调试；
直接改 state 绕过了追踪，等于在 Java 里绕过 setter 直接改私有字段。"

## 5.6 RuoYi 的 user.js 核心流程（看懂登录态全链路）

```js
// 简化版（概念，对照你项目 src/store/modules/user.js）
const actions = {
  // 登录：调后端 → 存 token → 拿用户信息
  async login({ commit }, userInfo) {
    const { token } = await loginApi(userInfo);
    commit('SET_TOKEN', token);
    setToken(token);                     // 同时存 cookie（utils/auth.js）
  },
  // 获取用户信息：角色/权限点 → 生成路由
  async getInfo({ commit, state }) {
    const { user, roles, permissions } = await getInfoApi();
    commit('SET_USER', user);
    commit('SET_ROLES', roles);
    commit('SET_PERMISSIONS', permissions);
    return user;
  },
  // 登出
  async logout({ commit }) {
    await logoutApi();
    commit('SET_TOKEN', '');
    removeToken();
  }
};

// 页面里调用：登录页
this.$store.dispatch('user/login', loginForm).then(() => {
  this.$router.push('/');               // 登录成功跳主页
});
```

## 5.7 常见坑快查

| 坑 | 现象 | 解法 |
|----|------|------|
| 直接改 state | DevTools 警告/不追踪 | 走 mutation |
| 异步放 mutation | 时序错乱 | 异步放 action，mutation 只同步改 |
| namespaced 没开 | map 找不到模块 | 模块加 namespaced: true |
| 刷新页面 state 没了 | 内存态丢失 | 初始化从 localStorage 恢复（RuoYi token 存 cookie 同理） |
| mapState 不生效 | 忘了展开 ... | computed 里 ...mapState |
| 对象字段变化不触发 getters | 响应式边界 | $set 或替换引用 |

## 5.8 面试自测

- Q：Vuex 五大件分别干嘛？★
  A：state 数据、getters 派生、mutations 同步改、actions 异步业务、modules 分模块。
- Q：为什么 mutation 必须同步？★
  A：DevTools 需要记录精确的状态变更时序；异步放 actions 里。
- Q：actions 和 mutations 的区别？★
  A：actions 可异步、可调接口、可组合多个 mutation；mutations 只能同步改 state。
- Q：页面刷新 Vuex 丢失怎么办？
  A：持久化到 localStorage/cookie，初始化时恢复（或 vuex-persistedstate 插件）。
- Q：什么时候用 Vuex 什么时候用 props？
  A：全局共享且会变 → Vuex；父子局部 → props；页面内部 → data。

## 小结

- Vuex = 全局响应式仓库：state/getters/mutations/actions/modules。
- 数据流铁律：组件 → dispatch → actions → commit → mutations → state → 视图。
- RuoYi：user（登录态）+ permission（路由权限）+ app/settings（布局）。
- 面试重点：为什么同步 mutation、actions 干嘛的、刷新丢失怎么办。

下一篇：第6章 vue-router 路由（页面怎么跳、权限怎么拦）。