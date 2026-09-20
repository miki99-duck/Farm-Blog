# 第15章 RAG 实战 Demo：设备运维知识问答

> 场景：把"设备运维手册"变成可对话的知识库——一线人员问"阀门压力异常怎么处理"，
> 系统检索运维手册里最相关的段落，让大模型基于手册回答（而不是瞎编）。
> 技术栈：Spring Boot 3.5 + Spring AI + PostgreSQL(pgvector) + DeepSeek(OpenAI 兼容)。
> 本 Demo 是学习用骨架：API 以官方文档为准，版本不同处已标注，跑通思路为主。

## 1. 架构总览

```
┌─────────────┐  导入阶段  ┌──────────────────────────────────────┐
│ 运维手册.txt │ ────────> │ DocumentService                      │
└─────────────┘           │ 切块(TextSplitter) → Embedding(向量化) │
                          │ → 存入 pgvector (vector_store 表)      │
                          └──────────────────────────────────────┘
┌─────────────┐  问答阶段  ┌──────────────────────────────────────┐
│ 用户问题     │ ────────> │ ChatService                          │
│ "压力告警?" │           │ ① 问题向量化 → 检索 topK 相关片段       │
└─────────────┘           │ ② 问题+片段 → 大模型 → 基于片段回答      │
                          │ (QuestionAnswerAdvisor 自动完成)      │
                          └──────────────────────────────────────┘
```

两个阶段的关键：导入（离线做一次）+ 问答（在线每次做）。
RAG 全部代码的"魔法"就在 QuestionAnswerAdvisor 这一行——它把检索+拼 prompt 封装了。

## 2. 依赖（pom.xml）

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.x</version>   <!-- 或 4.0.x，Spring AI 支持两条线 -->
</parent>

<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
        <groupId>org.springframework.ai</groupId>
        <artifactId>spring-ai-starter-model-openai</artifactId>
        <!-- 版本见官方 BOM：Spring AI 1.0.x（2025 年 GA 后持续迭代） -->
    </dependency>
    <dependency>
        <groupId>org.springframework.ai</groupId>
        <artifactId>spring-ai-pgvector-store</artifactId>
        <!-- 向量库：复用你项目已有的 PostgreSQL -->
    </dependency>
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
    </dependency>
</dependencies>
```

> 注意：Spring AI 版本与 Boot 版本绑定，务必从官方文档的"Version Mapping"
> 表里选配对版本，别随便填。

## 3. 配置（application.yml）

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/iot_rag
    username: postgres
    password: ${DB_PASSWORD}
  ai:
    openai:
      base-url: https://api.deepseek.com   # OpenAI 兼容接口
      api-key: ${DEEPSEEK_API_KEY}
      chat:
        options:
          model: deepseek-chat
          temperature: 0.2                 # 知识问答要稳，温度调低
  ai:
    vectorstore:
      pgvector:
        dimensions: 1024                   # 与 embedding 模型维度一致
        index-type: HNSW                   # 检索快；小数据可用 IVFFlat
```

## 4. 数据库准备（pgvector）

```sql
-- ① 开启扩展（PostgreSQL 15+，需要服务器装过 pgvector 插件）
CREATE EXTENSION IF NOT EXISTS vector;

-- ② Spring AI 的 PgVectorStore 需要的表（官方 schema，按版本核对）
--    Spring AI 有自动初始化选项，也可手动执行官方 schema.sql
CREATE TABLE IF NOT EXISTS vector_store (
    id UUID PRIMARY KEY,
    content TEXT,
    metadata JSON,
    embedding vector(1024)      -- 维度与 embedding 模型一致
);
CREATE INDEX ON vector_store USING hnsw (embedding vector_cosine_ops);
```

Docker 一行起 PostgreSQL + pgvector：

```bash
docker run -d --name pgvector -p 5432:5432 \
  -e POSTGRES_PASSWORD=123456 -e POSTGRES_DB=iot_rag \
  pgvector/pgvector:pg16
```

## 5. 核心代码

### 5.1 配置类：组装 ChatClient 和 VectorStore

```java
@Configuration
public class RagConfig {

    // ChatClient：像 JdbcTemplate 一样注入使用
    @Bean
    ChatClient chatClient(ChatClient.Builder builder) {
        return builder.build();
    }

    // VectorStore：pgvector 实现，Spring AI 自动管理表的读写
    @Bean
    VectorStore vectorStore(JdbcTemplate jdbcTemplate, EmbeddingModel embeddingModel) {
        // API 可能随版本微调（构造器/Builder），以官方文档为准
        return PgVectorStore.builder(jdbcTemplate, embeddingModel)
                .dimensions(1024)   // 与 embedding 模型输出维度一致
                .build();
    }
}
```

### 5.2 导入服务：手册 → 知识库（启动时跑一次）

```java
@Service
public class DocumentIngestService {

    private final VectorStore vectorStore;
    private final EmbeddingModel embeddingModel;

    public DocumentIngestService(VectorStore vectorStore, EmbeddingModel embeddingModel) {
        this.vectorStore = vectorStore;
        this.embeddingModel = embeddingModel;
    }

    // 从 classpath 读手册，切块后入库
    public void ingest(Resource handbookResource) throws IOException {
        String text = new String(handbookResource.getInputStream().readAllBytes(),
                StandardCharsets.UTF_8);

        // ① 切块：手册太长不能整段喂给模型（超上下文/稀释相关性）
        //    按 ~500 字符切、重叠 50，让跨块内容不丢
        TextSplitter splitter = new TokenTextSplitter(500, 50);
        List<Document> chunks = splitter.split(new Document(text));

        // ② 每个块带元数据（来源、章节），回答时可溯源
        chunks.forEach(doc -> doc.getMetadata().put("source", "运维手册-v1"));

        // ③ 向量化 + 入库（embedding 模型按块生成向量，存 pgvector）
        vectorStore.add(chunks);
        System.out.println("已导入 " + chunks.size() + " 个知识块");
    }
}
```

