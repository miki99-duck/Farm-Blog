# 第2章 IoC 容器与 Bean 生命周期

> 面试定位：全文档最核心的一章，命中率五颗星。
> 常考组合拳：① Bean 生命周期钩子顺序 ② 三级缓存为什么是三级
> ③ BeanFactory 和 ApplicationContext 的区别 ④ 构造器循环依赖为什么无解。
> 读完本章你要能做到：现场画出 Bean 从定义到销毁的全流程，讲清每一步谁在干活。

## 2.1 一句话讲清

**IoC 容器 = 一个管理 Bean 的"对象工厂 + 生命周期管家"。你只管声明 Bean 和依赖，
创建、组装、初始化、销毁全交给容器。**

## 2.2 容器是什么：BeanFactory vs ApplicationContext

| | BeanFactory | ApplicationContext |
|---|---|---|
| 定位 | 最底层容器接口 | BeanFactory 的子接口（增强版容器） |
| 单例实例化时机 | getBean 时才创建（懒） | refresh() 启动时预创建单例（饿） |
| 额外能力 | 基本对象管理 | 事件发布、国际化、资源加载、AOP 自动织入、环境抽象（Profile） |
| 面试结论 | 概念基础 | **实际用的都是它**（Spring Boot 启动时创建的就是它） |

关键源码关系：`ApplicationContext extends BeanFactory`，所以它"是一个" BeanFactory，但能力多得多。

追问：为什么 ApplicationContext 要预创建单例？
答：启动时尽早暴露配置/依赖错误（fail-fast），而不是等到第一次 getBean 才炸。

## 2.3 BeanDefinition：Bean 的"户口本"

容器不是靠反射猜 Bean 长什么样，而是先把每个 Bean 描述成一份元数据，这就是 BeanDefinition：

```java
// BeanDefinition 记录的核心字段（概念版）
beanClassName = "com.example.IotPersistenceService"  // 类名
scope = "singleton"          // 作用域
lazyInit = false             // 是否懒加载
initMethodName = "init"      // 自定义初始化方法
destroyMethodName = "destroy"
propertyValues = [...]       // 属性值（<property> / @Value）
autowireMode = AUTOWIRE_NO
```

BeanDefinition 的三大来源（面试常问"@Bean 和 @Component 的区别在哪一层"）：

```
XML <bean>           → XmlBeanDefinitionReader 直接解析成 GenericBeanDefinition
@Component 扫描       → ClassPathBeanDefinitionScanner → ScannedGenericBeanDefinition
@Configuration 类     → ConfigurationClassPostProcessor（BeanFactoryPostProcessor）
                        处理 @Bean 方法 → ConfigurationClassBeanDefinition
@Import / @ImportResource → ImportBeanDefinitionRegistrar 等
```

**关键点：@Component 和 @Bean 殊途同归——最后都变成一份 BeanDefinition 放进容器，
容器只认 BeanDefinition，不关心你用什么方式声明。**

图2 BeanDefinition 解析流程图（PlantUML）：

```
@startuml
start
:启动容器 (refresh);
:扫描/解析配置;
if (来源是?) then (XML)
  :XmlBeanDefinitionReader 解析 <bean>;
elseif (注解扫描) then
  :ClassPathBeanDefinitionScanner 扫描 @Component;
else (@Configuration/@Bean)
  :ConfigurationClassPostProcessor 处理配置类;
endif
:注册为 BeanDefinition -> BeanDefinitionRegistry;
:BeanFactoryPostProcessor 可修改 BeanDefinition;
stop
@enduml
```

## 2.4 getBean 主流程（容器怎么把一个 Bean 造出来）

调用链（记这条主线）：`getBean → doGetBean → createBean → doCreateBean`

```
doGetBean:
  1. getSingleton(beanName)         ← 先查单例缓存（三级缓存，见 2.6）
  2. 缓存没有 → 检查父容器 → 还没有 → 进入创建
  3. 解析依赖：@DependsOn 先创建依赖的 Bean
  4. createBean → doCreateBean:
     a. 实例化前：InstantiationAwareBeanPostProcessor.postProcessBeforeInstantiation
                  （可短路返回代理对象）
     b. 实例化：选择合适的构造器 new 出对象（构造器注入在此完成）
     c. 实例化后：短路检查 + 属性填充 populateBean
                  （@Autowired / @Value 在这里被 AutowiredAnnotationBeanPostProcessor 注入）
     d. Aware 回调：BeanNameAware / BeanClassLoaderAware / BeanFactoryAware
     e. BeanPostProcessor.postProcessBeforeInitialization
     f. 初始化：@PostConstruct → InitializingBean.afterPropertiesSet → init-method
     g. BeanPostProcessor.postProcessAfterInitialization   ← AOP 代理在这里生成！
     h. 注册销毁回调（DisposableBean / destroy-method）
  5. 返回成品，放入一级缓存 singletonObjects
```

