---
title: "第11章 结构化并发（StructuredTaskScope）原理"
tags: [Spring]
---

# 第11章 结构化并发（StructuredTaskScope）原理

> 与第10章配套：虚拟线程解决"线程不够用"，StructuredTaskScope 解决"并发的代码不好写"。
> Java 21 预览、Java 24 转正（JEP 453/462/499），Spring Boot 4 把它整合进请求生命周期。

## 1. 先看老问题：为什么 CompletableFuture 不好用

并行调两个服务（如查用户资料 + 查订单列表）的传统写法：

```java
public Dashboard getDashboard(long userId) {
    CompletableFuture<Profile> p = CompletableFuture.supplyAsync(
            () -> profileService.get(userId));
    CompletableFuture<List<Order>> o = CompletableFuture.supplyAsync(
            () -> orderService.getRecent(userId));
    return new Dashboard(p.join(), o.join());   // 都完成再返回
}
```

看似能用，但问题一箩筐：

1. **失败不协同**：p 失败抛异常，o 还在后台跑，没人取消它 → 孤儿任务泄漏线程。
2. **没有层次**：代码看不出"这两个任务属于同一个请求"，故障排查没有边界。
3. **线程失控**：supplyAsync 默认用 ForkJoinPool.commonPool，任务一多就互相排队，
   想换线程池得处处传参，很容易传丢。
4. **超时/取消难**：请求被客户端断开，后台任务照跑不误。

核心痛点一句话：**并发任务没有"容器"，谁生谁管不知道，失败不能传播到调用方。**

## 2. 结构化并发的核心思想

结构化并发的三条规则（借鉴"结构化编程"的思想，把并发也变成有结构的）：

1. **任务有明确的作用域**：子任务在某个 scope 里 fork，scope 关闭 = 子任务必须结束。
2. **任务有明确的层次**：父任务等待子任务，先完成的工作总是先被等待。
3. **要么全成、要么全退**：一个子任务失败，其余自动取消，不留孤儿。

对应到代码：try-with-resources 一个 scope，里面 fork 子任务，
scope 退出时保证所有子任务都结束（正常完成或被取消）。

```
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    // fork 出的子任务"属于"这个 scope
    Future<Profile>   p = scope.fork(() -> profileService.get(userId));
    Future<List<Order>> o = scope.fork(() -> orderService.getRecent(userId));
    scope.join();          // 阻塞等全部子任务完成
    scope.throwIfFailed(); // 任一失败 → 抛出，并取消其余
    return new Dashboard(p.get(), o.get());
}   // ← scope.close() 隐含执行：确保没有泄漏的任务
```

代码直白到像同步——这就是它比 CompletableFuture 强的地方。

## 3. API 家族

| API | 语义 | 适用 |
|-----|------|------|
| StructuredTaskScope（基类） | join 等待全部，自己处理结果/异常 | 需要完全自控 |
| **ShutdownOnFailure** | 任一子任务失败 → 取消其余，join 后 throwIfFailed 抛第一个异常 | 最常用：多路并行都必需成功 |
| **ShutdownOnSuccess** | 第一个成功的结果返回，其余取消 | 竞速场景：查缓存多副本、多数据源取最快 |

```java
// ShutdownOnSuccess：多数据源竞速（例：主备库同时查，谁快用谁）
try (var scope = new StructuredTaskScope.ShutdownOnSuccess<String>()) {
    scope.fork(() -> masterRepo.find(code));
    scope.fork(() -> slaveRepo.find(code));
    scope.join();
    return scope.result();   // 返回第一个成功的
}
```

细节要点（面试能答出来加分）：
- fork 返回 **Future**（java.util.concurrent），可以 join 后 .get() 拿结果。
- 子任务的异常不会自动抛出：join 后调 throwIfFailed()（ShutdownOnFailure）或
  Future.get() 时抛 ExecutionException。
- scope.close() 自动取消仍未完成的任务（对线程发起 interrupt），**绝不泄漏**。
- 子任务里再 fork 子任务形成树状结构，同样受同一 scope 管理（结构化的"层次"）。
- **scope 内应避免无限阻塞**：join 可设超时（join(Duration)），防止整个请求挂死。

## 4. 原理：scope 是怎么"管住"子任务的

内部机制（概念级，够面试）：

```
StructuredTaskScope 底层维护了一个 TreeStructure（任务树）
  │
  ├─ fork(Runnable)：创建子任务（通常是虚拟线程）并加入 scope 的任务集
  │
  ├─ 每个子任务完成/失败时 → 通知 owner（唤醒 join 等待者）
  │
  ├─ ShutdownOnFailure.join()：等待"shutdown 条件"（失败发生或全部完成）
  │     ← 任一失败 → scope 进入 shutdown 状态 → 取消其余子任务（interrupt）
  │
  └─ close()：检查是否还有未完成任务
        ├─ 有 → 先 shutdown（interrupt）再等它们退出
        └─ 无 → 直接通过
```

