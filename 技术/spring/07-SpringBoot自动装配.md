---
title: "第7章 Spring Boot 自动装配"
tags: [Spring]
---

# 第7章 Spring Boot 自动装配

> 面试定位：中高频。必考三连：
> ① @SpringBootApplication 是什么 ② 自动装配怎么读配置 ③ 条件注解怎么用/怎么覆盖。
> 学完你能手写一个 Starter，这是简历加分硬技能。

## 7.1 一句话讲清

**自动装配 = Spring Boot 启动时，扫描 classpath 下所有 Starter 的配置文件，
按条件注解（比如"类路径上有 Redis 的类才装配 Redis"）把该有的 Bean 批量注册进容器。
你不用写一行配置，框架自己判断"当前环境需要什么就装什么"。**

## 7.2 @SpringBootApplication = 三合一

```java
@SpringBootApplication
public class FarmBlogApplication { ... }
```

等价于（概念）：

```java
@SpringBootConfiguration      // = @Configuration，声明这是一个配置类（容器入口）
@EnableAutoConfiguration      // ★ 打开自动装配总开关
@ComponentScan                // 扫描当前包及子包的 @Component/@Service/@Controller...
public class FarmBlogApplication { ... }
```

面试讲法：**主类本身是个配置类（会被 ConfigurationClassPostProcessor 处理），
@ComponentScan 负责扫自己项目的 Bean，@EnableAutoConfiguration 负责捞三方 Starter 的 Bean。**

## 7.3 自动装配原理：一条链路

```
@EnableAutoConfiguration
  → @Import(AutoConfigurationImportSelector.class)
  → AutoConfigurationImportSelector.selectImports()
  → 读取 META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
     （Spring Boot 2.7+；老版本是 spring.factories 里的 EnableAutoConfiguration 键）
  → 得到候选自动配置类全名单（几百个）
  → 逐个应用条件注解筛选
  → 剩下的自动配置类作为 @Configuration 注册进容器，Bean 被创建
```

图11 自动装配流程图：

```
@SpringBootApplication
      │
      ▼
@EnableAutoConfiguration ──► AutoConfigurationImportSelector
      │                           │
      ▼                           ▼
   读取 AutoConfiguration.imports 文件（第三方 Starter 提供的清单）
      │
      ▼
   候选配置类 200+ 个
      │
      ▼  @ConditionalOnXxx 逐个筛选（看 classpath、看有没有已有 Bean、看配置项）
   真正生效的配置类（如 RedisAutoConfiguration）
      │
      ▼
   按 @Bean 注册 RedisConnectionFactory、RedisTemplate 等到容器
      │
      ▼
   你的 @Autowired RedisTemplate 直接可用 —— 一行配置都没写
```

## 7.4 条件注解（自动装配的"过滤器"）

| 注解 | 生效条件 |
|------|---------|
| @ConditionalOnClass | classpath 存在指定类（最常见） |
| @ConditionalOnMissingBean | 容器里没有指定 Bean（用户自定义了就用用户的） |
| @ConditionalOnProperty | 配置文件里有指定项（如 spring.redis.enabled=true） |
| @ConditionalOnBean | 容器里有指定 Bean |
| @ConditionalOnWebApplication | 是 Web 应用 |

面试讲法：**条件注解让"自动配置"变成"按需配置"——配置类清单是固定的，但每个配置类是否生效由运行时环境决定。**

代码1：手写 Starter 最小实现（三步）

```java
// ① 配置类：定义要给使用方提供的 Bean
@Configuration
@ConditionalOnClass(name = "com.example.IotCollector")   // 使用方引入了才生效
@ConditionalOnProperty(prefix = "iot.starter", name = "enabled", havingValue = "true", matchIfMissing = true)
public class IotStarterAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean     // 使用方自己定义了就用使用方的
    public IotCollector iotCollector() {
        return new IotCollector();
    }
}
```

```properties
# ② 注册自动配置类：src/main/resources/META-INF/spring/
# org.springframework.boot.autoconfigure.AutoConfiguration.imports 文件内容：
com.example.IotStarterAutoConfiguration
```

```xml
<!-- ③ 打包成 starter 供其他项目引用（引入后自动装配生效） -->
<dependency>
    <groupId>com.example</groupId>
    <artifactId>iot-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

这就是你项目里 redis-spring-boot-starter、mybatis-spring-boot-starter 的工作方式——
**每个 starter 只是一个普通 jar + 一个 imports 清单 + 一堆条件注解**。

## 7.5 怎么覆盖自动配置（必考）

| 方式 | 说明 |
|------|------|
| 自己定义同类型 @Bean | 依赖 @ConditionalOnMissingBean 让位（最常见） |
| 配置文件排除 | spring.autoconfigure.exclude=xxxAutoConfiguration |
| 主类 exclude 属性 | @SpringBootApplication(exclude = RedisAutoConfiguration.class) |
| 改配置项 | 条件注解不满足，如 spring.autoconfigure.exclude / 开关项 |

代码2：自定义覆盖示例（项目里改 RedisTemplate 序列化器就是这个套路）

```java
@Configuration
public class RedisConfig {
    @Bean
    @ConditionalOnMissingBean(name = "redisTemplate")
    public RedisTemplate<String, Object> redisTemplate(
            RedisConnectionFactory factory) {
        RedisTemplate<String, Object> t = new RedisTemplate<>();
        t.setConnectionFactory(factory);
        t.setKeySerializer(new StringRedisSerializer());
        t.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        return t;
    }
}
// 自动配置看到容器已有 redisTemplate → @ConditionalOnMissingBean 不满足 → 用你的
```

追问链：
- Q：自动配置类和普通 @Configuration 类冲突吗？
  A：不冲突。自动配置类也是 @Configuration，只是多了条件注解；
  一般放在 imports 清单里延迟到用户配置处理完之后再处理（AutoConfigurationSorter），
  保证"用户的 Bean 优先"。
- Q：@EnableXxx 注解（如 @EnableScheduling）是什么套路？
  A：本质都是 @Import 导入一个配置类或 Registrar，和自动装配同一套机制。
- Q：为什么启动慢？
  A：自动装配要读清单、跑几百个条件注解，可关闭不用的自动配置或排除。

## 7.6 结合简历项目（华润 IoT 平台）

- 你的 RuoYi 项目几乎全是自动装配的受益者：Redis、MyBatis、Kafka、数据源
  都是 starter 拉起来的；改 RedisTemplate 序列化 = 覆盖自动配置（7.5 代码2 的套路）。
- 面试实战讲法："项目里我想让 Redis 存 JSON 而不是 JDK 序列化，
  就自己写了个 @Configuration 定义 RedisTemplate Bean，利用 @ConditionalOnMissingBean
  覆盖了自动配置的默认 Bean。"——一句顶十句，证明你真用过。
- 多数据源场景：MyBatis 的自动配置默认只认一个 DataSource，多数据源时
  需要手动 @MapperScan 指定 SqlSessionFactory —— 这也是"自动配置不够用就自己接管"的例子。

## 本章小结

- @SpringBootApplication = @SpringBootConfiguration + @EnableAutoConfiguration + @ComponentScan。
- 自动装配：@Import(AutoConfigurationImportSelector) → 读 imports 清单 → 条件注解筛选 → 注册 Bean。
- 条件注解是灵魂：@ConditionalOnClass / @ConditionalOnMissingBean 最重要。
- 覆盖默认配置：自定义同类型 @Bean / exclude / 配置项。
- 手写 Starter = 配置类 + 条件注解 + imports 清单，三样东西。

下一篇：第8章 高频面试题速查表（考前 30 分钟只刷这一章）。
