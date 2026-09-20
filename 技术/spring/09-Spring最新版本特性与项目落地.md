---
title: "第9章 Spring 最新版本特性与项目落地"
tags: [Spring]
---

# 第9章 Spring 最新版本特性与项目落地

> 写作时间：2026年9月。信息来源：spring.io 官方博客与官方 Release Notes（检索于 2026-09）。
> 本章目标：① 讲清 Spring 生态现在发展到哪了 ② 每个新特性是什么、为什么好、怎么用
> ③ 结合你的 RuoYi 2.7 项目，给出可落地的应用路径与效率提升点。
> 面试加分点：主动谈"我在关注最新生态、有迁移计划"，比只会用 2.7 强得多。

## 1. 版本现状总览（先看清地图）

截至 2026 年 9 月：

| 版本线 | 最新版本 | 基线要求 | 支持状态 |
|--------|---------|---------|----------|
| Spring Boot 2.7 | 2.7.18 | JDK 8+ | ❌ 已 EOL（开源支持早已结束） |
| Spring Boot 3.5.x | 3.5.14 | JDK 17+ | ✅ 维护线（配 Framework 6.2.18） |
| **Spring Boot 4.0.x** | **4.0.6** | **JDK 21+（推荐 25）** | ✅ 当前主线（配 Framework 7.0.7） |
| Spring Boot 4.1 | 4.1.0-RC1 | JDK 21+ | 即将 GA |
| Spring Framework 6.2 | 6.2.18 | JDK 17+ | ✅ 3.5 配套 |
| Spring Framework 7.0 | 7.0.7 | JDK 17+（推荐 25） | ✅ 4.0 配套 |

关键事实：
- Spring Boot 4.0 GA 于 2025 年 11 月 20 日发布，是自 3.0（javax→jakarta）以来最大的一次换代。
- **Spring Framework 5.3.x / 6.1.x 的开源支持已于 2026 年正式结束**，还在用这些线的项目拿不到公开安全补丁（2026 上半年就曝出 CVE-2026-22740/22741/22745 等）。
- 你的项目若还是 Boot 2.7，属于"暴露在无补丁环境中"，这是迁移的第一驱动力，不只是"追新"。

## 2. 新特性逐个详解（是什么 → 为什么好 → 怎么用）

### 2.1 虚拟线程（Virtual Threads）默认开启 ★★★★

是什么：Java 21 正式推出的"轻量级线程"。一个平台线程（1MB 栈）上可以挂几十万个虚拟线程（几 KB），
阻塞 I/O 时虚拟线程自动让出载体线程，不再浪费线程资源。

为什么好：传统"线程池 200 上限 + 阻塞 JDBC/Kafka"的模型下，高并发 I/O 场景线程不够用，
于是大家被迫上响应式编程（WebFlux）——难学、难调、心智负担重。
虚拟线程让**阻塞式同步代码直接享受高吞吐**，不用改业务代码，不需要响应式。

怎么用：
- Spring Boot 3.2+：`spring.threads.virtual.enabled=true`（开关）。
- **Spring Boot 4.0：Java 21+ 环境下默认开启**，Tomcat/Jetty 的请求处理自动改用虚拟线程，
  一行代码都不用写。
- 代价/坑（面试能讲出这个说明真懂）：
  - synchronized 块内阻塞会造成线程 pinning（钉住载体线程），少用 synchronized，改用 ReentrantLock；
  - ThreadLocal 要谨慎：虚拟线程多、复用时 ThreadLocal 内存放大（改用 ScopedValue，Java 24+）；
  - 别自己 new 固定大小线程池去跑 I/O，虚拟线程本身就是答案。

```java
// 业务代码完全不用变，以下代码在 Boot 4 里天然跑在虚拟线程上
@PostMapping("/collect")
public Result collect(@RequestBody IotData data) {
    iotPersistenceService.save(data);   // 阻塞 JDBC，虚拟线程让出载体，吞吐大幅提升
    return Result.ok();
}
```

### 2.2 Jakarta EE 11 + Hibernate 7（JPA 3.2）★★★

是什么：Servlet 6.1 / JPA 3.2 / Bean Validation 3.1 基线提升，Hibernate ORM 7.x 随之而来。

为什么好：Hibernate 7 带来了几个"写代码更少、跑得更快"的能力：
- **@SoftDelete 注解**：一行注解实现逻辑删除，框架自动加 deleted 字段、自动过滤所有查询，
  不用再手写"每个 SQL 都带 deleted=0"。
- 复杂 join 分页生成更优 SQL（少子查询）。
- java.time 类型（LocalDateTime 等）直接映射，不再需要手写 AttributeConverter。
- Embeddable 聚合映射 JSON 列更顺手。

