---
tags: [vue]
---

# Vue 教程：大纲与目录（RuoYi-Vue 实战版）

> 读者定位：已看完 JS 教程、要理解并改造 RuoYi-Vue 前端的工程师。
> 目标：看懂 .vue 文件、能新增页面/改页面、理解数据流，面试 Vue 基础不丢分。
> 注意：RuoYi-Vue（经典版）是 **Vue2.7 + Element UI + Vuex3 + vue-router3**；
> 教程按"项目实际版本为主，顺带对比 Vue3 组合式"写，方便将来迁移。
> 风格：每章"一句话讲清 + 代码示例 + RuoYi 对照 + 常见坑 + 面试自测"。

## 一、总规模

- 10 章 + 大纲，约 3 万字，75 页左右
- 代码示例 100+ 段（全部 Vue2 可跑，标注 Vue3 差异）
- 精读 4~5 小时；应急第10章速查 30 分钟

## 二、章节规划

| # | 章节 | 核心知识点 | 星级 |
|---|------|-----------|------|
| 1 | 模板语法与响应式 | {% raw %}{{}}{% endraw %}、指令、v-model、data/methods/computed | ★★★★★ |
| 2 | 组件基础 | 组件化思想、props、自定义事件、生命周期 | ★★★★★ |
| 3 | 组件通信进阶 | 插槽、provide/inject、ref、事件总线 | ★★★★ |
| 4 | 计算属性与侦听器 | computed/watch 区别、深监听、防抖 | ★★★★ |
| 5 | Vuex 状态管理 | state/getters/mutations/actions、RuoYi store | ★★★★★ |
| 6 | vue-router 路由 | 路由配置、嵌套、重定向、守卫 | ★★★★ |
| 7 | Element UI 实战 | 表格/表单/弹窗/分页组合，RuoYi 页面套路 | ★★★★★ |
| 8 | Vue3 组合式 API 对比 | setup/ref/reactive、迁移差异 | ★★★★ |
| 9 | RuoYi 单页面全流程 | 从路由到页面到接口到权限，跑通一个业务模块 | ★★★★★ |
| 10 | Vue 面试速查与常见坑 | 响应式原理、v-if/v-show、key、nextTick 等 | ★★★★★ |

## 三、贯穿全书的思维主线（5 句）

1. **Vue = 数据驱动视图**：你只改数据（data），视图自动更新——别手动操作 DOM。
2. **组件 = 可复用的视图+逻辑单元**：页面是大组件，按钮/表格是小组件。
3. **单向数据流**：父传子用 props，子传父用事件；全局共享用 Vuex。
4. **响应式原理**：Vue2 用 defineProperty 拦截数据读写，改了就触发重新渲染。
5. **写 Vue 的多数问题 = 忘记"数据是第一公民"**：视图问题先查数据对不对。

## 四、RuoYi-Vue 对应关系（对照学习）

| Vue 概念 | 项目里的实际位置 |
|---------|-----------------|
| 组件 | src/components（Pagination、Editor）、src/views 每页 |
| 生命周期 | mounted 里调 this.getList()（页面初始加载） |
| computed | 页面统计、权限判断 |
| Vuex | src/store（permission、user） |
| 路由 | src/router（动态菜单由后端返回路由生成） |
| Element UI | 全站组件（el-table/el-form/el-dialog…） |
| 指令 | v-hasPermi/v-hasRole（权限控制） |

## 五、学习路径

- 第1、2章打底（响应式 + 组件）→ 第4章（computed/watch 高频）
- 第5、6章（Vuex + 路由）看 RuoYi 全局怎么组织
- 第7章实战组件、第9章跑通一个页面（如给设备管理加一个模块）
- 第8章 Vue3 对比（面试+迁移），第10章速查

## 六、打分自评

- 原理分（40）：响应式原理、生命周期、单向数据流能讲清
- 示例分（30）：代码可在 RuoYi 项目里直接验证
- 坑分（20）：v-if/key/深度监听等高频坑全覆盖
- 实战分（10）：能独立给项目新增一个"列表+表单"页面