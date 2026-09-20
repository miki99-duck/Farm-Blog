---
title: "第9章 Spring 最新版本新特性详解"
tags: [Spring]
---

# 第9章 Spring 最新版本新特性详解

> 写作时间：2026年9月。信息来源：spring.io 官方博客与官方 Release Notes（检索于 2026-09）。
> 本章定位：知识点速览——Spring 生态现在发展到哪了、每个新特性是什么/为什么好/怎么用。
> 最后一节给出"新老知识衔接表"，帮你把新特性挂到已有的 2.7 知识体系上。

## 1. 版本现状（先认清地图）

截至 2026 年 9 月：

| 版本线 | 最新版本 | 基线要求 | 状态 |
|--------|---------|---------|------|
| Spring Boot 2.7 | 2.7.18 | JDK 8+ | 已 EOL（无公开补丁） |
| Spring Boot 3.5.x | 3.5.14 | JDK 17+ | 维护线（配 Framework 6.2.18） |
| **Spring Boot 4.0.x** | **4.0.6** | **JDK 21+（推荐 25）** | 当前主线（配 Framework 7.0.7） |
| Spring Boot 4.1 | 4.1.0-RC1 | JDK 21+ | 即将 GA |
| Spring Framework 7.0 | 7.0.7 | JDK 17+（推荐 25） | 4.0 配套 |

- Spring Boot 4.0 GA 于 2025 年 11 月 20 日发布，是自 3.0（javax→jakarta）以来最大换代。
- 两个时间线概念：3.5 是"继续打磨"线，4.0 是"新一代"线；两者都还在同步维护。

## 2. 新特性逐个详解

### 2.1 虚拟线程（Virtual Threads）默认开启

是什么：Java 21 正式引入的"轻量级线程"。一个平台线程（约 1MB 栈）上可挂几十万个
虚拟线程（几 KB），阻塞 I/O 时虚拟线程自动让出载体线程。

为什么好：传统"固定线程池 + 阻塞 JDBC/Kafka"模型下，高并发 I/O 时线程不够用，
于是被迫上响应式编程（WebFlux）——难学且心智负担重。虚拟线程让**同步阻塞代码
直接享受高吞吐**，业务代码零改动，不需要响应式。

怎么用：
- Boot 3.2+：`spring.threads.virtual.enabled=true`
- **Boot 4.0：Java 21+ 下默认开启**，Tomcat/Jetty 请求处理自动切虚拟线程
- 两个坑（能讲出才是真懂）：
  - synchronized 块内阻塞会 pinning（钉住载体线程）→ 用 ReentrantLock 替代
  - ThreadLocal 在虚拟线程场景内存放大 → 新代码考虑 ScopedValue（Java 24+）
  - 结论：别手写固定线程池跑 I/O，虚拟线程本身就是答案

```java
// 业务代码完全不用变，Boot 4 里天然跑在虚拟线程上
@PostMapping("/collect")
public Result collect(@RequestBody IotData data) {
    iotPersistenceService.save(data);  // 阻塞 JDBC，虚拟线程让出载体，吞吐提升
    return Result.ok();
}
```

### 2.2 Jakarta EE 11 + Hibernate 7（JPA 3.2）

是什么：Servlet 6.1 / JPA 3.2 / Bean Validation 3.1 基线提升，Hibernate ORM 7 随行。

亮点：
- **@SoftDelete**：一个注解实现逻辑删除，框架自动过滤所有查询，
  不用手写"每个 SQL 都带 deleted=0"
- 复杂 join 分页生成更优 SQL（少子查询）
- java.time（LocalDateTime）直接映射，不再需要手写 AttributeConverter
- Embeddable 聚合映射 JSON 列更顺手

```java
@Entity
@SoftDelete                 // 自动加 deleted 列：delete() 变 UPDATE，查询自动过滤
public class Device {
    @Id private Long id;
    private String code;
}
```

### 2.3 JSpecify 空安全（编译期拦 NPE）

是什么：@NullMarked（包级"默认非空"）+ @Nullable（显式可空）标注，
IDE 与编译期即可警告可能 NPE 的调用。

为什么好：NPE 是后端最高频线上 Bug。以前靠经验 + Optional + 运行时判空，
现在类型系统直接拦住，改完代码立刻见红线。

```java
// package-info.java
@NullMarked
package com.example.iot.service;

// 返回可空时显式标注，调用处不判空则编译期警告
@Nullable
public Device findByCode(String code) { ... }
```

### 2.4 声明式 HTTP 客户端 + RestClient

是什么：Spring 6.1 / Boot 3.2 引入 RestClient（流式 API），配合
HttpServiceProxyFactory 把 HTTP 调用变成"接口 + 注解"，像调本地方法。

为什么好：RestTemplate 啰嗦、WebClient 是响应式风格。RestClient + 接口代理 =
同步、简洁、可 mock 单测，调第三方服务的代码量砍一半。

```java
// ① 定义接口：一个方法 = 一个 HTTP 调用
public interface DeviceApi {
    @GetExchange("/api/devices/{code}")
    DeviceInfo getDevice(@PathVariable String code);
}

// ② 生成代理
@Bean
DeviceApi deviceApi(RestClient.Builder builder) {
    RestClient client = builder.baseUrl("http://iot-platform").build();
    return HttpServiceProxyFactory.builderFor(RestClientAdapter.create(client))
            .build().createClient(DeviceApi.class);
}
// ③ 使用：deviceApi.getDevice("CR007"); 像本地方法，可统一配超时/重试
```

### 2.5 结构化并发（StructuredTaskScope）