```java
// Hibernate 7：逻辑删除零模板代码
@Entity
@SoftDelete                    // 自动加 deleted 列，delete() 变成 UPDATE，查询自动过滤
public class Device {
    @Id private Long id;
    private String code;
}
```

对你的意义：如果项目里有一堆"deleted 标志 + 每个 Mapper 手写条件"的重复代码，
升级后可以直接删掉，这是实打实的开发效率提升。

### 2.3 JSpecify 空安全（编译期消灭 NPE）★★

是什么：官方推荐用 @NullMarked（包级声明"默认非空"）+ @Nullable（明确可空）标注代码，
IDE 和 Kotlin 编译器能在**编译期**就警告可能空指针的调用。

为什么好：NPE 是 Java 后端最高频的线上 Bug。以前只能靠经验 + Optional + 运行时判空，
现在类型系统层面就拦住，改完代码立刻看到红线，不需要等线上炸。

```java
// 包上声明：package-info.java
@NullMarked
package com.example.iot.service;

// 方法里：返回值明确可空，调用处不判空 IDE 直接报警
@Nullable
public Device findByCode(String code) { ... }
```

对你的意义：新写的 Service/Mapper 层直接标注；老代码不用全改，新代码从今天开始标注即可。

### 2.4 声明式 HTTP 客户端 + RestClient（替代 RestTemplate）★★★

是什么：Spring 6.1 / Boot 3.2 引入 RestClient（流式 API 的 HTTP 客户端），
配合 HttpServiceProxyFactory 可以把 HTTP 调用变成"定义一个接口 + 注解"，像调用本地方法一样调第三方服务。

为什么好：RestTemplate 功能够但写法啰嗦；WebClient 是响应式风格，同步项目里不搭。
RestClient + 接口代理 = 同步、简洁、可单测（mock 接口即可），
项目里调第三方接口（如调用另一个微服务、对接硬件平台）的代码量能砍一半。

```java
// ① 定义接口：一个方法 = 一个 HTTP 调用
public interface DeviceApi {
    @GetExchange("/api/devices/{code}")
    DeviceInfo getDevice(@PathVariable String code);

    @PostExchange("/api/collect")
    Result push(@RequestBody IotData data);
}

// ② 生成代理并注入使用
@Configuration
public class HttpClientConfig {
    @Bean
    DeviceApi deviceApi(RestClient.Builder builder) {
        RestClient client = builder.baseUrl("http://iot-platform").build();
        return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(client))
                .build().createClient(DeviceApi.class);
    }
}

// ③ 使用：像调本地方法，还能统一做超时、重试、异常映射
deviceApi.push(data);
```

对你的意义：IoT 平台经常要调第三方/兄弟系统接口，这比写一堆 RestTemplate 模板代码清爽得多，
也容易写单元测试（mock DeviceApi 就行）。

### 2.5 结构化并发（StructuredTaskScope）★★★

是什么：Java 21 预览、Java 24 正式的并发新范式，Spring Boot 4 把它整合进请求处理生命周期。
用 try-with-resources 管理"一批并行任务"，要么全部完成、要么统一取消，不留孤儿线程。

为什么好：以前并行调三个服务要写 CompletableFuture 链：
- 代码绕（thenCompose 嵌套）难读难调试；
- 一个失败，另外两个线程没人管，泄漏；
- 虚拟线程 + 结构化并发：代码像同步一样直白，失败自动传播+取消，天然防泄漏。

```java
// 并行拉取仪表盘数据：一个失败全部取消，scope 关闭即回收线程
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Future<Profile>  profile  = scope.fork(() -> profileService.get(userId));
    Future<List<Order>> orders = scope.fork(() -> orderService.getRecent(userId));
    scope.join();          // 等全部完成
    scope.throwIfFailed(); // 有失败就抛，自动取消其余
    return new Dashboard(profile.get(), orders.get());
}
```

对你的意义：报表页/首页聚合查询（IoT 项目常有"同时查设备状态+告警+统计"），
用它并行 + 统一错误处理，比手动线程池安全。

### 2.6 GraalVM Native + AOT + CDS（启动与内存优化）★★★

是什么：Boot 4 把 AOT（提前编译）和 CDS（类数据共享）做成了一等公民：
- 构建期自动生成类元数据，标准 JVM 部署下启动提速约 30%；
- GraalVM Native Image 支持大幅改进：反射配置自动处理，第三方库自带元数据。

为什么好：微服务/K8s 场景下，启动快 = 扩容快、发布快、资源省。
原来 Native 是"第二公民"（反射配到崩溃），Boot 4 把阻力砍掉了大半。

