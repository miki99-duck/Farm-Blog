---
tags: [vue]
---

# 第6章 vue-router 路由（页面怎么跳、权限怎么拦）

> 一句话讲清：**vue-router 管理"URL ↔ 组件"的映射：访问什么路径渲染什么页面；
> 跳转有两种（标签 <router-link> 和编程式 this.$router.push），
> 守卫（beforeEach）负责"进页面之前做检查"——RuoYi 的登录态/权限拦截就在这。**
> Java 对照：路由表 ≈ Controller URL 映射；守卫 ≈ Spring Security 的过滤器；
> 路由元信息 meta ≈ 注解里的属性。

## 6.1 路由三要素：路径、组件、视图出口

```js
// src/router/index.js（RuoYi 结构相似）
import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

// 路由表：路径 → 组件
export const constantRoutes = [
  {
    path: '/login',
    component: () => import('@/views/login'),   // 懒加载：用到才加载（打点分包）
    hidden: true                                // 自定义字段：菜单里不显示
  },
  {
    path: '/',
    component: () => import('@/layout/index'),  // 布局 Component：里面有 <router-view/>
    redirect: '/device',
    children: [                                 // 嵌套路由：挂在布局内部
      {
        path: 'device',
        component: () => import('@/views/device/index'),
        name: 'Device',
        meta: { title: '设备管理', icon: 'monitor', permissions: ['monitor:device:list'] }
      }
    ]
  },
  {
    path: '*',                                  // 兜底：404
    component: () => import('@/views/error/404'),
    hidden: true
  }
]
```

```vue
<!-- 布局里必须有视图出口：路由匹配到的组件在这里渲染 -->
<!-- src/layout/index.vue 里 -->
<router-view />
```

## 6.2 跳转：声明式与编程式（高频写法）

```vue
<template>
  <!-- 声明式：标签跳转（菜单/面包屑/按钮都可用） -->
  <router-link to="/device">设备管理</router-link>
  <router-link :to="{ path: '/device', query: { status: 1 } }">在线设备</router-link>

  <!-- 实际开发更常用：按钮/事件里编程式跳转 -->
  <el-button @click="goDetail">详情</el-button>
</template>

<script>
export default {
  methods: {
    goDetail() {
      // ① path + query（?status=1）
      this.$router.push({ path: '/device', query: { id: row.id } });
      // ② name + params（/device/123 路径参数）
      // this.$router.push({ name: 'Device', params: { id: 7 } })
    },
    goBack() {
      this.$router.back();          // 返回上一页
    }
  }
}
</script>
```

**query vs params 记住**：
- query：URL 里 ?id=7（刷新还在、可分享）——**多用**；
- params：配合 path 用会丢（必须配 name 才保留），刷新丢失——少用路径参数。

接收参数：

```js
// 目标页读取
const id = this.$route.query.id;      // 从 query 读（注意是 $route 不是 $router）
// 同一个组件被不同参数复用时，要 watch $route 变化重新加载：
watch: {
  '$route.query.id'(val) {
    if (val) this.loadDetail(val);
  }
}
```

**$router vs $route**（面试送分题）：$router 是路由器实例（负责跳转）；
$route 是当前路由信息（path/query/params/meta）。

## 6.3 嵌套路由与重定向

```js
// 嵌套：父路由（带布局） + children（多个子页面）
{
  path: '/monitor',
  component: Layout,
  redirect: '/monitor/device',          // 访问 /monitor 直接跳到默认子页
  children: [
    { path: 'device', component: () => import('@/views/monitor/device') },
    { path: 'server', component: () => import('@/views/monitor/server') }
  ]
}
// 此时 URL：/monitor/device、/monitor/server 都在同一个布局里切内容
```

## 6.4 路由守卫：进页面之前的"安检"（权限核心）

