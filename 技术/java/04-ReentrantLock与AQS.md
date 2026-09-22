---
title: "第4章 ReentrantLock 与 AQS"
tags: [Java]
---

# 第4章 ReentrantLock 与 AQS

> 一句话讲清：**ReentrantLock 是 JDK 层面实现的互斥锁，底层依赖 AQS（AbstractQueuedSynchronizer）——
> AQS 用一个 int state 记录锁状态，用 CLH 变体队列排队等待的线程。理解 AQS = 理解整个 JUC 同步框架。**
> 本章目标：能用 tryLock / 公平锁 / Condition，能画出 AQS 的 state + 队列结构，能讲清锁在底层怎么传递。

## 4.1 ReentrantLock 基本用法（★ 必会）

```java
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class ReentrantLockDemo {
    private final Lock lock = new ReentrantLock();   // 默认非公平
    private int count = 0;

    public void increment() {
        lock.lock();                                  // 加锁（阻塞直到拿到）
        try {
            count++;
        } finally {
            lock.unlock();                            // ⚠ 必须解锁，try-finally 是铁律
        }
    }
}
```

**与 synchronized 的关键区别：必须手动 unlock，否则永久死锁。**

### 三个核心方法

```java
Lock lock = new ReentrantLock();

// 1. lock()：阻塞直到拿到（不可中断、不可超时）
lock.lock();

// 2. tryLock()：尝试拿，拿不到立刻返回 false（不阻塞）
if (lock.tryLock()) {
    try { /* 业务 */ }
    finally { lock.unlock(); }
} else {
    // 拿不到怎么办：放弃 / 重试 / 走别的逻辑
}

// 3. tryLock(timeout)：等指定时间，超时返回 false（破死锁神器）
if (lock.tryLock(1, TimeUnit.SECONDS)) {
    try { /* 业务 */ }
    finally { lock.unlock(); }
}

// 4. lockInterruptibly()：可被 interrupt 打断
try {
    lock.lockInterruptibly();
    try { /* 业务 */ }
    finally { lock.unlock(); }
} catch (InterruptedException e) {
    // 被中断了，可以优雅退出
    Thread.currentThread().interrupt();
}
```

**追问：tryLock 和 lock 怎么选？**
答："需要'抢不到就放弃'用 tryLock（比如限流、避免死锁）；
需要'必须执行'用 lock。
**核心场景**：tryLock 是打破死锁的关键工具——拿不到就不等了，避免循环等待。"

## 4.2 公平锁 vs 非公平锁（★ 面试必考）

```java
new ReentrantLock();              // 默认非公平（false）
new ReentrantLock(true);          // 公平锁
```

| 维度 | 公平锁 | 非公平锁 |
|------|--------|---------|
| 获取方式 | 按 FIFO 排队 | 来了先插队 CAS，失败了再排 |
| 性能 | 较低 | **更高（默认）** |
| 适用 | 要求公平的场景 | 大多数场景 |

**为什么非公平锁性能更高（面试必答）？**
答："公平锁每次都要检查队列，开销大；非公平锁直接 CAS 抢，失败了才排队——
线程不用频繁挂起/唤醒，吞吐量更高。代价是**可能出现饥饿**（某个线程一直抢不到）。"

```java
// ReentrantLock 源码（非公平 vs 公平的核心）
// 非公平锁 tryAcquire:
//   int c = getState();
//   if (c == 0 && compareAndSetState(0, 1)) {   // ★ 直接抢，不检查队列
//       setExclusiveOwnerThread(current);
//       return true;
//   }
// 公平锁 tryAcquire:
//   if (c == 0 && !hasQueuedPredecessors() && ...)   // ★ 多了"检查有没有前驱"

// 公平 = 每次抢锁前先看队列头有没有人，有就不抢
```

**追问：什么是饥饿？**
答："某个线程长时间拿不到锁，因为其他线程一直在它前面（非公平）或者
队列里的前驱一直持有（公平）。**公平锁不保证不饿**——只是排队顺序公平。"

## 4.3 Condition：精细的多条件等待（★ 加分项）

**`synchronized` 只有 `wait()/notify()` 一套，`ReentrantLock` 支持多个 Condition。**