关键点：
- 子任务默认用**虚拟线程**执行（这是设计本意：虚拟线程廉价，可以肆无忌惮地
  fork 任意多子任务；JDK 的 fork 工厂即虚拟线程）。
- 取消 = interrupt 子任务的线程。虚拟线程对 interrupt 响应很好（阻塞点都可打断），
  所以取消是干净的——不像线程池 kill 不掉。
- **和虚拟线程的关系**：虚拟线程解决"数量"，StructuredTaskScope 解决"生命周期与错误传递"；
  两者结合 = 大规模并行且无泄漏。

## 5. 什么时候用（决策表）

| 场景 | 用不用的判断 |
|------|-------------|
| 一次请求内并行拉多个数据，缺一不可 | ✅ ShutdownOnFailure |
| 多副本/多数据源竞速取最快结果 | ✅ ShutdownOnSuccess |
| 批量 fan-out（给 N 台设备发指令） | ✅ 循环 fork |
| 后台任务完全独立，失败不影响主流程 | ❌ 独立线程/消息队列更合适 |
| 任务需要持久化/重启恢复 | ❌ 结构化并发不解决可靠性，用消息队列 |

注意：StructuredTaskScope 是"进程内"的并发工具，不替代消息中间件。
长期可靠的任务（如 IoT 数据落库确认）仍该走 Kafka + 确认机制。

## 6. 与 CompletableFuture 对比（面试直接背）

| 维度 | CompletableFuture | StructuredTaskScope |
|------|-------------------|---------------------|
| 代码可读性 | 链式回调，越复杂越难看 | 同步式，直观 |
| 失败传播 | 手动 exceptionally/join 检查 | 自动：throwIfFailed + 取消其余 |
| 线程管理 | 匿名线程池，容易泄漏 | scope 管辖，close 必清理 |
| 取消 | 手动 cancel，易漏 | 自动 interrupt |
| 调试 | 栈里看不出任务归属 | 任务树明确父子关系 |
| 首选线程 | ForkJoinPool 公共池 | 虚拟线程（设计本意） |

一句话：**CompletableFuture 是"灵活但散养"，StructuredTaskScope 是"结构化、有边界"。**
两者不冲突，复杂异步流水可以继续用 CompletableFuture；请求级并行聚合优先用结构化并发。

## 7. Spring / Java 落地

```xml
<!-- Java 21 里是预览特性，需要开启（与 Spring 无关，是 javac 层面） -->
<!-- 编译：javac --enable-preview --release 21 ... -->
<!-- 运行：java --enable-preview -jar app.jar -->
<!-- Java 24+ 转正，直接使用 -->
```

Spring Boot 4 的集成（Java 25 Profile）：
- 请求处理与响应式栈可感知结构化并发上下文；
- 框架层面在合适位置创建 scope，你写的 controller 方法里可以直接 fork 并行子任务。
- 实际开发中，即使不用框架封装，自己按第2节的模板写也是推荐姿势。

```java
// 生产可用模板：带超时 + 失败传播
public Dashboard dashboard(long userId) {
    try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
        Future<Profile> p = scope.fork(() -> profileService.get(userId));
        Future<List<Order>> o = scope.fork(() -> orderService.getRecent(userId));
        scope.joinUntil(Instant.now().plusSeconds(2));   // 2 秒超时兜底
        scope.throwIfFailed();
        return new Dashboard(p.get(), o.get());
    }
}
```

## 8. 面试追问链

- Q：structured 并发解决的核心痛点？
  A：并发的"无边界"——任务归属不清、失败不传播、孤儿线程泄漏；
  结构化后 scope 关闭即清理，失败统一传播并取消其余。
- Q：为什么和虚拟线程是绝配？
  A：虚拟线程便宜 → fork 任意多子任务无压力；interrupt 响应好 → 取消干净。
- Q：子任务异常怎么处理？
  A：join 后 throwIfFailed 或 Future.get() 抛 ExecutionException；scope 自动取消其他。
- Q：能替代消息队列吗？
  A：不能，它是进程内并发编排；跨进程的可靠异步仍用 MQ。
- Q：和 ExecutorService 区别？
  A：线程池只负责"执行"，不提供子任务聚合/失败传播/自动取消的结构；scope 是更高层编排。

## 9. 一句话总结

**StructuredTaskScope = 给并发加上"作用域"：子任务在 scope 内出生，scope 关闭时
要么都完成、要么全取消，异常自动传播——配合虚拟线程，写出"像同步代码一样
安全的大规模并行"。**