---
layout: default
title: "Vue 教程（RuoYi 实战版）· 系列目录"
description: "Vue 系列目录：模板语法与响应式、组件 props 与事件、组件通信进阶、computed 与 watch、Vuex 状态管理、vue-router 路由、Element UI 实战，以及 RuoYi 单页面全流程与 Vue3 组合式 API 对比。"
tags: [vue]
listed: false
hub: true
nav_title: "🟩 Vue 教程（RuoYi 实战）"
nav_order: 9
last_modified_at: 2026-10-05
permalink: /技术/vue/
---

# Vue 教程（RuoYi 实战版）· 系列目录

主线是**把 RuoYi-Vue 这一个真实项目读懂**：从 `main.js` 到路由守卫、从 Element UI 表单
到 `el-table` 分页查询、从 Vuex 的 `permission` 模块到按钮级权限。因此这份系列里 Vue2 的
选项式写法和 Vue3 的组合式写法都会出现，并标注差异在哪。

**推荐顺序**：01 模板/响应式 → 02 组件基础 → 03 通信进阶 → 04 computed/watch → 05 Vuex →
06 vue-router → 07 Element UI → 09 RuoYi 单页面全流程 → 08 Vue3 对比 → 10 面试速查

{%- assign segs = page.path | split: '/' -%}
{%- assign dir = segs[0] | append: '/' | append: segs[1] | append: '/' -%}
{%- assign all = site.pages | sort: "path" -%}
{%- assign total = 0 -%}
{%- for p in all -%}
  {%- if p.path contains dir and p.name != "index.md" and p.listed != false -%}{%- assign total = total | plus: 1 -%}{%- endif -%}
{%- endfor -%}

## 全部章节（共 {{ total }} 篇）

<ul class="hub-list">
{%- for p in all -%}
{%- if p.path contains dir and p.name != "index.md" and p.listed != false %}
  <li class="hub-item">
    <a class="hub-link" href="{{ p.url | relative_url }}">{{ p.title | default: p.name }}</a><span class="hub-meta">{{ p.content | strip_html | strip_newlines | strip | size }} 字</span>
    <p class="hub-sum">{{ p.summary | default: p.description | default: p.content | strip_html | strip_newlines | strip | truncate: 100 }}</p>
  </li>
{%- endif -%}
{%- endfor %}
</ul>

## 相关

- 考前速查：[Vue 面试速查与常见坑](10-Vue面试速查与常见坑.md)
- 配合 CSS 系列：[CSS 教程系列目录](../css/)
- 全部技术系列总索引：[技术知识库总索引](../README.html)