```java
// 构建：mvn -Pnative native:compile
// 运行：./target/app   ← 几十毫秒启动，内存是 JVM 的 1/5 左右
```

对你的意义：单体 RuoYi 项目短期用不上 Native（MyBatis/动态代理兼容要额外适配），
但 **CDS 是免费的**：Boot 4 构建期自动开启，直接享受启动提速。
面试可以讲"我了解 Native 的收益与兼容性代价（反射/动态代理/JDK 代理需要额外配置）"。

### 2.7 Spring Security 7（配置大幅简化）★★

是什么：移除大量过时 API：antMatcher/mvcMatchers → requestMatchers，
authorizeRequests → authorizeHttpRequests，csrf().disable() → csrf(AbstractHttpConfigurer::disable)。

为什么好：Security 5 时代配置又长又绕（多数人直接抄模板），
7.x 方法名更直白、类型安全，配置类可读性高一个档次。

```java
// Security 7 风格：链式、直白
http.authorizeHttpRequests(auth -> auth
        .requestMatchers("/login", "/captcha").permitAll()
        .requestMatchers("/api/**").hasRole("ADMIN")
        .anyRequest().authenticated())
    .csrf(AbstractHttpConfigurer::disable)
    .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
```

对你的意义：RuoYi-Vue 的 SecurityConfig 是迁移时改动最大的文件之一，
照着官方新写法重写一遍，代码更短（顺带治好了"复制粘贴看不懂"的老毛病）。

### 2.8 模块化 Starters（依赖减肥）★★

是什么：Boot 4 重构 starter 依赖树，去掉大量不必要的传递依赖，starter 更"瘦"。

为什么好：依赖树越瘦，冲突越少、启动越快、漏洞面越小。
原来"引入一个 starter 带进来一堆用不上的库"，现在按需引入。

对你的意义：迁移时正好借机清理 pom.xml，把不用的传递依赖显式排除，
RuoYi 老项目里常见的 jar 冲突（fastjson、druid、commons 版本打架）能顺势少一半。

### 2.9 可观测性（Micrometer + OTLP）★★★

是什么：Boot 3 起统一用 Micrometer 做指标，Boot 4 强化了与 OTel（OpenTelemetry）的集成，
trace/metric/log 三件套开箱即用，导出到 Prometheus/Grafana/Tempo 只需配置项。

为什么好：分布式排查问题靠日志 grep 的时代过去了，指标+链路+日志关联才是标准做法。
IoT 平台链路长（网关→Kafka→消费→多库落盘），没有 trace 出问题定位极痛苦。

```yaml
# application.yml：一行配置即可把指标和链路推到 OTLP 兼容后端
management:
  otlp:
    tracing:
      endpoint: http://collector:4318/v1/traces
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
```

对你的意义：即使暂不迁移，也可以先在 2.7 上引入 Micrometer + actuator 的 metrics，
给 Kafka 消费延迟、入库耗时埋点——这是纯增量收益。

### 2.10 内置 API 版本化（Framework 7）★★

是什么：Framework 7 把 API 版本控制做成内置能力，不用再手写拦截器或 URL 前缀技巧。

为什么好：接口演进（v1/v2 共存）是后端常态，内置支持意味着规范统一、代码少。

### 2.11 Spring AI（生态热点，了解即可）★

是什么：Spring 官方 AI 框架，统一接入 OpenAI/通义/DeepSeek 等大模型，
提供 ChatClient（像 JdbcTemplate 一样简单的 AI 调用）、向量库、RAG 支持。

对你的意义：华润燃气这类企业平台后续做"智能客服/设备故障诊断问答"大概率走 Spring AI，
现在了解 API 风格（ChatClient + PromptTemplate），简历上可以写"关注 AI 应用集成"。

## 3. 如何应用到你的项目（重点）

### 3.1 现状诊断

- 你现在的栈：Spring Boot 2.7 + JDK 8 + RuoYi-Vue。
- 问题：Boot 2.7 已 EOL，**没有公开安全补丁**；JDK 8 也已停止公开更新多年。
- 硬约束：RuoYi-Vue 是自研+二开框架，迁移要跟官方版本走，不能裸升。

### 3.2 三步迁移路线图（推荐路径）

```
第一步（1~2天）   第二步（3~5天）        第三步（按需）
JDK 8 → 17     Boot 2.7 → 3.5.x      Boot 3.5 → 4.0.x
               (改动最小的一跳)        (吃虚拟线程/AOT/新生态红利)
                                    JDK 17 → 21
```

