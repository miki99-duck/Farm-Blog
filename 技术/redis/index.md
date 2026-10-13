---
layout: default
title: "Redis 8.x 新特性剖析 · 系列目录"
description: "Redis 系列目录：8.0 到 8.10 的演进主线，Vector Sets 与 Array 两个新数据类型、compact hash/HIMPORT 的共享字段名注册表、hash 字段 TTL 与 subkey 通知、流幂等与 XNACK、原子槽迁移的两阶段握手，以及各版本官方性能数字与升级陷阱。"
tags: [Redis]
listed: false
hub: true
nav_title: "🧱 Redis 8.x 新特性"
nav_order: 5
last_modified_at: 2026-10-05
permalink: /技术/redis/
---

# Redis 8.x 新特性剖析 · 系列目录

这一系列**不写 Redis 入门**（`SET`/`GET`、缓存穿透击穿雪崩那套另有专文），只做两件事：

1. **把 8.x 的演进主线讲成一条线**：8.0 的 One Redis 与 I/O 线程 → 8.2 的 Vector Sets 补全与 `XDELEX` → 8.4 的原子槽迁移与 `FT.HYBRID` → 8.6 的流幂等 → 8.8 的 Array 与 `XNACK` → 8.10 的 compact hash 与 `XREAD MAXSIZE`。
2. **把每个"新命令"背后的约定讲透**：为什么 `HSET` 会抹掉字段 TTL、为什么 compact hash 一旦转换就永不退回、为什么 `XNACK` 必须改造 PEL 的顺序、原子槽迁移到底把不可用窗口换成了什么代价。

写作口径：**只写能在官方文档里逐条核对的东西**；官方没有明确写、或官方两处说法冲突的地方，正文里一律标 `[未确认]`，不猜。

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

- 缓存与分布式锁的工程用法（不是新特性，是"怎么用"）：[微服务组件 09 · 缓存与分布式锁 Redis / Redisson](../微服务/09-微服务组件-缓存与分布式锁Redis.html)
- 消息中间件对照：[Kafka 与 ZooKeeper 完全教程](../kafka/)
- 全部技术系列总索引：[技术知识库总索引](../README.html)
