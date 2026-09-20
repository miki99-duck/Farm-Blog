---
title: "第6章 Spring 启动流程 refresh()"
tags: [Spring]
---

# 第6章 Spring 启动流程 refresh()

> 面试定位：中高频。考法是"12 步记不全没关系，但要知道哪几步是重点、扩展点挂在哪个阶段"。
> 一句话：Spring 启动 = 调用 AbstractApplicationContext.refresh()，把"空容器"变成"可用容器"。

## 6.1 一句话讲清

**Spring 容器启动的核心就是 refresh() 这一个方法：先准备 BeanFactory、
把配置变成 BeanDefinition、注册各种后处理器、实例化所有单例，最后发布"容器就绪"事件。**

## 6.2 refresh() 12 步拆解

图10 refresh() 12 步时序图：

```
refresh()（AbstractApplicationContext）
  │
  1 prepareRefresh()            准备：设置启动时间、活跃标记、初始化属性源
  2 obtainFreshBeanFactory()    创建/刷新 BeanFactory（XML 在此解析 BeanDefinition）
  3 prepareBeanFactory()        配置标准特性：ClassLoader、SpEL、Environment、SystemProperties
  4 postProcessBeanFactory()    子类扩展点（Web 场景注册 ServletContext）
  5 invokeBeanFactoryPostProcessors()   ★执行 BeanFactoryPostProcessor
                                      （ConfigurationClassPostProcessor 在此处理
                                       @Configuration/@ComponentScan/@Bean → 生成 BeanDefinition）
  6 registerBeanPostProcessors() ★注册 BeanPostProcessor（只注册，不执行）
  7 initMessageSource()          国际化资源
  8 initApplicationEventMulticaster() 初始化事件广播器
  9 onRefresh()                  子类扩展点（Spring Boot 在此创建内嵌 Tomcat）
  10 registerListeners()         注册事件监听器
  11 finishBeanFactoryInstantiation() ★实例化所有非懒加载单例 Bean（getBean 大戏在此上演）
  12 finishRefresh()             完成：发布 ContextRefreshedEvent，容器可用
```

记忆口诀：**"准、造、配、扩、后、注、消、播、扩、听、例、完"**——
重点是 5（BeanFactoryPostProcessor 执行）、6（BeanPostProcessor 注册）、11（单例实例化）。

追问链（高频）：

- Q：BeanPostProcessor 和 BeanFactoryPostProcessor 的执行顺序？
  A：BeanFactoryPostProcessor 在步骤5执行（Bean 实例化前，改 BeanDefinition）；
  BeanPostProcessor 在步骤6注册、在步骤11 实例化每个 Bean 时逐个执行（改对象）。
  **先改"户口本"，再造"人"。**
- Q：@Configuration 类是什么时候处理的？
  A：步骤5，ConfigurationClassPostProcessor（一个 BeanFactoryPostProcessor）
  解析 @ComponentScan/@Import/@Bean，生成大量 BeanDefinition。也就是说，
  **注解驱动的 Bean 是在 refresh 的步骤5 才"登记"进容器的**。
- Q：单例 Bean 是启动时就创建吗？
  A：是，非懒加载单例在步骤11 统一实例化（所以启动慢/启动报错大多是这里炸的）。
  @Lazy 的 Bean 留到第一次 getBean。
- Q：@ComponentScan 和 <context:component-scan> 有什么区别？
  A：没有本质区别，都是注册 ConfigurationClassPostProcessor 触发的扫描，
  注解版是 @ComponentScan 注解让同一个后处理器干活。

## 6.3 两个后处理器的注册时机对照（面试最爱问）

代码1：验证执行时机

```java
@Component
public class OrderLogger implements BeanFactoryPostProcessor, BeanPostProcessor, InitializingBean {

    // BeanFactoryPostProcessor：步骤5，此时 BeanDefinition 都在，Bean 都还没创建
    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory factory) {
        System.out.println("[BFPP] Bean 数量=" + factory.getBeanDefinitionCount()
                + "，还没有任何 Bean 实例");
    }

    // BeanPostProcessor：步骤11，每个 Bean 初始化前后各调一次
    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) {
        if (beanName.startsWith("iot")) {
            System.out.println("[BPP before] " + beanName);
        }
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) {
        if (beanName.startsWith("iot")) {
            System.out.println("[BPP after] " + beanName);
        }
        return bean;
    }

    @Override
    public void afterPropertiesSet() {
        System.out.println("[自身初始化] 上面那个 BFPP 打印完、所有 BPP 注册完后，我才初始化");
    }
}
// 输出顺序：BFPP 先打 → 各 Bean 的 BPP before/after → ... → 自己初始化
```

## 6.4 Spring Boot 与 refresh() 的关系

- Spring Boot 启动 = new SpringApplication(...).run() → 内部创建 ApplicationContext
  （ServletWebServerApplicationContext）→ 调用 refresh()。
- 内嵌 Tomcat 在步骤9 onRefresh() 创建并启动，ContextRefreshedEvent（步骤12）之后
  SpringApplication 再执行 CommandLineRunner / ApplicationRunner。
- 所以你的 RuoYi 项目里实现 ApplicationRunner 做"启动后初始化"（如预热缓存），
  就是在 refresh 完成之后干活。

追问：ApplicationRunner 和 CommandLineRunner 区别？
答：参数类型不同（ApplicationArguments vs String[]），执行时机相同（refresh 后）。RuoYi 里常用它们加载数据字典缓存。

## 6.5 结合简历项目（华润 IoT 平台）

- 项目里如果自定义过 BeanFactoryPostProcessor/BeanPostProcessor（或看过 RuoYi 的
  @Configuration 配置类），可以讲：RuoYi 的 SecurityConfig、RedisConfig 都是 @Configuration 类，
  它们的 Bean 就是在 refresh 步骤5 被登记、步骤11 被实例化的。
- 讲"启动慢怎么办"时可以提到：步骤11 实例化大量单例（如线程池、连接池、KafkaTemplate），
  @Lazy 或懒加载可以推迟，但代价是第一次调用变慢，面试可聊取舍。
- 多数据源配置类里两个 DataSource 的 @Bean 方法，也是步骤5 生成的 BeanDefinition，
  步骤11 实例化 —— 这正好呼应第3章 @Primary/@Qualifier 的歧义裁决。

## 本章小结

- 启动 = refresh()：核心记住步骤 5/6/11（BFPP 执行、BPP 注册、单例实例化）。
- BeanFactoryPostProcessor 改 BeanDefinition（先），BeanPostProcessor 改对象（后）。
- @Configuration/@ComponentScan 由 ConfigurationClassPostProcessor 在步骤5 处理。
- Boot 的内嵌容器、ApplicationRunner 都发生在 refresh 前后。

下一篇：第7章 Spring Boot 自动装配（为什么一个注解就能把整个框架拉起来）。
