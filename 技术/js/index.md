---
layout: default
title: "JavaScript 教程（后端工程师版）· 系列目录"
description: "JavaScript 系列目录：变量类型与作用域、函数与 this/闭包、数组与对象、异步编程与事件循环、字符串与正则、DOM 与事件、浏览器与网络、模块化与工程化、ES6+ 进阶，附面试速查与常见坑。"
tags: [js]
listed: false
hub: true
nav_title: "📜 JavaScript 教程（后端版）"
nav_order: 8
last_modified_at: 2026-10-05
permalink: /技术/js/
---

# JavaScript 教程（后端工程师版）· 系列目录

后端写前端最常翻车的地方，基本都在这份系列里：`this` 到底指谁、闭包为什么留住了变量、
`Promise` 和 `setTimeout` 谁先执行、事件循环里微任务宏任务怎么排队、模块化为什么要有打包器。
讲法是「先给一个会踩的坑 → 再解释引擎怎么做的 → 最后给出稳妥写法」。

**推荐顺序**：01 类型/作用域 → 02 函数/this/闭包 → 03 数组与对象 → 04 异步与事件循环 →
05 字符串正则 → 06 DOM 与事件 → 07 浏览器与网络 → 08 模块化 → 09 ES6+ → 10 面试速查

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

- 考前速查：[JS 面试速查与常见坑](10-JS面试速查与常见坑.md)
- 全部技术系列总索引：[技术知识库总索引](../README.html)
