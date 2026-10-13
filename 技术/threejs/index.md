---
layout: default
title: "Three.js 教程（3D 大屏与可视化）· 系列目录"
description: "Three.js 系列目录：WebGL 与 Three.js 基础、几何体与材质、相机与控制器、光源与阴影、纹理与贴图、动画与渲染循环、交互与射线检测、粒子与特效，以及 IoT 大屏实战与性能优化速查。"
tags: [threejs]
listed: false
hub: true
nav_title: "🧊 Three.js 3D 可视化"
nav_order: 10
last_modified_at: 2026-10-05
permalink: /技术/threejs/
---

# Three.js 教程（3D 大屏与可视化）· 系列目录

目标很具体：**能自己搭出一块能交付的 3D 数据大屏**——场景能跑满 60 帧、点击设备能弹出信息、
模型/贴图加载不卡首屏。前面七章按「建场景 → 加物体 → 打光 → 上贴图 → 动起来 → 能点」的顺序推进，
第 9 章把这些拼成一个完整的 IoT 大屏。

**推荐顺序**：01 WebGL 基础 → 02 几何体与材质 → 03 相机与控制器 → 04 光源与阴影 →
05 纹理贴图 → 06 动画与渲染循环 → 07 交互与射线检测 → 08 粒子特效 → 09 IoT 大屏实战 → 10 性能速查

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

- 性能与速查：[性能优化与面试速查](10-性能优化与面试速查.md)
- 全部技术系列总索引：[技术知识库总索引](../README.html)
