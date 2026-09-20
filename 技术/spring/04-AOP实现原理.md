---
title: "第4章 AOP 实现原理"
tags: [Spring]
---

# 第4章 AOP 实现原理

> 面试定位：重灾区，命中率五颗星。必考三连：
> ① JDK 代理 vs CGLIB 区别 ② 自调用为什么失效、怎么解决 ③ 代理在哪一步创建。
> 事务 @Transactional 就是基于 AOP 的，和下一章连着考。

## 4.1 一句话讲清

**Spring AOP = 动态代理 + 切面模型。容器在 Bean 初始化完成后（postProcessAfterInitialization），
发现这个 Bean 匹配某个切面，就生成一个代理对象替换原对象；调用代理方法时，
代理先执行切面逻辑，再调目标方法。业务代码全程无感知。**

## 4.2 动态代理：JDK Proxy vs CGLIB

图7 JDK vs CGLIB 对比图：

```
                生成代理的两种方式
┌──────────────────────────────┬──────────────────────────────┐
│  JDK 动态代理 (java.lang.reflect.Proxy)  │  CGLIB (字节码生成子类)          │
├──────────────────────────────┼──────────────────────────────┤
│ 原理：实现目标类的接口         │ 原理：继承目标类，生成子类       │
│ 生成：Proxy.newProxyInstance │ 生成：Enhancer.create          │
│ 前提：目标类必须有接口         │ 前提：目标类不能被 final        │
│ 只能代理接口里声明的方法       │ 可代理非 final 的所有方法        │
│ 性能：早期略慢，JDK8+ 已优化    │ 创建代理略慢，调用性能好         │
│ 典型：Spring 默认策略之一      │ 典型：Spring Boot 默认策略      │
└──────────────────────────────┴──────────────────────────────┘
```

面试关键点：
- **选型规则**：类实现了接口 → 默认 JDK 代理；没有接口 → CGLIB。
  Spring Boot 2.x 起默认 proxy-target-class=true，**统一走 CGLIB**（包括有接口的类），
  因为 CGLIB 能代理接口/类全部方法，行为更一致。
- CGLIB 的限制：final 类、final 方法无法被继承/重写，所以代理不生效。
- 两个代理的共同点：都要求目标方法**能被覆盖**（接口方法或非 final 实例方法），
  这就是"Spring AOP 不能拦截 private/static/final 方法"的根本原因。

代码1：手写 JDK 代理 10 行，看懂原理

```java
public class JdkProxyDemo {
    interface Task { void run(); }

    static class RealTask implements Task {
        public void run() { System.out.println("执行任务"); }
    }

    public static void main(String[] args) {
        Task proxy = (Task) Proxy.newProxyInstance(
                Task.class.getClassLoader(),
                new Class[]{Task.class},
                (p, method, a) -> {
                    System.out.println("[切面] before");
                    Object r = method.invoke(new RealTask(), a);
                    System.out.println("[切面] after");
                    return r;
                });
        proxy.run();
        // 输出：[切面] before → 执行任务 → [切面] after
    }
}
```

这段代码就是 Spring AOP 的最小模型：InvocationHandler = 通知逻辑 + 目标方法调用。

## 4.3 Spring AOP 概念模型：Pointcut / Advice / Advisor

```
Advisor（切面） = Pointcut（切点：在哪切） + Advice（通知：切什么逻辑）
```

- Pointcut：方法匹配规则（如 execution(* com.example.service.*.*(..))）
- Advice：逻辑本身，分 @Before / @AfterReturning / @AfterThrowing / @After / @Around
- Advisor：把两者打包，Spring 容器只认 Advisor；@Aspect 类最终会被转换成 Advisor

代码2：@Aspect 通知类型与执行顺序

```java
@Aspect
@Component
public class LogAspect {
    @Pointcut("execution(* com.example.service.*.*(..))")
    public void svcPointcut() {}

    @Before("svcPointcut()")
    public void before() { System.out.println("1. @Before"); }

    @Around("svcPointcut()")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        System.out.println("2. @Around before");
        Object r = pjp.proceed();        // 放行，调用目标方法
        System.out.println("4. @Around after");
        return r;
    }

    @After("svcPointcut()")
    public void after() { System.out.println("3. @After（无论成败都会执行）"); }

    @AfterReturning("svcPointcut()")
    public void afterReturning() { System.out.println("5. @AfterReturning（成功才执行）"); }

    @AfterThrowing("svcPointcut()")
    public void afterThrowing() { System.out.println("5'. @AfterThrowing（异常才执行）"); }
}
// 正常路径输出顺序：@Around before → @Before → 目标方法 → @After → @Around after → @AfterReturning
```

面试必背：@Around 先于 @Before 进入（Around 包裹一切），
@After 类似 finally 一定执行，@AfterReturning 只在成功时执行，@AfterThrowing 只在异常时执行。
多个切面时按 @Order(数字) 排序，数字小的先执行。

