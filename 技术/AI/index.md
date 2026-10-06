---
layout: default
title: "AI 应用开发（LangChain 1.0 + 智谱 GLM）· 系列目录"
description: "AI 应用开发系列目录：环境准备与第一次对话、Prompt 工程、结构化输出、LCEL 链式编排、记忆与会话管理、RAG 检索增强（上/下）、工具调用与 Agent、LangGraph 多智能体、生产化与部署，附练习参考答案与名词速查表。"
tags: [AI]
listed: false
hub: true
last_modified_at: 2026-10-05
permalink: /技术/AI/
---

# AI 应用开发（LangChain 1.0 + 智谱 GLM）· 系列目录

全部基于 2025-10 发布的 **LangChain 1.0 / LangGraph 1.0 稳定版 API**（没有网上大量过时的 0.x 写法），
默认模型用 `glm-4-flash` 免费档，零成本跟做。主线是「先跑通一次对话 → 学会约束输出 →
用 LCEL 把零件接成流水线 → 接上知识库（RAG）→ 让它自己调工具（Agent）→ 最后服务化部署」。

**推荐顺序**：00 导读 → 01 环境 → 02 Prompt → 03 结构化输出 → 04 LCEL → 05 记忆 →
06/07 RAG（核心）→ 08 工具调用与 Agent → 09 LangGraph → 10 生产化 → 毕业项目

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

- 术语看不懂时翻：[附录 · 名词速查表](附录-名词速查表.html)
- 做完练习对答案：[练习参考答案](练习参考答案.html)
- Spring 侧集成：[Spring AI 入门](../spring/14-SpringAI入门.html)、[RAG 实战 Demo](../spring/15-RAG实战Demo.html)
- 全部技术系列总索引：[技术知识库总索引](../README.html)