```js
// 全局前置守卫：每次路由跳转都会先走这里
router.beforeEach((to, from, next) => {
  document.title = to.meta?.title ? `${to.meta.title} - 华润燃气` : '华润燃气';

  // ① 白名单：登录页/404 直接放行
  if (to.path === '/login') return next();

  // ② 没登录 → 踢去登录页（带 redirect 回来）
  const token = getToken();
  if (!token) return next(`/login?redirect=${encodeURIComponent(to.fullPath)}`);

  // ③ 已登录但没拉过用户信息（刷新页面后首次）→ 拉角色/权限并生成动态路由
  if (!store.getters.roles?.length) {
    store.dispatch('user/getInfo').then(() => {
      store.dispatch('permission/generateRoutes').then(accessRoutes => {
        router.addRoutes(accessRoutes);           // 动态添加路由（RuoYi 特色！）
        next({ ...to, replace: true });           // 重新进入目标路由
      });
    }).catch(() => {
      store.dispatch('user/logout');
      next(`/login`);
    });
    return;
  }

  next();   // 放行
});
```

RuoYi 的权限链路（面试能讲出来很加分）：
```
登录成功 → store user/login 存 token
→ 进入页面 router.beforeEach 发现没用户信息
→ getInfo() 拿 roles/permissions（后端返回）
→ permission/generateRoutes() 根据菜单接口返回的路由表生成前端路由
→ router.addRoutes() 动态挂载 → 菜单也是动态渲染的
→ 页面按钮再配合 v-hasPermi 指令按 permissions 显隐
```

一句话总结：**"路由守卫做登录态检查 + 动态路由做菜单权限；按钮级权限用指令。"**

## 6.5 常用 API 速查

```js
// 跳转
this.$router.push('/device');                  // 前进
this.$router.replace('/device');               // 前进（不产生历史记录）
this.$router.back(); this.$router.go(-1);      // 返回

// 路由信息
this.$route.path;        // "/device"
this.$route.query;       // {id: 7}
this.$route.params;      // {...}
this.$route.meta;        // {title:'设备管理', ...}
this.$route.fullPath;    // 完整路径（跳转带回调常用）

// 监听路由变化（同一组件复用）
watch: { '$route'() { this.refresh(); } }
```

## 6.6 常见坑快查

| 坑 | 现象 | 解法 |
|----|------|------|
| 路由跳了页面不刷新 | 同一个组件参数变了 | watch $route 重新加载 |
| params 刷新丢失 | 用 path 跳的 params | 用 query 或 name+params |
| 访问二级页面空白 | 没配 children/嵌套层级不对 | children 必须在父的 <router-view> 里 |
| 刷新后 404 | 动态路由未持久化 | 守卫里 getInfo 后 addRoutes（RuoYi 已处理） |
| 权限白屏 | addRoutes 时机不对 | 守卫里等路由加完再 next({...to}) |
| 菜单不显示 | meta 字段/菜单接口 | 检查 meta.title/hidden 字段 |

## 6.7 面试自测

- Q：$router 和 $route 区别？★
  A：$router 实例管跳转；$route 当前路由信息（path/query/meta）。
- Q：query 和 params 区别？★
  A：query 在 ? 后刷新保留、可分享；params 走路径，需要 name 才稳定。
- Q：路由守卫有哪些？★
  A：全局 beforeEach/beforeResolve/afterEach、组件内 beforeRouteEnter/Update/Leave、路由配置级 beforeEnter。
- Q：动态路由怎么做权限？★
  A：登录后 getInfo 拿权限 → 过滤路由表 → router.addRoutes 动态挂载 → 菜单动态渲染。
- Q：懒加载路由为什么好？
  A：() => import() 按需打包，首屏只加载当前页的 chunk。

## 小结

- 路由表 = 路径↔组件；<router-view> 是出口；懒加载分包。
- 跳转 push/replace/back；传参用 query（稳定）；$router vs $route 分清。
- 守卫做安检：登录态、动态路由、标题、面包屑。
- RuoYi 权限三件套：守卫 + 动态路由 + v-hasPermi 指令。

下一篇：第7章 Element UI 实战（表格/表单/弹窗/分页的标准组合）。