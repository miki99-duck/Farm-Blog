---
layout: default
title: "Java 并发与锁原理 · 系列目录"
description: "Java 并发系列目录：多线程基础与线程六状态、线程安全三大问题与 volatile、synchronized 原理与锁升级、ReentrantLock 与 AQS、CAS 与原子类、线程池七参数与拒绝策略，附面试速查 40 题。"
tags: [Java]
listed: false
hub: true
last_modified_at: 2026-10-05
permalink: /技术/java/
---

# Java 并发与锁原理 · 系列目录

JUC 这条线面试最爱问「为什么」：`volatile` 为什么保证可见性却不保证原子性、
偏向锁为什么被废弃、AQS 的 `state` 和双向队列怎么配合、线程池七参数配错会怎样。
每章都给到源码级别的执行流程，而不是停在「它是可重入锁」这种结论上。

**推荐顺序**：01 多线程基础 → 02 三大问题与 volatile → 03 synchronized 与锁升级 →
04 ReentrantLock 与 AQS → 05 CAS 与原子类 / 06 线程池 → 07 面试速查 40 题

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

- 考前 30 分钟只刷这个：[面试速查 40 题](07-面试速查40题.md)
- 虚拟线程与结构化并发在 Spring 系列：[10-虚拟线程原理](../spring/10-虚拟线程原理.html)、[11-StructuredTaskScope](../spring/11-StructuredTaskScope结构化并发原理.html)
- 全部技术系列总索引：[技术知识库总索引](../README.html)
