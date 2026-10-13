---
layout: default
title: "微服务组件与四大难题 · 系列目录"
description: "微服务系列目录：组件篇 17 讲（Gateway、Nacos、OpenFeign、Sentinel、Seata、RocketMQ、SkyWalking、Redis 分布式锁、JWT/OAuth2、XXL-Job、ELK、Prometheus、ShardingSphere、Docker 与 K8s）＋四大难题 5 讲（TCC、跨库分页、缓存一致性、消息可靠性）。"
tags: [微服务]
listed: false
hub: true
nav_title: "🧩 微服务组件与四大难题"
nav_order: 3
last_modified_at: 2026-10-05
permalink: /技术/微服务/
---

# 微服务组件与四大难题 · 系列目录

这个目录下其实是**两个并行系列**，按你的目的挑一条走：

- **组件篇**：把一套微服务该有的中间件逐个过一遍，重点是「它在链路里干什么、配错会怎样」。
- **四大难题**：分布式事务 TCC、跨库分页、缓存一致性、消息可靠性。每一讲都是
  「反面教材 → 渐进解法 → 指标量化」的三段式，配套源码可以一步一步照着搭出来。

{%- assign segs = page.path | split: '/' -%}
{%- assign dir = segs[0] | append: '/' | append: segs[1] | append: '/' -%}
{%- assign all = site.pages | sort: "path" -%}
{%- assign groups = "微服务组件,微服务四大难题" | split: "," -%}
{%- assign total = 0 -%}
{%- for p in all -%}
  {%- if p.path contains dir and p.name != "index.md" and p.listed != false -%}{%- assign total = total | plus: 1 -%}{%- endif -%}
{%- endfor -%}

## 全部章节（共 {{ total }} 篇）

{%- for g in groups -%}
{%- assign n = 0 -%}
{%- for p in all -%}
  {%- if p.path contains dir and p.series == g and p.name != "index.md" -%}{%- assign n = n | plus: 1 -%}{%- endif -%}
{%- endfor %}

<h3>{{ g }}（{{ n }} 篇）</h3>

<ul class="hub-list">
{%- for p in all -%}
{%- if p.path contains dir and p.series == g and p.name != "index.md" %}
  <li class="hub-item">
    <a class="hub-link" href="{{ p.url | relative_url }}">{{ p.title | default: p.name }}</a><span class="hub-meta">{{ p.content | strip_html | strip_newlines | strip | size }} 字</span>
    <p class="hub-sum">{{ p.summary | default: p.description | default: p.content | strip_html | strip_newlines | strip | truncate: 100 }}</p>
  </li>
{%- endif -%}
{%- endfor %}
</ul>
{%- endfor %}

## 相关

- 组件全景一页看完：[微服务组件总览](00-微服务组件总览.html)
- 面试最高频的一讲：[难题三 · 缓存一致性](03-难题三-缓存一致性.html)
- 消息中间件单独成篇：[Kafka 与 ZooKeeper 完全教程](../kafka/)
- 全部技术系列总索引：[技术知识库总索引](../README.html)