```java
// 经典场景：生产者-消费者
class BoundedBuffer {
    private final Object[] buffer = new Object[100];
    private int count = 0, put = 0, take = 0;
    private final ReentrantLock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();   // 缓冲区不满
    private final Condition notEmpty = lock.newCondition();  // 缓冲区不空

    // 生产者：缓冲区满了就等 notFull
    public void put(Object o) throws InterruptedException {
        lock.lock();
        try {
            while (count == buffer.length) notFull.await();   // 满了 → 等 notFull
            buffer[put] = o;
            count++;
            put = (put + 1) % buffer.length;
            notEmpty.signal();   // 唤醒消费者
        } finally { lock.unlock(); }
    }

    // 消费者：缓冲区空了就等 notEmpty
    public Object take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0) notEmpty.await();   // 空了 → 等 notEmpty
            Object o = buffer[take];
            count--;
            take = (take + 1) % buffer.length;
            notFull.signal();   // 唤醒生产者
            return o;
        } finally { lock.unlock(); }
    }
}
```

**Condition 的三个核心方法：**

| 方法 | 对应 | 作用 |
|------|------|------|
| `await()` | `wait()` | 释放锁并进入等待队列（CONDITION_QUEUE） |
| `signal()` | `notify()` | 唤醒等待队列中的一个线程 |
| `signalAll()` | `notifyAll()` | 唤醒全部 |

**追问：synchronized 的 wait/notify 和 Condition 的 await/signal 区别？**
答："功能一样，但 Condition 支持'多条件'——
比如上面例子，生产者只在缓冲区满时等 notFull，消费者只在空时等 notEmpty，
不会'误唤醒'（synchronized 的 notify 只能唤醒等这个 monitor 的任意线程）。"

### Condition 的"虚假唤醒"

**和 wait 一样，await 必须写在 while 循环里：**

```java
while (!condition) cond.await();   // ✅ 正确：每次唤醒都重新检查条件
// if (!condition) cond.await();   // ❌ 错误：被唤醒后条件可能又变回 false
```

## 4.4 AQS（AbstractQueuedSynchronizer）：JUC 的基石（★ 面试核心）

**AQS 是 JDK 5 引入的同步框架基类，几乎所有并发工具都基于它实现：
ReentrantLock、Semaphore、CountDownLatch、ReentrantReadWriteLock、ThreadPoolExecutor.Worker……**

### AQS 的核心结构（★ 必画）

```
┌────────────────────────────────────────────────────────┐
│  AQS 内部结构                                             │
│                                                         │
│  ┌─────────────────────────────────────┐               │
│  │  volatile int state                  │  ← 锁状态     │
│  │  - ReentrantLock: 重入次数           │               │
│  │  - Semaphore: 可用许可数             │               │
│  │  - CountDownLatch: 倒计时数           │               │
│  │  - ReadWriteLock: 读写锁状态         │               │
│  └─────────────────────────────────────┘               │
│                                                         │
│  ┌─────────────────────────────────────┐               │
│  │  CLH 变体队列（双向链表）              │               │
│  │  head ⇄ Node ⇄ Node ⇄ ... ⇄ tail    │               │
│  │       ↑                              │               │
│  │       等待锁的线程                     │               │
│  └─────────────────────────────────────┘               │
└────────────────────────────────────────────────────────┘
```

### 关键节点：CLH 队列的 Node

```java
// AQS 内部抽象：CLH 队列节点
class Node {
    Thread thread;          // 该节点对应的线程
    int waitStatus;         // 等待状态（SIGNAL=-1、CANCELLED=1、CONDITION=1、PROPAGATE=-3）
    Node prev, next;        // 双向链表
}
```

**两种队列：**
- **同步队列**（AQS 的 CLH 队列）：等锁的线程在这里排队
- **条件队列**（Condition）：await() 的线程在这里排队，
  signal() 时挪到同步队列头部

### AQS 的核心 API（★ 背下来）

```java
// 子类必须实现：
protected boolean tryAcquire(int arg);   // 加锁逻辑（非公平/公平版本）
protected boolean tryRelease(int arg);   // 解锁逻辑

// 模板方法（AQS 自己实现，子类不用管）：
public final void acquire(int arg);      // 失败则加入队列自旋
public final void release(int arg);      // 唤醒队列头节点

// 核心模板（acquire 的核心）：
// 1 尝试获取锁（CAS state）
// 2 失败 → addWaiter() 加入队尾
// 3 自旋 + shouldParkAfterFailedAcquire() 决定要不要 park
// 4 拿不到就 LockSupport.park() 挂起线程
```

**追问：AQS 的 state 是什么？**
答："一个 volatile int，不同子类有不同含义：
ReentrantLock 存重入次数、Semaphore 存可用许可、CountDownLatch 存倒计时。
**AQS 把'锁状态'抽象成一个 int，把'排队线程'抽象成队列——子类只要实现 tryAcquire/tryRelease。**"