图3 getBean 创建时序图（PlantUML）：

```
@startuml
participant Caller
participant AbstractBeanFactory
participant DefaultSingletonBeanRegistry
participant BeanPostProcessor

Caller -> AbstractBeanFactory: getBean(name)
AbstractBeanFactory -> DefaultSingletonBeanRegistry: getSingleton(name)
alt 三级缓存命中
  DefaultSingletonBeanRegistry --> AbstractBeanFactory: 返回对象
else 未命中
  AbstractBeanFactory -> AbstractBeanFactory: createBean(name)
  AbstractBeanFactory -> AbstractBeanFactory: 实例化 + 属性填充
  AbstractBeanFactory -> BeanPostProcessor: postProcessBeforeInitialization
  AbstractBeanFactory -> AbstractBeanFactory: afterPropertiesSet / init-method
  AbstractBeanFactory -> BeanPostProcessor: postProcessAfterInitialization (AOP代理)
  AbstractBeanFactory -> DefaultSingletonBeanRegistry: addSingleton(name, bean)
  AbstractBeanFactory --> Caller: 返回 Bean
end
@enduml
```

追问链（高频）：

- Q：属性填充和 Aware 回调谁先？
  A：先 populateBean 注入依赖，再走 Aware 回调，再初始化。
- Q：AOP 代理在哪一步生成？
  A：AbstractAutoProxyCreator（一个 BeanPostProcessor）的 postProcessAfterInitialization，
  即初始化完成后。这也是三级缓存需要"三级"的原因之一（见 2.6）。
- Q：两个 BeanPostProcessor 和 BeanFactoryPostProcessor 谁先执行？
  A：BeanFactoryPostProcessor 在 BeanDefinition 注册完、实例化任何 Bean 之前执行；
  BeanPostProcessor 在 Bean 实例化过程中生效。前者改"户口本"，后者改"对象本身"。

## 2.5 Bean 生命周期：从生到死的钩子链

图4 Bean 生命周期状态机：

```
┌────────┐   实例化   ┌─────────┐  属性填充  ┌────────┐  Aware  ┌────────┐
│ 定义阶段 │ ────────> │ 实例化完成 │ ────────> │ 半成品  │ ──────> │ 感知回调 │
└────────┘           └─────────┘            └────────┘        └────────┘
                                                                   │
  销毁 <────── @PreDestroy <── destroy-method <── DisposableBean    │
     │ 容器关闭                                                      ▼
     │                                                   初始化阶段（三件套）
     │                                           ┌──────────────────────────┐
     └── 一级缓存 ── 成品 ── postProcessAfter ──│ 1 @PostConstruct          │
        singletonObjects   (AOP代理在此)        │ 2 InitializingBean        │
                                                │ 3 init-method/@Bean(init) │
                                                └──────────────────────────┘
```

**初始化三件套的精确顺序（必考）：**
`@PostConstruct` → `InitializingBean.afterPropertiesSet()` → `init-method`

为什么是这个顺序？因为三者实现机制不同：
- @PostConstruct：由 CommonAnnotationBeanPostProcessor 在 postProcessBeforeInitialization 里反射调用 → 属于"初始化前"
- InitializingBean：容器在 initializeBean 里直接调用 afterPropertiesSet → 属于"初始化中"
- init-method：容器最后反射调用指定方法 → 属于"初始化后"

代码1：三个钩子同台演示输出顺序

```java
@Component
public class LifecycleDemo implements InitializingBean {
    public LifecycleDemo() { System.out.println("1. 构造方法"); }

    @PostConstruct
    public void postConstruct() { System.out.println("2. @PostConstruct"); }

    @Override
    public void afterPropertiesSet() { System.out.println("3. InitializingBean"); }

    @Bean(initMethod = "customInit")  // 或 XML init-method
    public LifecycleDemo demo() { return new LifecycleDemo(); }
    // 注意：@Bean(initMethod) 需要配合配置类写法，此处演示顺序概念
    public void customInit() { System.out.println("4. init-method"); }
}
// 输出：1.构造 → 2.@PostConstruct → 3.InitializingBean → 4.init-method
```