启动时自动导入：

```java
@Component
public class DataInitializer implements ApplicationRunner {
    private final DocumentIngestService ingestService;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        ingestService.ingest(new ClassPathResource("docs/device-manual.txt"));
    }
}
```

### 5.3 问答服务：核心就一行 Advisor

```java
@Service
public class RagChatService {

    private final ChatClient chatClient;
    private final VectorStore vectorStore;

    public RagChatService(ChatClient chatClient, VectorStore vectorStore) {
        this.chatClient = chatClient;
        this.vectorStore = vectorStore;
    }

    public String ask(String question) {
        return chatClient.prompt()
                .user(question)
                // ★ 关键一行：自动完成
                //   1) 把 question 向量化，去 vectorStore 检索最相关片段
                //   2) 把"片段 + 问题"组装成 prompt
                //   3) 大模型只基于片段回答
                .advisors(QuestionAnswerAdvisor.builder(vectorStore)
                        .topK(3)                 // 取 3 个最相关片段
                        .build())
                .call()
                .content();
    }
}
```

### 5.4 控制器

```java
@RestController
@RequestMapping("/api/rag")
public class RagController {

    private final RagChatService ragChatService;

    @PostMapping("/ask")
    public Result ask(@RequestBody AskRequest req) {
        return Result.ok(ragChatService.ask(req.question()));
    }

    public record AskRequest(String question) {}
}
```

## 6. 手册示例（src/main/resources/docs/device-manual.txt）

```
燃气调压器（型号 CR007）检修规程
1. 压力异常：出口压力高于设定值 15% 以上，优先检查调压器弹簧是否断裂；
   若弹簧正常，检查指挥器膜片是否破损。处理前必须切断气源并泄压。
2. 阀门卡滞：先排查阀体内是否有杂质，清理后再手动活动阀杆；
   若阀杆变形，需整体更换阀芯组件，禁止强行敲击。
3. 维护周期：调压器每季度巡检一次，每半年做一次密封性测试；
   密封性测试标准为 15 分钟内压降不超过 0.5kPa。
4. 安全要求：检修必须双人作业，佩戴防爆工具，作业区 10 米内禁止明火。
...
```

问"调压器压力高 20% 怎么办" → 系统检索到第 1 段 → 大模型基于该段给出
"检查弹簧→检查膜片→切断气源泄压"的答案，而不是胡编。

## 7. 部署与运行步骤

1. 起 pgvector：第4节 docker 命令（或复用你 docker/db 里的 PostgreSQL，手动 CREATE EXTENSION）。
2. 配置环境变量：DEEPSEEK_API_KEY（DeepSeek 开放平台申请，或换任意 OpenAI 兼容 key）。
3. 启动应用：首次启动 DataInitializer 自动导入手册 → 控制台打印"已导入 N 个知识块"。
4. 测试：
   ```bash
   curl -X POST localhost:8080/api/rag/ask \
     -H "Content-Type: application/json" \
     -d '{"question":"调压器压力高 20% 怎么处理？"}'
   ```
5. 验证溯源：在 ask 返回里带上引用片段（把 metadata 一并返回），确认回答有出处。

## 8. 常见坑（必看）

| 坑 | 现象 | 解决 |
|----|------|------|
| 维度不匹配 | 插入向量报错 | embedding 模型维度 vs 建表 vector(n) 必须一致 |
| 没装 pgvector | CREATE EXTENSION 失败 | 用 pgvector/pgvector 官方镜像，别用普通 postgres 镜像 |
| 切块太粗/太细 | 回答答非所问 | 500~1000 字符 + 50 重叠起步，按手册章节调 |
| topK 太小 | 找不到答案 | 3~5；手册大可以更高 |
| 温度太高 | 回答飘、编造 | 知识问答 0.1~0.3 |
| API 版本 | 编译过不了 | Spring AI 1.x 迭代快，代码按官方最新示例核对 |
| Token 成本 | 导入阶段反复跑 | 手册不变就只导一次；可存"已导入版本号"跳过 |

## 9. 进阶方向

1. 答案溯源：把命中的片段（metadata.source + 片段原文）随答案返回，取信于业务方。
2. 对话记忆：Advisor 里加 ChatMemory（多轮追问"那什么时候做密封测试？"需要上下文）。
3. 定时增量导入：手册更新（监听文件/发布）→ 重新切块 → 更新对应向量。
4. 权限：不同角色只能检索授权片段（metadata 里带权限标签，检索时过滤）。
5. 成本优化：命中缓存（相同问题返回缓存答案）、摘要索引、本地小模型兜底简单问答。

## 10. 面试讲法（Demo 一句话版）

"我用 Spring AI 做了个设备运维问答 Demo：运维手册切块后向量化存进 pgvector，
用户提问时自动检索最相关的 3 个片段，让 DeepSeek 基于片段回答，
回答带出处。核心是 QuestionAnswerAdvisor，检索+生成一行配置搞定。"

## 11. 参考

- Spring AI 官方文档：https://docs.spring.io/spring-ai/reference/
- pgvector：https://github.com/pgvector/pgvector
- 版本对应表：Spring AI 官方 "Version Mapping"（Boot 3.3+/3.4/3.5/4.x 各有配对版本）