**追问：ReentrantLock 的 tryAcquire 怎么写？**
答："非公平锁直接 CAS state 从 0 改到 1（第一次抢），
如果当前线程已持有则 state++ 可重入；
公平锁额外检查 `hasQueuedPredecessors()` 防止插队。"

### AQS 的应用矩阵

| 工具 | state 含义 | tryAcquire 逻辑 |
|------|----------|-----------------|
| ReentrantLock | 重入次数 | 0→1 首次，>0 同线程 ++ |
| Semaphore | 可用许可数 | state-1 ≥ 0 时 -1 |
| CountDownLatch | 倒计时数 | 不实际加锁，await 时看是否 0 |
| ReadWriteLock 读 | 读线程数 | 读锁 +1 |
| ReadWriteLock 写 | 写线程数 | 独占 |

**面试加分：AQS 和 synchronized 的关系？**
答："synchronized 是 JVM 内置，靠字节码 monitorenter + 对象头的 Monitor；
ReentrantLock 是 Java 层实现，靠 AQS + CAS + 自旋 + park。
**synchronized 不能改源码，ReentrantLock 可以定制（公平/超时/中断）。**"

## 4.5 ReentrantLock 的常见坑

| # | 坑 | 现象 | 解决 |
|---|----|------|------|
| 1 | 忘记 unlock | 死锁 | try-finally 解锁 |
| 2 | 锁内抛异常 | 锁不释放 | finally 解锁 |
| 3 | 锁外 unlock | IllegalMonitorStateException | 必须在持有锁时解锁 |
| 4 | 多个 Condition 互相唤醒 | 死锁 | 用 signalAll 或精确匹配 |
| 5 | 公平锁误用 | 性能下降 | 只有需要公平时才用 |
| 6 | tryLock 不检查返回值 | 业务跑在锁外 | `if (lock.tryLock()) { try{}finally{} }` |
| 7 | 锁对象用 `this` | 子类重入死锁 | 用 private final Lock |

## 4.6 常见坑汇总（与 AQS 相关）

**Condition 相关：**
- await 必须在锁内调用（和 wait 同理）
- signal 不释放锁，是唤醒"已经在队列里的线程"——真正的"拿锁"还要等当前持有者解锁
- 虚假唤醒：await 必须写 while

**AQS 相关：**
- 子类实现 tryAcquire 必须**原子地修改 state**（用 CAS）
- 不要在外层手动操作 state（用 `getState/setState`）
- 不要重写 acquire/release（它们是 final 的）

## 4.7 面试自测（追问链）

**Q1:ReentrantLock 和 synchronized 区别？**
一句话:"ReentrantLock 是 Java 层实现（AQS），支持中断/超时/公平/多条件，但要手动 unlock；
synchronized 是 JVM 内置，自动释放但不灵活。"
追问:优先用哪个?(简单场景 synchronized；复杂需求 ReentrantLock)

**Q2:公平锁和非公平锁？**
一句话:"非公平锁直接 CAS 抢，失败才排队，性能高；公平锁按 FIFO 排队，性能低但避免饥饿。"
追问:默认是哪种?(非公平——`new ReentrantLock()` 默认非公平)

**Q3:什么是 AQS？**
一句话:"AbstractQueuedSynchronizer，JUC 同步框架的基类，用一个 volatile int state + CLH 队列管理锁状态和等待线程。"
追问:state 是什么?(不同子类不同含义：ReentrantLock 存重入次数、Semaphore 存许可数)

**Q4:ReentrantLock 怎么解锁？**
一句话:"finally 里 lock.unlock()——必须，否则死锁。"
追问:unlock 不在锁内会怎样?(IllegalMonitorStateException)

**Q5:Condition 有什么用？**
一句话:"多条件等待——比如生产者-消费者，notFull 和 notEmpty 各等各的，不误唤醒。"
追问:synchronized 的 wait/notify 有这功能吗?(没有——notify 只能唤醒等这个 monitor 的任意线程)

**Q6:AQS 的实现模式？**
一句话:"模板方法 + 状态机：子类实现 tryAcquire/tryRelease 修改 state，AQS 负责排队、自旋、park。"
追问:为什么要 park 不用 wait?(LockSupport.park 是底层原语，比 wait 灵活，不需要 monitor)

---

**本章验收**：能画出 AQS 的 state + 队列结构；能手写 ReentrantLock 基本用法；
能对比公平/非公平锁、能用 Condition 写生产者-消费者。
下一步:第5章 CAS 与原子类。