销毁顺序对称：`@PreDestroy` → `DisposableBean.destroy()` → `destroy-method`。

代码2：自定义 BeanFactoryPostProcessor（改"户口本"）

```java
@Component
public class MyBeanFactoryPostProcessor implements BeanFactoryPostProcessor {
    @Override
    public void postProcessBeanFactory(ConfigurableListableBeanFactory factory) {
        // 在所有 Bean 实例化之前执行，可以修改 BeanDefinition
        BeanDefinition bd = factory.getBeanDefinition("iotService");
        bd.setLazyInit(true);   // 把某个 Bean 改成懒加载
        bd.getPropertyValues().add("timeout", 5000);  // 塞一个默认属性
        System.out.println("BeanFactoryPostProcessor 执行，此刻还没有任何 Bean 被实例化");
    }
}
```

面试讲法：BeanFactoryPostProcessor = 改配置/户口本；BeanPostProcessor = 改对象实例。

## 2.6 三级缓存与循环依赖（全文档最重点，必背）

### 什么是循环依赖

A 依赖 B，B 依赖 A。singleton + setter/字段注入时 Spring 能解决；构造器注入无解。

代码3：循环依赖最小复现

```java
@Component
public class A {
    @Autowired private B b;   // setter/字段注入
    public A() { System.out.println("A 构造"); }
}

@Component
public class B {
    @Autowired private A a;
    public B() { System.out.println("B 构造"); }
}
// 上面这样能跑通 —— 靠三级缓存
```

### 三级缓存是什么

三个 Map（都在 DefaultSingletonBeanRegistry 里）：

```java
/** 一级缓存：成品单例（真正可用的 Bean） */
Map<String, Object> singletonObjects;
/** 二级缓存：早期暴露的半成品（已实例化、可能还没属性填充完） */
Map<String, Object> earlySingletonObjects;
/** 三级缓存：ObjectFactory 工厂，真正被依赖引用时才执行 */
Map<String, ObjectFactory<?>> singletonFactories;
```

### 代码4：getSingleton 核心源码摘录（Spring 5.x）

```java
protected Object getSingleton(String beanName, boolean allowEarlyReference) {
    // 1. 先查一级缓存（成品）
    Object singletonObject = this.singletonObjects.get(beanName);
    // 2. 一级没有，且该 Bean 正在创建中（isSingletonCurrentlyInCreation）
    if (singletonObject == null && isSingletonCurrentlyInCreation(beanName)) {
        // 3. 查二级缓存（半成品）
        singletonObject = this.earlySingletonObjects.get(beanName);
        if (singletonObject == null && allowEarlyReference) {
            synchronized (this.singletonObjects) {
                // 4. 二级也没有 → 取三级缓存的 ObjectFactory 并执行
                ObjectFactory<?> singletonFactory = this.singletonFactories.get(beanName);
                if (singletonFactory != null) {
                    // 关键：真正需要引用时才调用工厂，代理在此刻才创建
                    singletonObject = singletonFactory.getObject();
                    // 5. 提升到二级缓存，删除三级
                    this.earlySingletonObjects.put(beanName, singletonObject);
                    this.singletonFactories.remove(beanName);
                }
            }
        }
    }
    return singletonObject;
}
```

### 完整流程（A↔B 循环依赖）

```
1. getBean(A) → 一级/二级/三级都没有 → 创建 A
2. A 实例化完成 → 把"工厂"放入三级缓存
   singletonFactories[A] = () -> getEarlyBeanReference(A)   ← 注意是 lambda，还没执行
3. populateBean(A) 发现需要 B → getBean(B)
4. 创建 B：实例化 → B 也放入三级缓存 → populateBean(B) 发现需要 A
5. getSingleton(A, true)：一级没有，发现 A 正在创建中
   → 三级缓存取出工厂并执行 getEarlyBeanReference(A)
   → 若 A 需要 AOP，此刻生成代理对象；否则返回原始对象
   → 放入二级缓存 earlySingletonObjects，删掉三级缓存
6. B 拿到 A 的引用（可能是代理），继续完成 B 的属性填充和初始化 → B 成品入一级缓存
7. 回到 A：populateBean 拿到 B 完成注入 → A 走初始化 → A 成品入一级缓存
8. 注意：A 的代理在步骤5已经生成，最终 addSingleton 时不会重复代理
   （SmartInstantiationAwareBeanPostProcessor 保证 early 引用与 final 对象一致）
```

图5 三级缓存循环依赖流程图（PlantUML）：

