---
layout: default
title: "Kafka 与 ZooKeeper 完全教程 · 系列目录"
description: "Kafka 完全教程：核心概念与架构、生产者与消费者、分区与副本、ISR 与消息可靠性、ZooKeeper 与 KRaft、Windows/Linux 环境搭建、Spring 集成，含大量可直接运行的命令与配置。"
tags: [Kafka]
listed: false
hub: true
last_modified_at: 2026-10-05
permalink: /技术/kafka/
---

# Kafka 与 ZooKeeper 完全教程 · 系列目录

一篇把 Kafka 从头讲到能上手的**长文**（单篇 4600 行、178 个代码块）：从消息队列要解决的
问题讲到分区副本机制，再到 Windows 上把 ZooKeeper 与 Kafka 跑起来、用命令行验证
生产消费、最后接进 Spring Boot。看的时候建议左边开目录按需跳，不用从头顺读。

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

- 微服务里消息队列的用法：[消息队列 RocketMQ](../微服务/07-微服务组件-消息队列RocketMQ.html)
- 消息可靠性怎么做：[难题四 · 消息可靠性](../微服务/04-难题四-消息可靠性.html)
- 全部技术系列总索引：[技术知识库总索引](../README.html)
