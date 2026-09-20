---
title: "第14章 Spring AI 入门"
tags: [Spring]
---

# 第14章 Spring AI 入门

> 学习定位：2025~2026 生态最热方向，面试加分项。目标不是让你马上开发 AI 功能，
> 而是建立"Spring 怎么接大模型"的心智模型：ChatClient 调用、结构化输出、RAG 检索增强。
> 国内落地场景（对你不遥远）：智能客服、设备故障诊断问答、数据报表自然语言查询。

## 1. 一句话定位

**Spring AI = Spring 官方的大模型开发框架，把"调大模型"封装得像操作数据库一样简单：
ChatClient 对应 JdbcTemplate，PromptTemplate 对应 SQL，接口统一、厂商可换。**

## 2. 为什么需要它（不直接用 OpenAI SDK？）

裸调大模型 SDK 的问题：

1. 厂商锁定：OpenAI/Claude/通义/DeepSeek 每家 SDK 不一样，换厂商改一批代码。
2. 重复劳动：每个接入都要自己处理 Prompt 拼接、超时重试、解析 JSON、Token 计数。
3. 和 Spring 生态割裂：没有配置管理、没有监控、没有和业务 Bean 的组合。

Spring AI 的设计就是 **JDBC 思路**：定义统一 API，底层驱动（各家模型）可插拔——
像 JDBC 之于 MySQL/Oracle。配置切到别的模型，业务代码几乎不动。

## 3. 起步：依赖与配置

```xml
<!-- 引入一个模型厂商的 starter 即可 -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-starter-model-openai</artifactId>
    <version>1.0.0-M6</version>   <!-- 以官方最新为准 -->
</dependency>
```

```yaml
spring:
  ai:
    openai:
      base-url: https://api.deepseek.com   # OpenAI 兼容接口就能接（DeepSeek/通义/硅基流动）
      api-key: ${DEEPSEEK_API_KEY}
      chat:
        options:
          model: deepseek-chat
          temperature: 0.7
```

关键认知：**国内模型大多提供"OpenAI 兼容"接口，所以一个 openai starter
就能接 DeepSeek/通义/Kimi 等，这是 Spring AI 好上手的第一个原因。**

## 4. ChatClient：最核心的 API

```java
@Service
public class ChatService {
    private final ChatClient chatClient;

    public ChatService(ChatClient.Builder builder) {
        // 等价于 JdbcTemplate 的构建方式
        this.chatClient = builder.build();
    }

    public String ask(String question) {
        return chatClient.prompt()
                .user(question)
                .call()
                .content();
    }
}
```

三个步骤：prompt（组装请求）→ call/stream（同步/流式调用）→ content（取文本）。

带模板的多轮/结构化调用：

```java
// PromptTemplate + 参数，像 SQL 预编译一样组织输入
public String diagnose(String deviceCode, String logTail) {
    String system = """
            你是燃气设备运维专家。根据设备日志诊断故障，输出：故障原因、处理建议。
            只输出与日志相关的内容，不要编造。
            """;
    return chatClient.prompt()
            .system(system)
            .user(u -> u.text("设备 {code} 最近日志：\n{logs}")
                    .param("code", deviceCode)
                    .param("logs", logTail))
            .call()
            .content();
}
```

为什么系统提示词（system prompt）很重要：它是"给模型定人设和边界"的入口，
RuoYi 的项目里做"售前咨询机器人"其实就是这个模板 + 知识库。

## 5. 结构化输出（让 AI 直接返回 JSON 对象）

大模型返回纯文本，业务要的是对象。Spring AI 支持类型化输出：

```java
// 定义一个结果类型：AI 直接填充成对象，无需手写 JSON 解析
public record FaultResult(String cause, String suggestion, int confidence) {}

FaultResult r = chatClient.prompt()
        .user(u -> u.text("分析故障:{0}", logTail))
        .call()
        .entity(FaultResult.class);   // 框架自动要求模型输出 JSON 并反序列化
```

适用场景：把 AI 输出接到流程里（自动建工单、写入告警表）时，
record/DTO + entity() 是最省事的做法。

## 6. Prompt 技巧速记（Prompt Engineering 五原则）

