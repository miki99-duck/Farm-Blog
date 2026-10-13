---
layout: default
title: "MySQL 9.x 深度剖析 · 系列目录"
description: "MySQL 系列目录：9.7 作为 9.x 首个 LTS 的意义、Innovation 与 LTS 的版本模型、日历版本号 26.7/26.10 的来历、Hypergraph 优化器进入社区版、VECTOR 类型的存储与「社区版没有向量索引」的边界、Enterprise-only 的 JavaScript 存储程序，以及 17 条升级暗礁。"
tags: [MySQL]
listed: false
hub: true
nav_title: "🐬 MySQL 9.x 深度剖析"
nav_order: 6
last_modified_at: 2026-10-05
permalink: /技术/mysql/
---

# MySQL 9.x 深度剖析 · 系列目录

本系列面向**要真升级、真要选型**的人，不做"30 天精通 MySQL"式的罗列。核心是三句话：

1. **9.7 是 9.x 的第一个 LTS，因此它才是那个"破坏窗口"** —— 9.0~9.6 创新版里所有被移除的东西，都在 9.7.0 一次性落地；而 LTS 内部之后不再移除。理解这一点，才能理解为什么"从 8.4 升到 9.7"是所有升级里最需要预案的一次。
2. **9.7 之后没有 9.8、也没有 10.x** —— Oracle 已改用日历版本号 `YY.M`（26.7 → 26.10 → 27.1）。
3. **VECTOR 类型 ≠ 向量数据库** —— 社区版既不能给 `VECTOR` 建任何索引，也用不了官方的距离函数；ANN/HNSW 在 HeatWave。这条边界不清楚，选型就会踩空。

写作口径：结论尽量给官方出处；官方相互矛盾的地方（例如 "What Is New in MySQL 9.7" 与 9.5 release notes 对"移除项"的说法不一致）会**明确指出冲突**并说明以哪份为准，而不是二选一蒙一个。

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

- 分库分表的工程实践：[微服务组件 15 · 分库分表 ShardingSphere](../微服务/15-微服务组件-分库分表ShardingSphere.html)
- 跨库分页与缓存一致性（数据库侧难题）：[难题二 · 跨库分页查询](../微服务/02-难题二-跨库分页查询.html)、[难题三 · 缓存一致性](../微服务/03-难题三-缓存一致性.html)
- 全部技术系列总索引：[技术知识库总索引](../README.html)