## 4.4 代理创建流程：谁在什么时候创建代理

链路：Bean 初始化完成 → AbstractAutoProxyCreator（BeanPostProcessor）→ postProcessAfterInitialization
→ wrapIfNecessary → getAdvicesAndAdvisorsForBean（切面是否匹配该 Bean）
→ 匹配 → createProxy（JDK/CGLIB）→ 返回代理替换原 Bean。

图8 AOP 代理创建时序图（PlantUML）：

```
@startuml
participant 容器
participant AbstractAutoProxyCreator
participant Advisor 注册表
participant ProxyFactory

容器 -> 容器: Bean 初始化完成
容器 -> AbstractAutoProxyCreator: postProcessAfterInitialization(bean)
AbstractAutoProxyCreator -> AbstractAutoProxyCreator: wrapIfNecessary(bean)
AbstractAutoProxyCreator -> Advisor 注册表: 查找所有 Advisor
AbstractAutoProxyCreator -> AbstractAutoProxyCreator: 匹配 Pointcut 是否命中该 Bean 的方法
alt 命中
  AbstractAutoProxyCreator -> ProxyFactory: createProxy(bean)
  ProxyFactory --> AbstractAutoProxyCreator: 代理对象
  AbstractAutoProxyCreator --> 容器: 返回代理，替换原 Bean
else 未命中
  AbstractAutoProxyCreator --> 容器: 返回原 Bean
end
@enduml
```

追问：代理对象和原对象是同一个吗？
答：不是。容器里存的是代理对象；@Autowired 注入的也是代理（除非用 @Lazy/原始对象）。
所以 `target == proxy` 为 false，这也是自调用失效的根源。

## 4.5 自调用失效：最经典的坑（必考）

问题：同一个类里 `this.method()` 调用自己带切面的方法，**不走代理**。

```java
@Service
public class PayService {
    @Transactional
    public void pay() { ... }            // 事务切面生效

    public void batch() {
        pay();                            // ❌ this.pay() 直接调目标方法，切面不生效！
    }
}
```

为什么：batch() 里的 this 是**目标对象本身**，不是容器里的代理对象。
代理只在"外部调用（经过容器注入的代理）"时介入，内部 this 调用绕过了代理。

代码3：三种解决办法

```java
// 方案1：注入自身（拿代理对象）—— 最简单，推荐
@Service
public class PayService {
    @Autowired
    private PayService self;   // 注意注入的是代理

    public void batch() {
        self.pay();            // ✅ 走代理，事务生效
    }
}

// 方案2：AopContext 显式取当前代理（需 exposeProxy=true）
@Service
public class PayService2 {
    public void batch() {
        ((PayService2) AopContext.currentProxy()).pay();  // ✅
    }
}
// 配置：@EnableAspectJAutoProxy(exposeProxy = true)

// 方案3：把切面方法挪到另一个 Bean（最干净，结构上根治）
@Service
public class PayBatchService {
    private final PayService payService;   // 注入的是代理
    public void batch() { payService.pay(); }   // ✅ 跨 Bean 调用天然走代理
}
```

追问链：
- Q：为什么 self 注入自己不会死循环？→ 注入的是代理对象（一级缓存里的成品），不是重新创建。
- Q：private 方法能加 @Transactional 吗？→ 加了也不生效：private 无法被代理子类/接口覆盖，且事务切面根本匹配不到。
- Q：final 类为什么不能 CGLIB？→ CGLIB 靠继承生成子类，final 类禁止继承。
- Q：@Async 同类调用失效也是同一原因？→ 对，@Async 也基于代理，this 调用同样失效。

## 4.6 结合简历项目（华润 IoT 平台）

- 你的项目里 @Transactional 就是 AOP 的实际应用（TransactionInterceptor 是 Advice）。
  Kafka 消费方法上如果加了 @Transactional 又内部自调用，就会踩 4.5 的坑。
- RuoYi 的 @Log 注解就是自定义切面：先定义注解作为 Pointcut 标记，再用环绕通知记录操作日志。
  面试讲"我在项目里写过切面"就用它：登录日志、操作日志、异常日志都可以挂一个切面。
- MyBatis 的 Mapper 对象本身也是动态代理（JDK 代理），和 AOP 代理是两套机制，别混为一谈。

## 本章小结

- AOP 原理 = 动态代理（JDK/CGLIB）+ Advisor 模型，代理在 postProcessAfterInitialization 生成。
- JDK 代理要接口，CGLIB 是继承子类，Boot 默认全 CGLIB。
- 自调用 this 不走代理 → 失效；解决：注入自身 / AopContext / 拆 Bean。
- 通知顺序：@Around 包裹 @Before → 目标方法 → @After → @Around after → @AfterReturning/@AfterThrowing。

下一篇：第5章 事务管理（@Transactional 失效场景大全，面试性价比之王）。