1. 明确角色（system prompt："你是…"）。
2. 给边界（"只根据提供的数据回答，不要编造"）——防幻觉。
3. 给格式（"输出 JSON：{cause,suggestion}"）——配合结构化输出。
4. 给示例（few-shot：给两条"输入→输出"样例）。
5. 控制温度（temperature：客服问答 0.3 偏低更稳，创意写作 0.9）。

```java
// few-shot 示例：在 prompt 里带样例
chatClient.prompt()
    .user("""
        判断设备告警等级。示例：
        输入：压力突变 120% → 输出：紧急
        输入：温度波动 3℃ → 输出：普通
        现在输入：{alert}
        """.replace("{alert}", alertText))
    .call().content();
```

## 7. RAG：让 AI 说"我们自己的数据"

模型不知道你公司/项目的私有知识（设备手册、运维规范、历史工单）。
RAG（检索增强生成）两步走：

```
用户提问
  → ① 检索：把问题向量化，去向量库找最相关的知识片段
       （Embedding 模型 + pgvector / Redis vector / Milvus）
  → ② 生成：把"问题 + 检索到的片段"一起发给大模型，让模型基于片段回答
```

为什么要向量检索：关键词搜索同义不同词会漏（"阀门卡滞"vs"阀门卡住"），
向量检索按语义相似度找，召回率更高。

Spring AI 里的一套代码：

```java
// ① 索引：把文档切成块(TextSplitter) → 向量化 → 存入向量数据库
VectorStore vectorStore = new PgVectorStore(/* DataSource 等 */);
vectorStore.add(List.of(new Document("阀门的检修周期是每季度…")));

// ② 问答：自动完成"检索 + 组装 prompt + 生成"
Answer answer = chatClient.prompt()
        .user("阀门检修周期多久一次？")
        .advisors(QuestionAnswerAdvisor.builder(vectorStore).build())  // RAG 核心一行
        .call().entity(Answer.class);
```

对 IoT 平台的想象空间：运维知识库 + 设备手册 → 一线人员直接问"这台设备
为什么压力告警、怎么处理"——RAG 就是这个 Demo 的第一版架构。

## 8. 功能全景图（知道有这些就行）

| 能力 | 用途 |
|------|------|
| ChatClient / 流式(stream) | 对话、生成 |
| entity() 结构化输出 | AI 输出直接进业务对象 |
| Embedding + VectorStore | 语义检索、RAG 知识库 |
| Image / Audio / Modality | 图片生成、语音转写（国内接入讯飞等） |
| Advisor 体系 | RAG、记忆、日志审计、安全过滤（可插拔） |
| 多模型抽象 | 同一套代码切换 OpenAI/通义/DeepSeek/Claude |

## 9. 面试怎么讲（加分话术）

- 主动句："我了解 Spring AI，它的 ChatClient 封装思路类似 JdbcTemplate，
  用 RAG 能让大模型回答企业私有知识，比如设备运维手册。"
- 追问 RAG 原理：答"检索(向量相似度) + 生成(基于片段)"两步，
  以及为什么用向量（语义匹配优于关键词）。
- 追问结构化输出：答 entity() + 提示词约束 JSON 输出 + 反序列化。
- 追问 Token 成本：答缓存常用回答、限制 max-tokens、控制上下文长度、
  本地小模型兜底简单问答。
- 追问跟 LangChain 对比：Spring AI 是 Spring 官方、和现有 Bean/配置/监控
  无缝集成；LangChain 生态更全但偏 Python、集成成本高。

## 10. 学习路径建议

1. 本地拿 DeepSeek API Key（或任何 OpenAI 兼容服务），跑通 4 节 ChatClient。
2. 加一个结构化输出场景（分析日志 → FaultResult）。
3. 加 RAG：pgvector（PostgreSQL 插件，你项目已有 PostgreSQL）存运维手册，
   做成"设备问答"小 Demo。
4. 关注官网文档 spring.ai 的 Getting Started，跟随版本更新。

## 11. 一句话总结

**Spring AI = 用 JdbcTemplate 的思维接大模型：统一 API 换厂商、PromptTemplate
管输入、entity() 管输出、VectorStore + Advisor 让模型说企业自己的话。**