关键点：**2.7 → 3.5 是必做项**（安全 + 架构现代化），4.0 可缓。
因为 3.x 和 4.x 的差异比 2.x→3.x 小得多（3.x 已是 jakarta 基线），先跳到 3.5 损失最小。

### 3.3 迁移 Checklist（RuoYi 项目实际要动的点）

| 模块 | 改动内容 |
|------|---------|
| JDK | 8 → 17（先跑通编译），后续再 21 |
| javax → jakarta | javax.servlet/javax.validation/javax.persistence → jakarta.*（全局替换，IDE 可一键） |
| Spring Security | SecurityConfig 重写：antMatcher→requestMatchers、csrf().disable()→新写法（2.7 时用 Security 5，3.x 用 6，语法差异大，直接照官方示例重写） |
| MyBatis | mybatis-spring-boot-starter 2.x → 3.x；PageHelper 换 Boot3 兼容版 |
| Druid | 换支持 jakarta 的版本，或改 HikariCP（你项目已是手动 HikariCP，反而简单） |
| FastJson | 若用于 HTTP 消息转换，改 Jackson（或换 Fastjson2 + 适配） |
| 配置文件 | spring.redis → spring.data.redis 等 key 变更；actuator 路径调整 |
| 其他 | Thymeleaf/定时任务/验证注解包名全局检查；Lombok 升到支持 JDK17 的版本 |

先做一个分支（如 ruoyi-boot3）验证，跑通核心登录+单表 CRUD 再全量迁移，别在主分支直接动。

### 3.4 迁移后拿到的效率收益（对照讲）

| 能力 | 效率收益 |
|------|---------|
| 虚拟线程（4.0 + JDK21） | 高并发 I/O 场景吞吐提升数倍，代码零改动 |
| @SoftDelete（Hibernate 7） | 删掉全项目手写的 deleted 条件模板代码 |
| RestClient + 声明式客户端 | 第三方接口调用代码量减半、可 mock 单测 |
| StructuredTaskScope | 聚合查询并行化，代码比 CompletableFuture 直白 |
| CDS | 启动提速约 30%，发布/扩容更快 |
| 模块化 starter | 依赖冲突与漏洞面收窄，构建更快 |
| Micrometer/OTLP | 指标链路开箱即用，线上问题定位从小时级到分钟级 |

### 3.5 暂不迁移时，今天就能做的三件事

1. **升级到 2.7.18 的替代方案**：2.7 无公开补丁，若短期不能升，
   至少做到：Web 层用 Spring Security 最新补丁版（Security 5.8 是 2.7 兼容的最后维护线）、
   反代层加 WAF 规则、上线 CVE 监控（GitHub Advisory 订阅 spring-projects）。
2. **引入 Micrometer**：Boot 2.7 自带 actuator，直接开 metrics，给 Kafka 消费延迟、
   入库耗时打点，成本极低，立即可观测。
3. **代码层面借鉴新思想**：用 CompletableFuture 的编排先学结构化并发的思路
   （try-with-resources + 失败统一取消）；新写的 HTTP 调用先抽象成接口再实现，
   为将来切 RestClient 留好接口边界。

## 4. 面试怎么讲这块（加分话术）

- "我的项目目前是 Boot 2.7，我知道它已经 EOL，正在规划迁到 3.5（JDK17），
  再视团队节奏升级 4.0 吃虚拟线程红利。" → 展示安全意识 + 规划能力。
- 被问"虚拟线程和线程池的区别"：答出 pinning 问题（synchronized 坑）、
  ThreadLocal 放大、以及"阻塞代码不再需要响应式"的取舍。
- 被问"Native Image 为什么难"：答反射/动态代理/类加载器需要额外元数据，
  MyBatis 这类框架要专门适配，所以单体项目建议 CDS 而非全量 Native。
- 亮点话术："我了解 Spring AI 的 ChatClient 风格，后续企业做故障诊断问答会优先考虑它。"

## 5. 行动建议（按优先级）

1. 本周：订阅 GitHub Advisory 的 spring-projects/spring-boot 安全公告（EOL 项目必须盯）。
2. 本月：开一个 ruoyi-boot3 分支，按 3.3 checklist 走通"登录 + 一个业务模块"。
3. 季度：评估 JDK21 + Boot 4 的收益（虚拟线程对你的 Kafka 消费/批量入库是直接利好）。
4. 长期：新写代码一律按 2.3/2.4 的风格（空安全标注 + 接口化 HTTP 调用），
   让老项目"边用边进化"，而不是攒一波大迁移。

> 版本号与日期以 spring.io 官方博客/Release Notes 为准，迁移前再核对一次最新 patch 版本。