```
@startuml
start
:getBean(A);
:实例化 A;
:singletonFactories.put(A, ObjectFactory);
:populateBean(A) 需要 B;
:getBean(B);
:实例化 B;
:singletonFactories.put(B, ObjectFactory);
:populateBean(B) 需要 A;
:getSingleton(A) 三级缓存命中;
:执行 ObjectFactory -> getEarlyBeanReference(A)\n(需要AOP则此时生成代理);
:earlySingletonObjects.put(A);
:B 注入 A 成功, B 完成初始化;
:addSingleton(B);
:回到 A, 注入 B, A 完成初始化;
:addSingleton(A);
stop
@enduml
```

### 为什么是三级，不是两级？—— 必考送命题

反证：如果只有两级缓存（直接存对象，没有 ObjectFactory）会怎样？

问题出在 **AOP 代理的创建时机**。代理是在 postProcessAfterInitialization（初始化完成后）才生成的。
如果只有两级缓存，把"早期引用"直接放进缓存，那么循环依赖时 B 拿到的就是**未代理的原始 A**，
而最终 A 初始化完成后会被代理覆盖，导致 **B 持有的 A 和容器最终的单例 A 不是同一个对象**（单例不一致）。

三级缓存存的是 ObjectFactory（lambda），它把 **getEarlyBeanReference** 推迟到"真正被引用"的那一刻才执行：
- 被引用了 → 此刻调用 getEarlyBeanReference 判断是否要提前生成代理，保证引用方拿到代理对象
- 没被引用 → 工厂永远不执行，A 照常在初始化完成后正常代理，无任何开销

一句话答案：**三级缓存解决的是"循环依赖 + AOP 提前代理"的组合问题，保证所有引用方拿到同一个（代理）对象；两级缓存做不到这一点。**

### 哪些循环依赖解不了（必考）

| 场景 | 能否解决 | 原因 |
|------|---------|------|
| singleton + setter/字段注入 | ✅ | 实例化后可先入缓存，再补依赖 |
| singleton + 构造器注入 | ❌ | 实例化时就要构造参数，对象还没入缓存 |
| prototype | ❌ | 不缓存、不预创建，无"早期引用"机制 |
| @Async / 高级代理 | 部分❌ | 提前代理与最终代理机制冲突，常报"BeanCurrentlyInCreationException" |
| 通过 @Lazy 注入 | ✅ | 注入一个代理占位，真正调用时才创建（治标，重构更优） |

代码5：@Lazy 打破循环依赖（治标方案）

```java
@Component
public class A {
    // 注入的是 Lazy 代理，A 创建时不真正触发 B
    @Autowired @Lazy
    private B b;
}
```

代码6：验证 prototype 每次都是新对象

```java
@Scope("prototype")
@Component
public class PrototypeBean { }

// 使用处
PrototypeBean p1 = ctx.getBean(PrototypeBean.class);
PrototypeBean p2 = ctx.getBean(PrototypeBean.class);
System.out.println(p1 == p2);  // false：每次 getBean 都新建
```

注意：prototype 对象容器只负责创建，**不负责销毁**（不会调 destroy 回调，需自己管理）。

## 2.7 结合简历项目（华润 IoT 平台）

- 项目里的 Mapper 代理对象（MyBatis 的 MapperFactoryBean）就是通过 BeanDefinition 注册进容器的，
  面试可讲：MyBatis 的 @MapperScan 本质是 ImportBeanDefinitionRegistrar，把每个 Mapper 注册为 FactoryBean。
- Kafka 消费者 Bean 用 @Component 注册，默认 singleton 常驻，靠容器统一管理生命周期；
  如果项目里手动 new 过任何组件，就是 IoC 的反例，可以主动承认并说明应该交给容器。
- 多数据源时，DataSource 用 @Bean 显式声明（BeanDefinition 来源是 @Configuration 分支），
  两个 DataSource 之间没有循环依赖，但事务管理器依赖 DataSource —— 这是正常的构造器依赖链。

## 本章小结

- BeanFactory 是最底层容器，ApplicationContext 是增强版，实际用的都是后者。
- 所有 Bean 先变成 BeanDefinition（户口本），再按 getBean 流程实例化。
- 初始化顺序：@PostConstruct → InitializingBean → init-method。
- 三级缓存 = singletonObjects / earlySingletonObjects / singletonFactories，
  核心是 ObjectFactory 延迟到"被引用时"才生成（代理）对象。
- 循环依赖只有 singleton + setter/字段注入能解；构造器、prototype 无解。

下一篇：第3章 DI 依赖注入（@Autowired 是怎么工作的）。