是什么：Java 21 预览、Java 24 正式的并发新范式，Boot 4 整合进请求生命周期。
try-with-resources 管理"一批并行任务"：要么全部完成、要么统一取消。

为什么好：CompletableFuture 链难读、失败时其他线程没人管（泄漏）。
结构化并发：代码像同步一样直白，失败自动传播 + 取消，scope 关闭即回收。

```java
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Future<Profile>   p = scope.fork(() -> profileService.get(userId));
    Future<List<Order>> o = scope.fork(() -> orderService.getRecent(userId));
    scope.join();          // 等全部
    scope.throwIfFailed(); // 有失败即抛，自动取消其余
    return new Dashboard(p.get(), o.get());
}
```

### 2.6 GraalVM Native + AOT + CDS

是什么：Boot 4 把 AOT（提前编译）与 CDS（类数据共享）做成构建期默认能力：
- 标准 JVM 部署：CDS 让启动提速约 30%
- GraalVM Native Image：反射配置自动处理，第三方库自带元数据，兼容阻力大幅下降

为什么好：微服务/K8s 下，启动快 = 扩容快、发布快、省内存。

```java
// 构建：mvn -Pnative native:compile
// 运行：./target/app   ← 几十毫秒启动，内存约为 JVM 的 1/5
```

注意点：反射/动态代理/MyBatis 这类框架在 Native 下仍需额外适配，
单体项目更务实的收益是 CDS（免费拿到）。

### 2.7 Spring Security 7（配置简化）

是什么：移除过时 API：antMatcher/mvcMatchers → requestMatchers、
authorizeRequests → authorizeHttpRequests、csrf().disable() → 新写法。

```java
http.authorizeHttpRequests(auth -> auth
        .requestMatchers("/login", "/captcha").permitAll()
        .requestMatchers("/api/**").hasRole("ADMIN")
        .anyRequest().authenticated())
    .csrf(AbstractHttpConfigurer::disable)
    .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));
```

### 2.8 模块化 Starters（依赖减肥）

Boot 4 重构 starter 依赖树：去掉大量不必要的传递依赖。
依赖越瘦 → 冲突越少、启动越快、漏洞面越小。

### 2.9 可观测性（Micrometer + OTLP）

Boot 3 起以 Micrometer 为指标标准，Boot 4 强化 OTel 集成：
trace/metric/log 三件套开箱即用，推 Prometheus/Grafana/Tempo 只需配置项。

```yaml
management:
  otlp:
    tracing:
      endpoint: http://collector:4318/v1/traces
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
```

### 2.10 内置 API 版本化（Framework 7）

API 版本控制做成内置能力，不用手写拦截器 / URL 前缀技巧，接口 v1/v2 共存更规范。

### 2.11 Spring AI（生态热点）

Spring 官方 AI 框架：ChatClient（像 JdbcTemplate 一样简单的 LLM 调用）、
向量库、RAG。企业做智能客服/知识问答大概率走它，值得了解 API 风格。

## 3. 新老知识衔接表（把新特性挂到已有知识上）

| 已有知识（2.7 时代） | 新知识点 | 一句话衔接 |
|---------------------|---------|-----------|
| 线程池 + WebFlux 二选一 | 虚拟线程 | 第三条路：阻塞代码直接高吞吐 |
| 手写 deleted=0 逻辑删除 | Hibernate @SoftDelete | 框架把模板代码内置了 |
| 判空全靠 Optional/if | JSpecify 标注 | 编译期就报警，不用等线上 |
| RestTemplate | RestClient + 接口代理 | 同样的活，代码减半还可 mock |
| CompletableFuture 链 | StructuredTaskScope | 并行 + 统一失败取消，防线程泄漏 |
| 启动 5~10 秒、反复调优 | CDS / AOT | 构建期免费提速约 30% |
| Security 5 复制粘贴配置 | Security 7 | 方法名直白，可读性大幅提升 |
| 一个 starter 拖一堆 jar | 模块化 starter | 按需引入，依赖冲突减半 |
| 出问题靠日志 grep | Micrometer + OTLP | 指标+链路+日志三件套 |
| 手写 URL 版本前缀 | 内置 API 版本化 | 规范统一、代码少 |
| 手搓大模型调用 | Spring AI | 官方 ChatClient + RAG |

## 4. 知识怎么进面试（话术）

- 主动点："我关注到 Boot 2.7 已停维护、4.0 已 GA，了解过虚拟线程和 AOT 的方向。"——显示在跟踪生态。
- 虚拟线程追问：答出 pinning（synchronized 坑）、ThreadLocal 放大、以及"同步代码不再需要响应式"的取舍。
- Native 追问：答反射/动态代理需要额外元数据，MyBatis 类框架要专门适配，所以单体更务实的是 CDS。
- 声明式 HTTP 追问：RestClient 与 WebClient 的区别（同步 vs 响应式）、接口代理怎么生成。
- 加分句："Spring AI 的 ChatClient 风格我很熟，企业后续做故障诊断问答优先考虑它。"

## 5. 学习路径建议

1. 先吃透 2.1 虚拟线程（Java 语言级变化，影响最深）。
2. 再学 2.4 RestClient + 2.5 StructuredTaskScope（日常编码立刻能改善）。
3. 抽空看 2.9 可观测性（工程化必备）与 2.11 Spring AI（生态热点）。
4. 2.2/2.3/2.6/2.7 了解概念即可，等真升级再深挖。
5. 保持信息来源：spring.io 博客、GitHub Wiki Release Notes（别只刷二手解读）。

> 版本号与日期以 spring.io 官方博客 / Release Notes 为准。