---
layout: default
title: "Spring 面试核心原理 · 系列目录"
description: "Spring 系列目录：IoC 容器与 Bean 生命周期、AOP 实现原理、事务失效的 10 种场景、refresh 启动流程、SpringBoot 自动装配，以及 Spring 6/7、虚拟线程、Security 7、Spring AI 等新特性。按面试考区顺序编排。"
tags: [Spring]
listed: false
hub: true
last_modified_at: 2026-10-05
permalink: /技术/spring/
---

# Spring 面试核心原理 · 系列目录

这个系列不追求把 Spring 讲全，只讲**面试官会追问到底**的那部分：Bean 生命周期钩子的顺序、
三级缓存为什么是三级、AOP 自调用为什么失效、`@Transactional` 在哪些情况下不生效、
`refresh()` 十二步各自干了什么。每一章都按「先给结论 → 再给源码/流程 → 最后列追问」组织。

**推荐顺序**：02 IoC → 04 AOP → 05 事务 → 06/07 启动与自动装配 → 08 速查表（考前）→ 09~15 新特性选读。

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

- 想按「面试前 30 分钟」的顺序刷：[Spring 高频面试题速查表](08-高频面试题速查表.md)
- 想看全部技术系列的总索引：[技术知识库总索引](../README.html)
