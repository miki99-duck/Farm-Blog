---
layout: default
title: "Kafka 与 ZooKeeper 完全教程"
description: "从大白话讲起的 Kafka 与 ZooKeeper 教程：集群搭建、客户端开发、副本与事务、监控运维与排错，33 章、183 段可复制代码。"
---

# Kafka 与 ZooKeeper 完全教程


## 零、写给完全不懂技术的你

> 如果你完全没有编程经验，或者一看到"分布式""消息队列"就头大，这一章就是为你准备的。读完这章，你会明白 Kafka 到底是什么、为什么要用它、以及它的几个核心概念到底在说什么。

### 0.1 Kafka 到底是什么？

**一句话版本：Kafka 就是一个超大号的"消息中转站"。**

想象你开了一家大型餐厅：

- 前厅有 10 个服务员在点菜（**生产者**——产生消息的人）
- 后厨有 5 个厨师在做菜（**消费者**——处理消息的人）
- 中间有一个**传菜窗口**（**Kafka**——传递消息的地方）

服务员把写好的菜单放到传菜窗口，厨师从窗口取菜单来做菜。服务员不需要知道是哪个厨师来做，厨师也不需要知道是谁点的菜。**传菜窗口**让前后厅完全解耦——即使某个厨师请假了，其他厨师照样能从窗口取菜单；即使临时来了 20 个服务员，窗口也接得住。

**Kafka 就是这个传菜窗口**——它站在"消息发送方"和"消息接收方"中间，负责：

1. **接收**消息（从生产者那里收）
2. **暂存**消息（放在这里不会丢）
3. **转发**消息（让消费者来取）

### 0.2 为什么需要 Kafka？

**你可能会问：A 系统想给 B 系统发数据，直接调用不就行了？干嘛中间还要加一个 Kafka？**

好问题！直接调用确实可以，但遇到以下情况就麻烦了：

**场景一：速度不匹配**
> 你在网上抢购一瓶限量茅台，1 秒钟有 10 万人点击"购买"。但后端处理订单每秒只能处理 1000 个。如果不加缓冲，直接让 10 万个请求同时打到订单系统，系统就崩了。
>
> **Kafka 的做法**：先把 10 万个请求全部"接住"存起来，然后让订单系统按自己的速度一个一个处理。就像银行取号排队——你拿个号坐那等，柜台按自己的节奏叫号。

**场景二：系统耦合**
> 你有一个电商系统，用户下单后需要：发短信通知、更新库存、记录日志、推送优惠券。如果下单代码里直接调用这 4 个系统，下单系统和这 4 个系统就绑死了——任何一个系统挂了，下单都可能受影响。
>
> **Kafka 的做法**：下单系统只需要往 Kafka 发一条"有新订单"的消息，那 4 个系统各自从 Kafka 取消息来处理。下单系统完全不关心谁来消费、怎么消费。

**场景三：数据量太大**

> 某大型网站每秒产生几百万条用户行为日志（点击、浏览、搜索）。这些日志需要被多个系统分析。如果每个系统都去网站服务器上"扒数据"，网站服务器早就被拖垮了。
>
> **Kafka 的做法**：网站只需要把日志"扔"到 Kafka，谁需要谁自己来取。Kafka 能扛住每秒百万级的数据写入。

**总结：Kafka 解决了三个核心问题：**
- 🔌 **解耦**：发送方和接收方互不认识，互不影响
- ⚡ **削峰**：流量再大也不会压垮下游系统
- 📦 **缓冲**：数据先存着，消费者按自己的速度处理

### 0.3 Kafka 的核心概念——用大白话说

| 术语 | 大白话解释 | 生活比喻 |
|------|-----------|----------|
| **消息（Message）** | 一条数据记录，就像一条信息 | 一张快递单 |
| **主题（Topic）** | 消息的"分类标签"，同类消息放一起 | 快递柜上的分类格口——"文件""包裹""生鲜" |
| **生产者（Producer）** | 把消息发到 Kafka 的人 | 寄快递的人 |
| **消费者（Consumer）** | 从 Kafka 取消息的人 | 收快递的人 |
| **分区（Partition）** | 一个主题可以拆成多份，分散存储 | 一个大型停车场分成 A 区、B 区、C 区，分散压力 |
| **消费者组（Consumer Group）** | 一组消费者一起干活，分工不重复 | 一个快递站有 3 个快递员，每人负责一栋楼 |
| **Broker** | 一台运行 Kafka 的服务器 | 快递站的一个仓库 |

### 0.4 用一张"快递站"图理解 Kafka 架构

```
┌─────────────┐         ┌──────────────────────────────────────────┐         ┌──────────────┐
│  寄快递的人  │         │           快递站（Kafka 集群）             │         │  收快递的人   │
│  (生产者)    │ ──发──> │  ┌────────┐  ┌────────┐  ┌────────┐    │ ──取──> │  (消费者)     │
│             │         │  │仓库 A   │  │仓库 B   │  │仓库 C   │    │         │              │
│             │         │  │(Broker1)│  │(Broker2)│  │(Broker3)│    │         │              │
│             │         │  └────────┘  └────────┘  └────────┘    │         │              │
└─────────────┘         │  快递按"类别"(Topic)分拣，存入不同仓库     │         └──────────────┘
                        └──────────────────────────────────────────┘

- 快递 = 消息（Message）
- 类别 = 主题（Topic），比如"文件类""包裹类"
- 仓库 = Broker（Kafka 服务器）
- 每个仓库可以有多个分区（格口）= Partition
- 寄快递的人 = 生产者（Producer）
- 收快递的人 = 消费者（Consumer）
- 快递员团队 = 消费者组（Consumer Group）
```


## 一、Kafka 产品介绍

### 1.1 什么是 Kafka？

Apache Kafka 就像一个**超大号的邮局**——你把信（消息）交给它，它帮你保管好，然后按照你指定的"收件人类型"（主题）分发出去。

最初由 LinkedIn（领英）的工程师开发，2011 年交给了 Apache 基金会维护。如今，它是全球最流行的消息传递系统之一，LinkedIn、Netflix、Uber、美团、字节跳动等大厂都在用。

**Kafka 能做什么？用一句话说：在不同的系统之间高速、可靠地传递大量数据。**

> 💡 **打个比方**：如果把各个业务系统比作各个城市的公司，Kafka 就是连接这些城市的高速公路网。数据（货物）通过这条高速公路高速流转，而且不会堵车（高吞吐）、不会丢货（持久化）、路坏了还能走备用路线（高可靠）。

### 1.2 核心特性——用问答的方式理解

**Q：Kafka 有多快？**
> A：单台 Kafka 服务器每秒能处理 **10 万条以上**的消息。打个比方，如果每条消息是一封邮件，Kafka 一秒钟能帮你寄出 10 万封邮件——比你打字的速度快几万倍。

**Q：数据放在 Kafka 里安全吗？会不会丢？**
> A：很安全。Kafka 会把消息"抄写"到多台服务器上（这叫**副本机制**）。即使一台服务器硬盘坏了，其他服务器上还有备份。就像你把重要文件同时存了 U 盘、网盘和邮箱——总有一份能找到。

**Q：Kafka 会不会越存越慢？**
> A：不会。Kafka 存数据的方式很巧妙——它只在硬盘末尾"追加写入"（就像在一本书最后不断加页），而不是随机翻到某一页去修改。这种顺序写入的速度非常快，甚至可以媲美内存的速度。

**Q：数据量太大了怎么办？**
> A：Kafka 可以"加机器"。就像一条高速公路堵了就修更多车道——把数据分散到多台服务器上（这叫**分区**），每台服务器处理一部分，整体速度线性提升。

**Q：消息会不会发重复了？**
> A：Kafka 有"幂等性"机制——即使网络抖动导致同一条消息发了两次，Kafka 也能识别并只保留一条。就像邮局发现你寄了两封一模一样的信，会帮你把多余的退回去。

### 1.3 Kafka 能用在哪些场景？

| 场景 | 通俗解释 | 真实案例 |
|------|---------|---------|
| **日志收集** | 把各个系统的"日志"统一汇总到一个地方 | 把 100 台服务器的日志全部集中到一起分析 |
| **实时数据管道** | 数据从 A 系统实时流向 B 系统 | 用户点击网页的行为，实时传给推荐系统 |
| **事件驱动架构** | 一个事件触发多个后续动作 | 用户下单 → 自动发短信 + 扣库存 + 记日志 |
| **流处理** | 边接收数据边实时计算 | 实时统计每分钟的销售额 |
| **监控与指标** | 实时采集系统运行状态 | 监控 CPU、内存、接口响应时间 |

### 1.4 Kafka 和其他消息队列有什么区别？

> **什么是"消息队列"？** 就是一个存放消息的"队列"——先进先出，类似于排队买奶茶：先排的先拿到。

| | Kafka | RabbitMQ | RocketMQ |
|---|---|---|---|
| **速度** | 🚀 极快（每秒 10 万+） | 🚗 中等（每秒万级） | 🚀 快（每秒 10 万+） |
| **数据存储** | 📦 很强，大量数据长期存放 | 📄 支持，但存太多会影响速度 | 📦 很强 |
| **延迟** | 毫秒级 | 低毫秒级（1-5ms） | 毫秒级 |
| **适合场景** | 大数据量、日志、流处理 | 复杂路由、需要即时确认 | 电商、金融交易 |

**怎么选？**
- 数据量巨大、需要长期存储、做日志或流处理 → **选 Kafka**
- 需要复杂的消息路由规则、要求每条消息都必须被确认 → 选 RabbitMQ
- 电商交易、金融订单等场景 → RocketMQ 也是不错的选择


## 二、Kafka 核心概念与架构

> 这一章会把 Kafka 的核心概念用生活化的比喻讲清楚。每学一个新概念，你都能立刻联想到一个生活场景。

### 2.1 核心组件

#### Broker（经纪人/仓库管理员）

**大白话**：Broker 就是 Kafka 集群中的一台服务器，负责存储数据和处理请求。

**生活比喻**：想象一个大型快递网络，每个快递站点就是一个 Broker。你的快递可以存放在任何一个站点。一个 Kafka 集群通常有多个 Broker（至少 3 个），就像快递网络有多个站点——某一个站点出了问题，其他站点照样工作。

**架构关系图**：
```
Kafka 集群
├── Broker 1（站点 A）── 存放部分数据
├── Broker 2（站点 B）── 存放部分数据
└── Broker 3（站点 C）── 存放部分数据

其中有一个 Broker 会被选为"总调度"（Controller），
负责协调各个站点之间的工作。
```

---

#### Topic（主题/频道）

**大白话**：Topic 就是消息的"分类标签"。发送消息时必须指定"发到哪个主题"，接收消息时也要指定"订阅哪个主题"。

**生活比喻**：Topic 就像电视台的频道——CCTV-1 新闻频道、CCTV-5 体育频道、CCTV-6 电影频道。你想看体育新闻就切到 CCTV-5，想看电影就切到 CCTV-6。每条消息都属于某个"频道"。

```
主题示例：
├── "用户注册"    ← 存放所有用户注册的消息
├── "订单创建"    ← 存放所有新建订单的消息
├── "系统日志"    ← 存放所有系统运行日志
└── "支付通知"    ← 存放所有支付成功的消息
```

---

#### Partition（分区）

**大白话**：一个 Topic 可以被拆成多个 Partition，分散存储在不同的 Broker 上。这是 Kafka 实现高速处理的核心秘密。

**生活比喻**：假设你开了一家大型超市，收银台只有一个，排队的人从超市排到了马路上。怎么办？多开几个收银台！每个收银台处理一部分顾客。Partition 就是这些"收银台"——把一个主题的消息分散到多个分区，并行处理。

```
"订单创建" 这个主题被分成了 3 个分区：

分区 0 ──→ 存在 Broker 1 ──→ 处理用户 A、D、G 的订单
分区 1 ──→ 存在 Broker 2 ──→ 处理用户 B、E、H 的订单
分区 2 ──→ 存在 Broker 3 ──→ 处理用户 C、F、I 的订单

三个分区同时工作，速度是单分区的 3 倍！
```

> ⚠️ **重要规则**：在同一个分区内，消息的顺序是保证的（先发的先到）。但跨分区不保证顺序。如果你的业务需要严格顺序（比如银行转账），要确保相关消息都发到同一个分区。

---

#### Producer（生产者）

**大白话**：生产者就是"发消息的一方"。你的应用程序把数据发送到 Kafka 的某个 Topic，你的应用程序就是生产者。

**生活比喻**：生产者就像外卖商家——把做好的菜（消息）打包好，交给外卖平台（Kafka），平台负责配送给顾客（消费者）。

---

#### Consumer（消费者）

**大白话**：消费者就是"收消息的一方"。你的应用程序从 Kafka 的某个 Topic 读取数据，你的应用程序就是消费者。

**生活比喻**：消费者就像点外卖的你——从外卖平台（Kafka）取餐（消息），然后享用（处理数据）。

---

#### Consumer Group（消费者组）

**大白话**：多个消费者可以组成一个"组"，共同消费一个主题的消息。组内的每个人各负责一部分，不重复干活。

**生活比喻**：你点了 100 份外卖给公司团建，不可能一个人去取。于是你叫了 3 个同事一起去取——小王取 1-34 号，小李取 35-67 号，小张取 68-100 号。这 3 个同事就是一个"消费者组"。

```
"订单创建" 主题（3 个分区）

消费者组 A（订单处理组）：
├── 消费者 A1 ──→ 消费分区 0
├── 消费者 A2 ──→ 消费分区 1
└── 消费者 A3 ──→ 消费分区 2

消费者组 B（数据分析组）：    ← 另一个组，独立消费同一份数据
├── 消费者 B1 ──→ 消费分区 0
├── 消费者 B2 ──→ 消费分区 1
└── 消费者 B3 ──→ 消费分区 2

两个组各自独立消费，互不干扰！
就像"订单处理组"用订单来发货，"数据分析组"用同一份订单来统计营收。
```

> ⚠️ **重要规则**：一个分区在同一时刻只能被同一个消费者组里的一个消费者消费。如果消费者比分区多，多出来的消费者就会"闲着"。所以，**消费者数量 ≤ 分区数量**才是最优配置。

---

#### Offset（偏移量/位移）

**大白话**：消费者读到哪条消息了，Kafka 会记个"书签"。下次继续读的时候，从书签位置接着往下读。

**生活比喻**：你看一本 500 页的小说，看到第 200 页夹了个书签。下次翻开书，直接从第 201 页开始看，不用从头翻。Offset 就是这个书签。

---

#### Replica（副本）

**大白话**：Kafka 会把每个分区的数据复制几份，存在不同的 Broker 上，以防某台服务器坏了丢数据。

**生活比喻**：你写了一份非常重要的合同，不能只有一份。于是你复印了 3 份，分别放在公司、家里和保险箱。就算家里着火了，公司和保险箱里还各有一份。副本就是"复印的合同"。

```
分区 0 的副本分布：
├── 主副本（Leader）  ──→ 存在 Broker 1（负责读写）
├── 副本 1（Follower）──→ 存在 Broker 2（同步备份）
└── 副本 2（Follower）──→ 存在 Broker 3（同步备份）

如果 Broker 1 坏了，Kafka 会从 Broker 2 或 3 中
选一个"提升"为新的主副本，服务不中断。
```

### 2.2 架构演进

Kafka 的架构经历了一次重要变革：

**传统模式（依赖 ZooKeeper）**：
> 早期的 Kafka 需要一个叫 ZooKeeper 的"管家"来帮忙管理——比如记录哪些 Broker 在线、分区分配给了谁、谁是主副本等。就像一个快递网络需要一个"总调度中心"。

**新模式（KRaft，推荐）**：
> 从 Kafka 3.3 起，KRaft 模式达到生产就绪状态（KIP-833），Kafka 不再需要 ZooKeeper 这个外部管家。KRaft 模式内置了 Raft 共识协议实现自我管理，部署更简单，性能更好，支持数百万分区。

```
传统架构：
┌──────────────┐     ┌──────────────────┐
│   Kafka      │ ←── │   ZooKeeper      │
│   集群       │     │   （外部管家）     │
└──────────────┘     └──────────────────┘

KRaft 新架构：
┌──────────────────────────────────┐
│   Kafka 集群（自己管理自己）       │
│   内置 Raft 协议，无需外部依赖     │
└──────────────────────────────────┘
```

## 三、ZooKeeper 原理与用法

### 3.1 ZooKeeper 是什么

Apache ZooKeeper 是一个分布式的开源协调服务，用于分布式系统。ZooKeeper 允许你读取、写入数据和发现数据更新，数据按层次结构组织在文件系统中，并复制到 Ensemble（ZooKeeper 服务器集合）中的所有服务器。

### 3.2 ZooKeeper 核心概念

ZooKeeper 提供了一个类似 Linux 文件系统的树形目录结构，每个节点称为 **Znode**。

**Znode 类型**：

| 类型 | 说明 | 场景 |
|------|------|------|
| 持久节点（Persistent） | 创建后一直存在，直到主动删除 | 配置信息、服务地址 |
| 临时节点（Ephemeral） | 客户端会话断开后自动删除 | 服务注册发现 |
| 持久顺序节点（Persistent Sequential） | 持久节点 + 自动自增后缀 | 分布式 ID |
| 临时顺序节点（Ephemeral Sequential） | 临时节点 + 自动自增后缀 | 分布式锁 |

### 3.3 ZooKeeper 核心特性

- **一致性**：集群中各节点的数据保持强一致性（基于 ZAB 协议）
- **高可用**：只要集群中半数以上节点存活，服务就能正常工作
- **实时性**：数据变化能实时推送到客户端（Watcher 机制）
- **有序性**：所有事务请求都有全局唯一的事务 ID（ZXID），保证操作顺序性

### 3.4 ZooKeeper 工作原理

ZooKeeper 的选举算法（Fast Leader Election）基于 Paxos 变体，要求集群中超过半数节点存活才能正常工作，这也是为什么推荐奇数节点（3、5、7）的原因。

在 Kafka、HBase、Dubbo 等分布式系统中，ZooKeeper 承担着 Controller 选举、分区分配、配置管理等核心职责。


### 3.5 小白也能看懂的环境准备指南

> **本节目标**：如果你是第一次接触 Kafka 和 ZooKeeper，跟着本节一步步操作，确保环境就绪后再进入集群搭建。

#### 3.5.1 检查和安装 Java 环境

Kafka 和 ZooKeeper 都运行在 JVM（Java 虚拟机）上，所以必须先装好 Java。

**第一步：检查是否已安装 Java**

打开终端（Windows 用户用 PowerShell 或 CMD，Linux/Mac 用户用 Terminal），输入：

> 💡 **Windows 用户注意**：本教程中 Windows 命令示例使用 `^` 作为续行符（CMD 语法）。如果你使用 PowerShell，续行符应改为反引号 `` ` ``。例如 `bin\windows\kafka-topics.bat --create ^` 在 PowerShell 中应写为 `` bin\windows\kafka-topics.bat --create ` ``。

```bash
java -version
```

- ✅ 如果看到类似 `openjdk version "1.8.0_xxx"` 或更高版本的输出，说明已安装，可以直接跳到下一步。
- ❌ 如果提示"不是内部或外部命令"或"command not found"，说明未安装，请继续看下面。

**第二步：安装 Java**

| 操作系统 | 安装方式 | 具体命令/步骤 |
|----------|----------|---------------|
| **Windows** | ① 下载安装包 | 访问 [Adoptium](https://adoptium.net/) 下载 OpenJDK 11 或 17 的 `.msi` 安装包，双击安装即可。**安装时勾选"Set JAVA_HOME variable"** |
| **Ubuntu/Debian** | apt 安装 | `sudo apt update && sudo apt install openjdk-11-jdk -y` |
| **CentOS/RHEL** | yum 安装 | `sudo yum install java-11-openjdk-devel -y` |
| **macOS** | Homebrew 安装 | `brew install openjdk@11` |

**第三步：配置 JAVA_HOME 环境变量**

JAVA_HOME 是告诉 Kafka 和 ZooKeeper "Java 装在哪里"的关键变量。

**Linux / macOS**：编辑 `~/.bashrc` 或 `~/.zshrc`，在末尾添加：

```bash
# 请将路径替换为你实际的 Java 安装路径
export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH
```

保存后执行 `source ~/.bashrc` 使其生效。

**Windows**：

1. 右键"此电脑" → "属性" → "高级系统设置" → "环境变量"
2. 在"系统变量"中点击"新建"：
   - 变量名：`JAVA_HOME`
   - 变量值：`C:\Program Files\Eclipse Adoptium\jdk-11.x.x-hotspot`（根据实际安装路径填写）
3. 找到 `Path` 变量，点击"编辑"，添加 `%JAVA_HOME%\bin`

**第四步：验证安装**

```bash
java -version
echo $JAVA_HOME       # Linux/Mac
echo %JAVA_HOME%      # Windows CMD
echo $env:JAVA_HOME   # Windows PowerShell
```

> 📸 **你应该看到**：`java -version` 显示版本号，`echo JAVA_HOME` 显示正确的路径。如果都正常，恭喜你，Java 环境准备完成！

#### 3.5.2 下载和解压 ZooKeeper

**第一步：下载 ZooKeeper**

访问 Apache ZooKeeper 官网下载页面：https://zookeeper.apache.org/releases.html

> 💡 **为什么要选稳定版？** 稳定版（Stable Release）经过充分测试，不容易遇到 Bug。建议选择 3.7.x 或 3.8.x 版本。

选择一个镜像站点，下载 `.tar.gz` 格式的文件，例如：`apache-zookeeper-3.8.4-bin.tar.gz`

> ⚠️ **注意**：要下载带 `-bin` 后缀的文件（已经编译好的），不带 `-bin` 的是源码包，需要自己编译，不适合新手。

**第二步：解压**

**Linux / macOS**：

```bash
# 将下载的文件移动到一个合适的目录（比如 /opt）
sudo mv apache-zookeeper-3.8.4-bin.tar.gz /opt/
cd /opt

# 解压
sudo tar -xzf apache-zookeeper-3.8.4-bin.tar.gz

# 为了方便操作，创建一个软链接（可选但推荐）
sudo ln -s apache-zookeeper-3.8.4-bin zookeeper
```

**Windows**：

1. 用 7-Zip 或 WinRAR 解压 `.tar.gz` 文件到一个目录，比如 `D:\zookeeper`
2. 建议路径中**不要包含中文或空格**

解压后的目录结构应该是这样的：

```
zookeeper/
├── bin/              # 启动脚本
│   ├── zkServer.sh   # Linux/Mac 启动命令
│   ├── zkServer.cmd  # Windows 启动命令
│   ├── zkCli.sh      # Linux/Mac 客户端
│   └── zkCli.cmd     # Windows 客户端
├── conf/             # 配置文件目录
│   └── zoo_sample.cfg  # 配置文件模板
├── lib/              # 依赖 jar 包
└── docs/             # 文档
```

> 📸 **你应该看到**：bin 目录下有 `zkServer` 和 `zkCli` 脚本文件。如果解压成功，你会看到这些文件。

#### 3.5.3 创建 ZooKeeper 配置文件

ZooKeeper 需要一个配置文件才能启动。模板文件已经帮你准备好了，只需要复制一份并修改。

```bash
cd /opt/zookeeper/conf
cp zoo_sample.cfg zoo.cfg
```

> 💡 **为什么要复制而不是直接改模板？** 保留原始模板，方便以后对照默认配置、排查问题。

以下是 `zoo.cfg` 中**每个配置项的详细解释**：

```properties
# ======================== 基础配置 ========================

# 基本时间单元（毫秒），ZooKeeper 中很多时间设置都是它的倍数
# 例如心跳间隔、会话超时等都基于这个值
tickTime=2000

# 数据目录：ZooKeeper 存储内存数据库快照和事务日志的地方
# ⚠️ 重要：这个目录必须预先创建好！
dataDir=/var/lib/zookeeper

# 客户端连接端口：你的应用程序（包括 Kafka）连接 ZooKeeper 用的端口
clientPort=2181

# ======================== 集群配置（单机可不配） ========================

# 初始化连接时，Follower 最多能容忍多少个 tickTime 的延迟
# 例如 initLimit=10 表示最多等待 10 * 2000ms = 20秒
initLimit=10

# 运行过程中，Follower 与 Leader 之间请求和应答最长能容忍多少个 tickTime
# 例如 syncLimit=5 表示如果 5 * 2000ms = 10秒内没有收到响应，认为 Follower 掉线
syncLimit=5

# ======================== 自动清理配置 ========================

# 保留多少个快照文件（默认3，建议生产环境调大）
autopurge.snapRetainCount=3

# 自动清理任务的间隔时间（小时），0表示不自动清理
autopurge.purgeInterval=1
```

**第三步：创建数据目录**

```bash
# Linux/macOS
sudo mkdir -p /var/lib/zookeeper
sudo chmod 755 /var/lib/zookeeper

# Windows
mkdir D:\zookeeper-data
```

> ⚠️ **关键步骤**：必须确保 `dataDir` 配置的目录实际存在，否则 ZooKeeper 启动会报错！

#### 3.5.4 Windows / Linux / Mac 操作差异速查

| 操作 | Linux | macOS | Windows |
|------|-------|-------|---------|
| **启动 ZooKeeper** | `bin/zkServer.sh start` | `bin/zkServer.sh start` | `bin\zkServer.cmd` |
| **停止 ZooKeeper** | `bin/zkServer.sh stop` | `bin/zkServer.sh stop` | 关闭 CMD 窗口或 `bin\zkServer.cmd stop` |
| **启动客户端** | `bin/zkCli.sh` | `bin/zkCli.sh` | `bin\zkCli.cmd` |
| **查看进程** | `ps aux \| grep zoo` | `ps aux \| grep zoo` | 任务管理器中找 `java.exe` |
| **查看日志** | `tail -f zookeeper.out` | `tail -f zookeeper.out` | 查看 `zookeeper.out` 文件 |
| **路径分隔符** | `/` | `/` | `\`（注意） |
| **环境变量设置** | `export JAVA_HOME=...` | `export JAVA_HOME=...` | 系统属性中设置 |

> 💡 **Windows 用户特别注意**：Windows 下脚本用 `.cmd` 后缀（如 `zkServer.cmd`），Linux/Mac 下用 `.sh` 后缀。配置文件路径分隔符在 Windows 下也是一样的 `/` 或 `\` 都可以。

#### 3.5.5 快速验证：单机启动 ZooKeeper

```bash
# Linux / macOS
cd /opt/zookeeper
bin/zkServer.sh start

# Windows
cd D:\zookeeper
bin\zkServer.cmd
```

> 📸 **你应该看到**：`Starting zookeeper ... STARTED`（Linux/Mac），或一个 Java 窗口持续运行（Windows）。

启动后用客户端连接测试：

```bash
# Linux / macOS
bin/zkCli.sh -server 127.0.0.1:2181

# Windows
bin\zkCli.cmd -server 127.0.0.1:2181
```

进入客户端后尝试以下命令：

```
# 查看根目录
ls /

# 创建一个测试节点
create /test "hello"

# 读取节点数据
get /test

# 删除节点
delete /test

# 退出
quit
```

> 📸 **你应该看到**：`ls /` 返回 `[zookeeper]`，`create` 和 `get` 命令正常返回结果。如果一切正常，说明 ZooKeeper 单机环境已经搭建成功！🎉


## 四、ZooKeeper 集群搭建

### 4.1 单机部署

**环境准备**：
- 操作系统：推荐 Linux（CentOS/Ubuntu）
- Java 环境：JDK 1.8+ 并配置 JAVA_HOME
- 下载 ZooKeeper 稳定版（如 3.7.0）

**核心配置**（conf/zoo.cfg）：
```properties
tickTime=2000
dataDir=/var/lib/zookeeper
clientPort=2181
```

**启动与验证**：
```bash
bin/zkServer.sh start
bin/zkCli.sh -server 127.0.0.1:2181
```

### 4.2 集群部署（三节点）

**节点规划**：准备三台机器，配置 hosts 文件实现主机名解析。

**统一环境配置**：
```bash
# 关闭防火墙
systemctl stop firewalld
systemctl disable firewalld

# 配置 hosts
192.168.42.140 zookeeper1
192.168.42.145 zookeeper2
192.168.42.146 zookeeper3
```

**ZooKeeper 配置**（每台机器的 zoo.cfg 必须完全一致）：
```properties
tickTime=2000
initLimit=10
syncLimit=5
dataDir=/var/lib/zookeeper
clientPort=2181
server.1=zookeeper1:2888:3888
server.2=zookeeper2:2888:3888
server.3=zookeeper3:2888:3888
```

**创建 myid 文件**：在每个 dataDir 下创建 myid 文件，内容为对应的 server ID（1、2、3）。

**启动集群**：依次启动三台机器的 ZooKeeper：
```bash
bin/zkServer.sh start
```

**验证集群状态**：
```bash
echo stat | nc 127.0.0.1 2181
# 查看 Mode: leader 或 Mode: follower
```

### 4.3 单机伪集群部署

在一台机器上模拟多个 ZooKeeper 实例：

1. 为每个实例创建独立的数据目录和配置文件
2. 配置不同的 clientPort（如 2181、2182、2183）
3. 在每个 dataDir 下创建 myid 文件


## 五、Kafka 集群搭建

### 5.1 环境准备

**硬件要求**：
- 至少 32GB 内存
- 快速的 SSD 硬盘（或 NVMe）
- 多核 CPU

**软件要求**：
- 操作系统：CentOS 7/8 或 Ubuntu
- Java 8+（推荐 OpenJDK 8 或 11）
- Kafka 版本：kafka_2.13-3.4.0.tgz

### 5.1.5 单机快速体验：5 分钟跑通第一个 Kafka

> **本节目标**：不搭建集群，先在本机用最少的步骤跑通 Kafka 的"发消息 → 收消息"完整流程，建立直观感受。

#### 第一步：下载并解压 Kafka

```bash
# Linux / macOS
cd /opt
wget https://downloads.apache.org/kafka/3.4.0/kafka_2.13-3.4.0.tgz
tar -xzf kafka_2.13-3.4.0.tgz
ln -s kafka_2.13-3.4.0 kafka

# Windows（用 PowerShell 下载或浏览器下载）
# 解压到 D:\kafka
```

> 💡 **为什么要用这个版本？** `kafka_2.13-3.4.0` 中 `2.13` 是 Scala 版本，`3.4.0` 是 Kafka 版本。Scala 版本不影响你用 Java 开发，只是 Kafka 内部编译语言的版本号。

> 📸 **你应该看到**：解压后有一个 `kafka_2.13-3.4.0` 目录，里面有 `bin/`、`config/`、`libs/` 等文件夹。

#### 第二步：启动 Kafka 自带的 ZooKeeper

Kafka 自带了一个单机版 ZooKeeper，专门用于开发测试环境，不需要你单独安装。

```bash
# Linux / macOS
cd /opt/kafka
bin/zookeeper-server-start.sh config/zookeeper.properties

# Windows
bin\windows\zookeeper-server-start.bat config\zookeeper.properties
```

> 💡 **为什么要先启动 ZooKeeper？** 在传统模式下，Kafka 需要 ZooKeeper 来管理元数据（比如哪些 Topic 存在、哪些 Broker 在线）。没有 ZooKeeper，Kafka 就无法启动。

> ⚠️ 这个终端会持续输出日志，**不要关闭它**。打开一个新的终端窗口继续下面的操作。

> 📸 **你应该看到**：大量日志滚动输出，其中有 `binding to port 0.0.0.0/0.0.0.0:2181` 字样，说明 ZooKeeper 启动成功。

#### 第三步：启动 Kafka Broker

```bash
# Linux / macOS（在新终端窗口中执行）
cd /opt/kafka
bin/kafka-server-start.sh config/server.properties

# Windows
bin\windows\kafka-server-start.bat config\server.properties
```

> 💡 **这一步做了什么？** 启动一个 Kafka Broker（消息服务器）。它会连接到第二步启动的 ZooKeeper，注册自己的信息。

> 📸 **你应该看到**：日志中出现 `started (kafka.server.KafkaServer)`，没有 ERROR 级别的报错。又需要一个新终端窗口。

#### 第四步：创建一个 Topic

Topic 是消息的"分类标签"，消息生产者和消费者都通过 Topic 名字来通信。

```bash
# Linux / macOS（在新终端窗口中执行）
cd /opt/kafka
bin/kafka-topics.sh --create \
  --topic my-first-topic \
  --bootstrap-server localhost:9092 \
  --partitions 1 \
  --replication-factor 1

# Windows
bin\windows\kafka-topics.bat --create ^
  --topic my-first-topic ^
  --bootstrap-server localhost:9092 ^
  --partitions 1 ^
  --replication-factor 1
```

> 💡 **参数解释**：
> - `--topic my-first-topic`：给 Topic 起一个名字
> - `--bootstrap-server localhost:9092`：告诉命令连接哪个 Kafka 服务器（9092 是 Kafka 默认端口）
> - `--partitions 1`：分区数为 1（单机体验用 1 就够了）
> - `--replication-factor 1`：副本数为 1（单机只有 1 个 Broker，不能大于 1）

> 📸 **你应该看到**：`Created topic my-first-topic.`，说明 Topic 创建成功。

验证 Topic 是否存在：

```bash
bin/kafka-topics.sh --list --bootstrap-server localhost:9092

# Windows
bin\windows\kafka-topics.bat --list --bootstrap-server localhost:9092
```

> 📸 **你应该看到**：输出 `my-first-topic`。

#### 第五步：生产消息（发送消息）

```bash
# Linux / macOS（在新终端窗口中执行）
cd /opt/kafka
bin/kafka-console-producer.sh \
  --topic my-first-topic \
  --bootstrap-server localhost:9092

# Windows
bin\windows\kafka-console-producer.bat ^
  --topic my-first-topic ^
  --bootstrap-server localhost:9092
```

> 💡 **这一步做了什么？** 启动一个命令行的消息生产者，你输入的每一行文字都会作为一条消息发送到 Kafka。

输入几条消息试试：

```
Hello Kafka!
这是我的第一条消息
I love distributed systems
```

> 📸 **你应该看到**：每按一次回车，消息就发送出去了（终端不会有任何确认输出，这是正常的）。

#### 第六步：消费消息（接收消息）

```bash
# Linux / macOS（在新终端窗口中执行）
cd /opt/kafka
bin/kafka-console-consumer.sh \
  --topic my-first-topic \
  --bootstrap-server localhost:9092 \
  --from-beginning

# Windows
bin\windows\kafka-console-consumer.bat ^
  --topic my-first-topic ^
  --bootstrap-server localhost:9092 ^
  --from-beginning
```

> 💡 **参数解释**：
> - `--from-beginning`：从最早的消息开始消费。如果不加这个参数，只能看到启动消费者之后新产生的消息。

> 📸 **你应该看到**：之前生产者发送的三条消息依次出现！顺序可能与发送时不同（Kafka 只保证同一分区内有序，这里因为只有一个 Partition，顺序通常是正确的）。

#### 🎉 恭喜！你已经跑通了 Kafka 的完整流程

```
你的操作流程：
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  生产者发送    │ →  │  Kafka 存储   │ →  │  消费者接收   │
│  "Hello"      │    │  (my-topic)  │    │  "Hello"     │
└──────────────┘    └──────────────┘    └──────────────┘
```

**接下来你可以尝试**：在生产者窗口继续输入消息，观察消费者窗口是否实时收到。这就模拟了实际生产环境中的"实时消息推送"场景。

**体验完成后，记得按 Ctrl+C 关闭所有终端窗口中的进程**（先关生产者和消费者，再关 Kafka，最后关 ZooKeeper）。

### 5.2 使用 ZooKeeper 模式部署

**步骤 1：启动 ZooKeeper 集群**（参考第四节）

**步骤 2：配置 Kafka Broker**（每个节点）：

```properties
# server.properties
broker.id=1  # 每台唯一
listeners=PLAINTEXT://kafkaserver1:9092
log.dirs=/var/lib/kafka/logs-1
zookeeper.connect=kafkaserver1:2181,kafkaserver2:2181,kafkaserver3:2181
```

**步骤 3：启动 Kafka**：
```bash
bin/kafka-server-start.sh config/server.properties
```

**步骤 4：验证集群**：
```bash
# 创建主题
bin/kafka-topics.sh --create --topic kafka-test \
  --bootstrap-server kafkaserver1:9092 \
  --partitions 3 --replication-factor 3

# 生产消息
bin/kafka-console-producer.sh --topic kafka-test \
  --bootstrap-server kafkaserver1:9092

# 消费消息
bin/kafka-console-consumer.sh --topic kafka-test \
  --from-beginning --bootstrap-server kafkaserver1:9092
```

### 5.3 使用 KRaft 模式部署（推荐）

KRaft 模式自 Kafka 3.x 起可用，去除对 ZooKeeper 的依赖。Kafka 使用内置的 Raft 共识协议自行管理元数据，部署更简单、启动更快、可扩展性更强。

#### 5.3.1 KRaft 模式核心概念

| 概念 | 说明 |
|------|------|
| `process.roles` | 节点角色：`broker`（数据节点）、`controller`（元数据管理）、`broker,controller`（混合角色） |
| `node.id` | 每个节点的唯一标识，类似传统模式的 `broker.id` |
| `controller.quorum.voters` | Controller 节点投票列表，格式为 `nodeId@host:port` |
| `controller.listener.names` | Controller 间通信使用的监听器名称 |
| `inter.broker.listener.name` | Broker 间通信使用的监听器名称 |

#### 5.3.2 单机快速体验

```bash
# 生成集群 ID
KAFKA_CLUSTER_ID="$(bin/kafka-storage.sh random-uuid)"

# 格式化日志目录
bin/kafka-storage.sh format -t $KAFKA_CLUSTER_ID \
  -c config/kraft/server.properties

# 启动 Kafka（无需启动 ZooKeeper）
bin/kafka-server-start.sh config/kraft/server.properties
```

> 💡 **格式化命令只需执行一次**。如果删除了 `log.dirs` 目录需要重新格式化。

#### 5.3.3 三节点 KRaft 集群部署（详细步骤）

**第一步：准备配置文件**

每个节点的 `config/kraft/server.properties` 如下（以 3 节点为例）：

```properties
# ======================== 节点身份 ========================
# 角色：同时充当 Broker 和 Controller（推荐中小规模集群）
process.roles=broker,controller

# 每个节点的唯一 ID（节点1填1，节点2填2，节点3填3）
node.id=1

# ======================== 网络监听 ========================
# 监听器配置：CONTROLLER 用于 Controller 间通信，PLAINTEXT 用于客户端和 Broker 间通信
listeners=PLAINTEXT://:9092,CONTROLLER://:9093

# Controller 使用的安全协议
controller.listener.names=CONTROLLER

# Broker 间通信使用的监听器
inter.broker.listener.name=PLAINTEXT

# 对外通告的地址（替换为实际 IP/主机名）
advertised.listeners=PLAINTEXT://192.168.1.101:9092

# ======================== 集群拓扑 ========================
# Controller 投票列表：所有 Controller 节点的 nodeId@host:port
# ⚠️ 所有节点的此配置必须完全一致！
controller.quorum.voters=1@192.168.1.101:9093,2@192.168.1.102:9093,3@192.168.1.103:9093

# ======================== 存储 ========================
log.dirs=/var/lib/kafka/kraft-logs

# ======================== 副本与可靠性 ========================
num.partitions=3
default.replication.factor=3
min.insync.replicas=2
offsets.topic.replication.factor=3
transaction.state.log.replication.factor=3
transaction.state.log.min.isr=2
```

> ⚠️ **三个节点之间的差异只有以下三项**：
> - `node.id`（分别填 1、2、3）
> - `advertised.listeners`（填各自的实际地址）
> - 其余配置必须完全一致

**第二步：生成集群 ID 并格式化存储**

> ⚠️ **关键**：所有节点必须使用同一个集群 ID。

```bash
# 在第一个节点上生成集群 ID
KAFKA_CLUSTER_ID="$(bin/kafka-storage.sh random-uuid)"
echo $KAFKA_CLUSTER_ID
# 输出类似：MkU3OEVBNTcwNTJENDM2Qk

# 将集群 ID 记录下来，在每个节点上执行格式化
# 节点 1
bin/kafka-storage.sh format -t $KAFKA_CLUSTER_ID \
  -c config/kraft/server.properties

# 节点 2（用 scp 复制配置文件后执行）
bin/kafka-storage.sh format -t $KAFKA_CLUSTER_ID \
  -c config/kraft/server.properties

# 节点 3（同上）
bin/kafka-storage.sh format -t $KAFKA_CLUSTER_ID \
  -c config/kraft/server.properties
```

**第三步：启动集群**

在每个节点上启动 Kafka（无需先启动 ZooKeeper）：

```bash
# 节点 1
bin/kafka-server-start.sh -daemon config/kraft/server.properties

# 节点 2
bin/kafka-server-start.sh -daemon config/kraft/server.properties

# 节点 3
bin/kafka-server-start.sh -daemon config/kraft/server.properties
```

**第四步：验证集群**

```bash
# 创建测试 Topic（3 分区 3 副本）
bin/kafka-topics.sh --create --topic kraft-test \
  --bootstrap-server 192.168.1.101:9092 \
  --partitions 3 --replication-factor 3

# 查看 Topic 详情，确认 Leader 和副本分布正常
bin/kafka-topics.sh --describe --topic kraft-test \
  --bootstrap-server 192.168.1.101:9092

# 测试消息收发
bin/kafka-console-producer.sh --topic kraft-test \
  --bootstrap-server 192.168.1.101:9092

bin/kafka-console-consumer.sh --topic kraft-test \
  --from-beginning --bootstrap-server 192.168.1.101:9092
```

#### 5.3.4 KRaft 模式 vs ZooKeeper 模式对比

| 维度 | ZooKeeper 模式 | KRaft 模式 |
|------|---------------|------------|
| **外部依赖** | 需要独立部署 ZooKeeper 集群 | 无外部依赖，Kafka 自管理 |
| **启动顺序** | 必须先启动 ZK，再启动 Kafka | 直接启动 Kafka 即可 |
| **元数据管理** | 元数据存储在 ZK，通过 ZK 同步 | 元数据存储在内部 Topic `__cluster_metadata` |
| **Controller 选举** | 依赖 ZK 的临时节点 | 内置 Raft 协议选举 |
| **分区上限** | 受 ZK 性能限制（约 20 万分区） | 支持数百万分区 |
| **启动速度** | 较慢（需从 ZK 加载元数据） | 快（从本地日志恢复元数据） |
| **运维复杂度** | 高（需维护两套集群） | 低（单套集群） |
| **功能成熟度** | 非常成熟 | Kafka 3.3+ 生产就绪，3.5+ 推荐 |
| **ZK ACL 特性** | 完整支持 | 部分高级特性尚在演进 |

> 💡 **建议**：新部署的 Kafka 集群优先使用 KRaft 模式。已有 ZK 模式集群可等待官方迁移工具成熟后再迁移。


## 六、集群搭建踩坑点与注意事项

> 💡 **快速提示**：遇到问题时，先检查日志文件（`server.log`、`zookeeper.out`），80%的问题都能从日志中找到线索。

### 6.1 ZooKeeper 常见问题

#### 问题1：ZooKeeper 启动失败，日志显示"端口被占用"

**问题现象**：
```
java.net.BindException: Address already in use
```

**可能原因**：
- 2181 端口已被其他进程占用
- 之前的 ZooKeeper 进程未正常关闭
- 系统防火墙阻止端口绑定

**解决步骤**：
```bash
# 1. 检查端口占用情况
netstat -tlnp | grep 2181
# 或在 Windows 上
netstat -ano | findstr "2181"

# 2. 找到占用端口的进程
lsof -i:2181
# 或在 Windows 上使用任务管理器

# 3. 终止占用进程
kill -9 <PID>
# 或在 Windows 上使用任务管理器结束进程

# 4. 验证端口已释放
netstat -tlnp | grep 2181
```

**预防措施**：
- 使用 systemd 管理 ZooKeeper 服务，确保优雅启停
- 启动前检查端口：`ss -tlnp | grep 2181`

---

#### 问题2：ZooKeeper 启动后立即退出，日志显示"内存不足"

**问题现象**：
```
java.lang.OutOfMemoryError: Java heap space
```

**可能原因**：
- JVM 堆内存配置过小
- 系统物理内存不足
- 其他进程占用大量内存

**解决步骤**：
```bash
# 1. 检查当前内存使用情况
free -h
# 或在 Windows 上使用任务管理器查看内存

# 2. 修改 ZooKeeper JVM 参数
# 编辑 bin/zkEnv.sh 或 conf/zoo.cfg
export JVMFLAGS="-Xms512m -Xmx1024m"

# 3. 清理不必要的进程释放内存
ps aux | sort -nrk 4 | head -10  # 查看内存占用最高的进程

# 4. 重启 ZooKeeper
bin/zkServer.sh restart
```

**预防措施**：
- 生产环境建议 ZooKeeper 分配 2-4GB 堆内存
- 监控系统内存使用，设置告警阈值（>80%）

---

#### 问题3：ZooKeeper 集群无法选举 Leader

**问题现象**：
```
日志显示：Cannot open channel to X at election address
```

**可能原因**：
- 集群节点之间网络不通
- 防火墙阻止 2888/3888 端口
- myid 文件配置错误
- 集群节点数量不足（需要超过半数）

**解决步骤**：
```bash
# 1. 检查节点间网络连通性
ping zookeeper1
ping zookeeper2
ping zookeeper3

# 2. 检查端口是否开放
telnet zookeeper2 2888
telnet zookeeper2 3888

# 3. 检查 myid 文件
cat /var/lib/zookeeper/myid
# 确保内容与 zoo.cfg 中 server.X 的 X 一致

# 4. 检查 zoo.cfg 配置一致性
# 三台机器的 zoo.cfg 必须完全一致（除了 dataDir）

# 5. 检查防火墙规则
iptables -L -n
# 或临时关闭防火墙测试
systemctl stop firewalld
```

**预防措施**：
- 部署前使用 `telnet` 测试所有端口连通性
- 使用配置管理工具（Ansible/Puppet）确保配置一致

---

#### 问题4：ZooKeeper 数据目录磁盘空间不足

**问题现象**：
```
No space left on device
```

**可能原因**：
- 日志文件过大
- 数据目录所在分区空间不足
- 未配置自动清理

**解决步骤**：
```bash
# 1. 检查磁盘使用情况
df -h
du -sh /var/lib/zookeeper/*

# 2. 清理旧日志
find /var/lib/zookeeper -name "*.log" -mtime +7 -delete

# 3. 配置日志自动清理（log4j.properties）
log4j.appender.ROLLINGFILE.MaxFileSize=100MB
log4j.appender.ROLLINGFILE.MaxBackupIndex=10

# 4. 扩展磁盘空间或迁移数据目录
```

**预防措施**：
- 监控磁盘使用率，设置告警阈值（>70%）
- 配置 logrotate 自动清理日志

---

### 6.2 Kafka Broker 常见问题

#### 问题5：Kafka Broker 启动失败，日志显示"broker.id 重复"

**问题现象**：
```
FATAL: Broker with id X already exists
```

**可能原因**：
- 多个 Broker 配置了相同的 broker.id
- 从其他机器复制配置文件时未修改 broker.id

**解决步骤**：
```bash
# 1. 检查当前配置
grep "broker.id" config/server.properties

# 2. 修改为唯一值
sed -i 's/broker.id=.*/broker.id=1/' config/server.properties
# 每台机器设置不同的值（1, 2, 3...）

# 3. 清理旧数据（可选，如果不需要保留数据）
rm -rf /var/lib/kafka/logs/*

# 4. 重启 Kafka（先停后启）
bin/kafka-server-stop.sh
bin/kafka-server-start.sh -daemon config/server.properties
```

**预防措施**：
- 使用自动化脚本生成配置文件
- 配置文件中添加注释说明每台机器的 broker.id

---

#### 问题6：Kafka Broker 无法连接 ZooKeeper

**问题现象**：
```
Unable to connect to zookeeper servers within timeout
```

**可能原因**：
- ZooKeeper 地址配置错误
- ZooKeeper 服务未启动
- 网络不通或防火墙阻止

**解决步骤**：
```bash
# 1. 检查 ZooKeeper 服务状态
echo stat | nc localhost 2181

# 2. 检查 Kafka 配置
grep "zookeeper.connect" config/server.properties
# 确保格式正确：host1:2181,host2:2181,host3:2181

# 3. 测试网络连通性
telnet zookeeper1 2181

# 4. 检查防火墙规则
iptables -L -n | grep 2181

# 5. 查看详细日志
tail -f logs/server.log
```

**预防措施**：
- 使用 DNS 名称而非 IP 地址
- 确保 ZooKeeper 先于 Kafka 启动

---

#### 问题7：Kafka 启动后日志显示"磁盘空间不足"

**问题现象**：
```
ERROR: Shutdown broker because all log dirs have failed
```

**可能原因**：
- 日志目录所在分区空间不足
- 日志保留时间过长
- 消息量超出预期

**解决步骤**：
```bash
# 1. 检查磁盘使用情况
df -h
du -sh /var/lib/kafka/logs/*

# 2. 清理旧日志段（kafka-log-cleaner.sh 是后台 Compaction 进程，不能用于手动清理）
# 正确做法：缩短保留时间让 Kafka 自动清理，或手动删除旧日志段
bin/kafka-configs.sh --bootstrap-server localhost:9092 \
  --entity-type topics --entity-name my-topic \
  --alter --add-config retention.ms=3600000  # 先设为 1 小时加速清理

# 3. 临时调整保留策略
bin/kafka-configs.sh --bootstrap-server localhost:9092 \
  --entity-type topics --entity-name my-topic \
  --alter --add-config retention.ms=3600000

# 4. 扩展磁盘或添加新日志目录
# 在 server.properties 中配置多个日志目录
log.dirs=/var/lib/kafka/logs1,/var/lib/kafka/logs2

# 5. 重启 Kafka（先停后启）
bin/kafka-server-stop.sh
bin/kafka-server-start.sh -daemon config/server.properties
```

**预防措施**：
- 监控磁盘使用率，设置告警阈值（>70%）
- 使用多磁盘分散 IO 压力
- 根据业务需求合理设置保留策略

---

#### 问题8：Kafka Broker 端口被占用

**问题现象**：
```
java.net.BindException: Address already in use
```

**可能原因**：
- 9092 端口被其他服务占用
- 之前的 Kafka 进程未完全退出

**解决步骤**：
```bash
# 1. 检查端口占用
netstat -tlnp | grep 9092
lsof -i:9092

# 2. 终止占用进程
kill -9 <PID>

# 3. 或修改 Kafka 端口
# 编辑 config/server.properties
listeners=PLAINTEXT://:9093

# 4. 重启 Kafka（先停后启）
bin/kafka-server-stop.sh
bin/kafka-server-start.sh -daemon config/server.properties
```

**预防措施**：
- 使用 systemd 管理服务，避免手动杀进程
- 为不同服务分配固定端口范围

---

### 6.3 集群配置常见问题

#### 问题9：生产者发送消息失败，日志显示"找不到 Leader"

**问题现象**：
```
LEADER_NOT_AVAILABLE
```

**可能原因**：
- 分区 Leader 未选举成功
- ISR 副本数量不足
- 网络分区导致脑裂

**解决步骤**：
```bash
# 1. 检查集群状态
bin/kafka-topics.sh --describe --bootstrap-server localhost:9092 --topic my-topic

# 2. 查看 ISR 列表
# 确保所有副本都在 ISR 中

# 3. 检查 Controller 状态
echo stat | nc localhost 2181 | grep "Mode:"

# 4. 如果 Leader 为 -1，手动触发选举
bin/kafka-leader-election.sh --bootstrap-server localhost:9092 \
  --election-type preferred --topic my-topic --partition 0

# 5. 检查网络连通性
ping kafka-broker1
ping kafka-broker2
```

**预防措施**：
- 设置 `min.insync.replicas=2` 确保数据安全
- 监控 ISR 缩减事件

---

#### 问题10：消费者 Rebalance 频繁

**问题现象**：
```
消费者频繁加入和退出组，消费进度不稳定
```

**可能原因**：
- `max.poll.interval.ms` 设置过小
- 消息处理时间过长
- 网络不稳定导致心跳超时
- 消费者数量频繁变化

**解决步骤**：
```bash
# 1. 调整消费者配置
# config/consumer.properties
max.poll.interval.ms=300000  # 5分钟
session.timeout.ms=45000     # 45秒（Kafka 默认值）
heartbeat.interval.ms=15000  # 15秒（默认3000，建议调为 session.timeout.ms 的 1/3）

# 2. 减少每次拉取的消息数量
max.poll.records=100

# 3. 优化消息处理逻辑
# - 批量处理而非逐条处理
# - 异步处理耗时操作

# 4. 监控消费者组状态
bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group my-group
```

**预防措施**：
- 合理设置 `max.poll.interval.ms`，留出足够余量
- 使用异步处理提高消费速度
- 监控消费者 Lag 指标

---

#### 问题11：多集群环境下 ZooKeeper 路径冲突

**问题现象**：
```
多个 Kafka 集群的数据混在一起
```

**可能原因**：
- 多个 Kafka 集群使用了相同的 ZooKeeper
- 未配置 `zookeeper.connect` 的路径前缀

**解决步骤**：
```bash
# 1. 为每个集群配置独立的 ZooKeeper 路径
# Kafka 集群 A
zookeeper.connect=zk1:2181,zk2:2181,zk3:2181/kafka-a
# Kafka 集群 B
zookeeper.connect=zk1:2181,zk2:2181,zk3:2181/kafka-b

# 2. 重启所有 Kafka Broker

# 3. 验证路径
bin/zkCli.sh -server localhost:2181
ls /kafka-a
ls /kafka-b
```

**预防措施**：
- 不同集群使用独立的 ZooKeeper 集群
- 如果共享 ZooKeeper，必须配置不同的路径前缀

---

### 6.4 生产环境建议

**基础配置建议**：
- ZooKeeper 集群建议 5 或 7 台服务器（可容忍 2 或 3 台宕机）
- Kafka 集群至少 3 个 Broker
- 副本数（replication.factor）建议设置为 3
- 设置 `min.insync.replicas=2`

**性能优化建议**：
- 使用 SSD 硬盘提升 IO 性能
- 启用消息压缩（`compression.type=lz4`）
- 调整 `num.io.threads` 和 `num.network.threads`

**监控建议**：
- 监控磁盘使用率、CPU、内存
- 监控消费者 Lag
- 监控 ISR 缩减事件
- 设置告警阈值

---


## 七、Kafka 基础客户端开发流程

### 7.1 开发环境准备

> **本节目标**：搭建一个可以运行 Kafka 客户端代码的 Java 项目环境。

#### 7.1.1 完整的 Maven 项目结构

建议使用 IntelliJ IDEA 或 Eclipse 创建 Maven 项目，项目结构如下：

```
kafka-demo/
├── pom.xml                          # Maven 项目配置文件
└── src/
    └── main/
        ├── java/
        │   └── com/
        │       └── example/
        │           └── kafka/
        │               ├── producer/
        │               │   └── KafkaProducerExample.java    # 生产者示例
        │               ├── consumer/
        │               │   └── KafkaConsumerExample.java    # 消费者示例
        │               └── config/
        │                   └── KafkaConfig.java             # 统一配置类（可选）
        └── resources/
            └── application.properties                       # 配置文件
```

**这段代码做了什么 —— 配置 Maven 依赖**：在 `pom.xml` 中添加 Kafka 客户端库，Maven 会自动下载所有需要的 jar 包（包括网络通信、序列化等底层依赖），你只需要关注业务逻辑。

```xml
<!-- pom.xml 中的 <dependencies> 部分 -->
<dependency>
    <groupId>org.apache.kafka</groupId>
    <artifactId>kafka-clients</artifactId>
    <version>3.4.0</version>
</dependency>

<!-- 可选：如果要用 JSON 序列化，加上 Jackson -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.15.2</version>
</dependency>

<!-- 可选：日志框架 -->
<dependency>
    <groupId>org.slf4j</groupId>
    <artifactId>slf4j-simple</artifactId>
    <version>2.0.7</version>
</dependency>
```

> 💡 **为什么要指定版本号？** `kafka-clients` 的版本应该尽量与你 Kafka 服务端的版本一致，避免出现协议不兼容的问题。

2. **配置连接信息**：bootstrap.servers 指向 Kafka 集群地址

**这段代码做了什么 —— 统一配置类**：把 Kafka 连接参数集中管理，避免在每个类里重复写。生产环境建议从配置文件或配置中心读取。

```java
// config/KafkaConfig.java
package com.example.kafka.config;

public class KafkaConfig {
    // Kafka 服务地址，多个用逗号分隔
    public static final String BOOTSTRAP_SERVERS = "localhost:9092";
    
    // Topic 名称
    public static final String TOPIC = "my-first-topic";
    
    // 消费者组 ID
    public static final String GROUP_ID = "my-group";
}
```

### 7.2 生产者开发流程

**这段代码做了什么**：创建一个最简单的 Kafka 生产者，连接 Kafka 服务器，发送一条"Hello Kafka"消息，并在发送成功后打印消息被存储的分区信息。

```java
package com.example.kafka.producer;

import org.apache.kafka.clients.producer.*;
import com.example.kafka.config.KafkaConfig;

import java.util.Properties;

public class KafkaProducerExample {
    public static void main(String[] args) {
        // =====================================================
        // 第一步：配置生产者参数
        // =====================================================
        // 这些参数告诉 Kafka 客户端：
        // - 连哪个服务器
        // - 消息内容怎么编码（序列化）
        // - 等待策略是什么
        Properties props = new Properties();
        
        // Kafka 服务器地址（必须配置）
        props.put("bootstrap.servers", KafkaConfig.BOOTSTRAP_SERVERS);
        
        // 消息的 Key 用什么方式转换为字节（必须配置）
        // StringSerializer 表示把字符串直接转为 UTF-8 字节
        props.put("key.serializer", 
            "org.apache.kafka.common.serialization.StringSerializer");
        
        // 消息的 Value 用什么方式转换为字节（必须配置）
        props.put("value.serializer", 
            "org.apache.kafka.common.serialization.StringSerializer");
        
        // acks=all 表示 Leader 等待所有 ISR 副本确认（Kafka 3.0+ 默认值）
        // acks=0 最快但可能丢消息，acks=1 仅 Leader 确认
        props.put("acks", "all");
        
        // 发送缓冲区大小（32MB），消息先存这里再批量发送
        props.put("buffer.memory", 33554432);
        
        // 每个批次最大 16KB，攒够了再发送
        props.put("batch.size", 16384);
        
        // linger.ms：发送前等待更多消息凑成一批的时间
        // Kafka 3.x 默认 0（立即发送），Kafka 4.0+ 默认 5ms
        // 设为 50-100 可以显著提高吞吐量（等更多消息凑成一批）
        props.put("linger.ms", 0);

        // =====================================================
        // 第二步：创建生产者实例
        // =====================================================
        // 这一步会建立与 Kafka 的网络连接
        KafkaProducer<String, String> producer = 
            new KafkaProducer<>(props);

        // =====================================================
        // 第三步：构建消息并发送
        // =====================================================
        // ProducerRecord 参数说明：
        //   参数1：Topic 名称 —— 消息发送到哪个 Topic
        //   参数2：Key —— 用于决定消息发到哪个分区（可为 null）
        //   参数3：Value —— 消息正文（实际要传输的数据）
        ProducerRecord<String, String> record = 
            new ProducerRecord<>(KafkaConfig.TOPIC, "key-1", "Hello Kafka!");
        
        // send() 是异步的，不会阻塞主线程
        // Callback 在消息发送成功或失败时被调用
        producer.send(record, new Callback() {
            @Override
            public void onCompletion(RecordMetadata metadata, Exception e) {
                if (e == null) {
                    // 发送成功，打印消息被存储的位置
                    System.out.println("✅ 发送成功！Topic: " + 
                        metadata.topic() + 
                        ", 分区: " + metadata.partition() + 
                        ", 偏移量: " + metadata.offset());
                } else {
                    // 发送失败，打印错误信息
                    System.out.println("❌ 发送失败: " + e.getMessage());
                    e.printStackTrace();
                }
            }
        });

        // =====================================================
        // 第四步：关闭生产者
        // =====================================================
        // 必须关闭！否则消息可能还在缓冲区没有发送出去
        // close() 会等待所有消息发送完成后再关闭连接
        producer.close();
    }
}
```

> 📸 **运行后你应该看到**：`✅ 发送成功！Topic: my-first-topic, 分区: 0, 偏移量: 0`。如果看到 `❌ 发送失败`，请检查 Kafka 是否已启动。

### 7.3 消费者开发流程

**这段代码做了什么**：创建一个 Kafka 消费者，加入名为 `my-group` 的消费者组，持续监听 `my-first-topic` 的消息，收到消息后打印其内容和位置信息。

```java
package com.example.kafka.consumer;

import org.apache.kafka.clients.consumer.*;
import com.example.kafka.config.KafkaConfig;

import java.time.Duration;
import java.util.Arrays;
import java.util.Properties;

public class KafkaConsumerExample {
    public static void main(String[] args) {
        // =====================================================
        // 第一步：配置消费者参数
        // =====================================================
        Properties props = new Properties();
        
        // Kafka 服务器地址（必须配置）
        props.put("bootstrap.servers", KafkaConfig.BOOTSTRAP_SERVERS);
        
        // 消费者组 ID（必须配置）
        // 同一个 group.id 的消费者共同消费一个 Topic，每人分摊不同的分区
        props.put("group.id", KafkaConfig.GROUP_ID);
        
        // 反序列化：把字节转回字符串（必须配置，要与生产者的序列化方式匹配）
        props.put("key.deserializer", 
            "org.apache.kafka.common.serialization.StringDeserializer");
        props.put("value.deserializer", 
            "org.apache.kafka.common.serialization.StringDeserializer");
        
        // 自动提交 offset：每 1 秒自动把消费进度告诉 Kafka
        // 设为 false 则需要手动调用 commitSync() 或 commitAsync()
        props.put("enable.auto.commit", "true");
        props.put("auto.commit.interval.ms", "1000");
        
        // 从哪里开始消费？
        // "earliest"：从最早的消息开始（适合初次使用、不想漏消息）
        // "latest"：只消费启动后新产生的消息
        props.put("auto.offset.reset", "earliest");

        // =====================================================
        // 第二步：创建消费者实例
        // =====================================================
        KafkaConsumer<String, String> consumer = 
            new KafkaConsumer<>(props);

        // =====================================================
        // 第三步：订阅 Topic
        // =====================================================
        // 可以同时订阅多个 Topic：Arrays.asList("topic1", "topic2")
        consumer.subscribe(Arrays.asList(KafkaConfig.TOPIC));

        // =====================================================
        // 第四步：循环拉取消息
        // =====================================================
        // Kafka 的消费模型是"拉"模式：消费者主动去 Broker 拉取消息
        // poll() 会阻塞最多 1000ms，期间如果有消息就立即返回
        System.out.println("🚀 消费者已启动，等待消息...");
        
        // 注册 shutdown hook，确保 Ctrl+C 时优雅关闭消费者
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\n🛑 正在关闭消费者...");
            consumer.close();
            System.out.println("✅ 消费者已关闭");
        }));
        
        while (true) {
            ConsumerRecords<String, String> records = 
                consumer.poll(Duration.ofMillis(1000));
            
            for (ConsumerRecord<String, String> record : records) {
                System.out.printf("📩 收到消息 | offset=%d | key=%s | value=%s%n",
                    record.offset(), record.key(), record.value());
            }
        }
        // 注意：上面是死循环，通过 Ctrl+C 触发 shutdown hook 优雅退出
    }
}
```

> 📸 **运行后你应该看到**：`🚀 消费者已启动，等待消息...`，随后如果之前有发送过消息，会看到 `📩 收到消息 | offset=0 | key=key-1 | value=Hello Kafka!`。如果之前没有消息，启动生产者发一条，消费者会实时显示。

### 7.4 Spring Boot 快速启动示例

> **本节目标**：用 Spring Boot 框架集成 Kafka，这是实际项目开发中最常用的方式。

#### 7.4.1 创建 Spring Boot 项目

访问 https://start.spring.io/ 或在 IDE 中创建 Spring Boot 项目，添加以下依赖：

**pom.xml 关键依赖**：

```xml
<!-- pom.xml -->
<dependencies>
    <!-- Spring Boot Web（可选，用于 REST 接口） -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- Spring Kafka（核心依赖，包含 kafka-clients） -->
    <dependency>
        <groupId>org.springframework.kafka</groupId>
        <artifactId>spring-kafka</artifactId>
    </dependency>

    <!-- 测试支持 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>org.springframework.kafka</groupId>
        <artifactId>spring-kafka-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

> 💡 **为什么要用 Spring Boot？** Spring Boot 帮你自动配置了 Kafka 连接、序列化、错误处理等大量样板代码，你只需要写业务逻辑。相比直接用 `kafka-clients`，代码量减少 70% 以上。

#### 7.4.2 项目结构

```
kafka-spring-boot-demo/
├── pom.xml
└── src/main/
    ├── java/com/example/kafka/
    │   ├── KafkaDemoApplication.java        # 启动类
    │   ├── controller/
    │   │   └── MessageController.java       # REST 接口，发送消息
    │   ├── service/
    │   │   └── KafkaConsumerService.java    # 消费者，监听消息
    │   └── config/
    │       └── KafkaTopicConfig.java        # Topic 自动创建配置（可选）
    └── resources/
        └── application.yml                  # 配置文件
```

#### 7.4.3 配置文件

**这段代码做了什么**：告诉 Spring Boot 连接哪个 Kafka 服务器，以及消息如何序列化/反序列化。Spring Boot 读取这个配置后会自动创建 Producer 和 Consumer 实例。

```yaml
# application.yml
spring:
  kafka:
    # Kafka 服务器地址（必须配置）
    bootstrap-servers: localhost:9092
    
    # 生产者配置
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.apache.kafka.common.serialization.StringSerializer
      acks: all                      # Leader 等待所有 ISR 确认（3.0+ 默认）
      retries: 3                     # 失败重试 3 次
    
    # 消费者配置
    consumer:
      group-id: my-spring-group      # 消费者组 ID
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      auto-offset-reset: earliest    # 初次启动从头消费
      enable-auto-commit: true       # 自动提交 offset
```

#### 7.4.4 启动类

**这段代码做了什么**：Spring Boot 应用的入口。`@SpringBootApplication` 注解会触发自动配置，包括 Kafka 的连接、Producer/Consumer Bean 的创建等。

```java
package com.example.kafka;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class KafkaDemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(KafkaDemoApplication.class, args);
    }
}
```

#### 7.4.5 生产者：通过 REST 接口发送消息

**这段代码做了什么**：提供一个 HTTP 接口，浏览器或 Postman 调用后，将消息发送到 Kafka。`KafkaTemplate` 是 Spring Kafka 提供的封装类，比直接创建 `KafkaProducer` 简单得多。

```java
package com.example.kafka.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/kafka")
public class MessageController {

    // KafkaTemplate 是 Spring 自动注入的生产者封装
    // 泛型 <String, String> 表示 Key 和 Value 都是字符串
    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    // POST http://localhost:8080/kafka/send?message=你好
    @PostMapping("/send")
    public String sendMessage(@RequestParam String message) {
        // 第一个参数是 Topic，第二个参数是消息内容
        // Spring 会自动处理序列化、网络发送、异常重试等
        kafkaTemplate.send("my-topic", message);
        return "消息已发送: " + message;
    }
}
```

> 📸 **测试方法**：启动应用后，在浏览器访问 `http://localhost:8080/kafka/send?message=Hello` 或用 Postman 发送 POST 请求。应返回 `消息已发送: Hello`。

#### 7.4.6 消费者：监听并处理消息

**这段代码做了什么**：Spring 启动后自动创建一个后台线程，持续监听 `my-topic`，收到消息时自动调用 `listen` 方法。你不需要写任何循环或 poll 逻辑。

```java
package com.example.kafka.service;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class KafkaConsumerService {

    // @KafkaListener 注解让 Spring 自动订阅指定 Topic
    // groupId 必须与配置文件中的一致，或者在这里单独指定
    // 每收到一条消息，Spring 自动调用一次这个方法
    @KafkaListener(topics = "my-topic", groupId = "my-spring-group")
    public void listen(String message) {
        System.out.println("📩 收到消息: " + message);
        // 在这里写你的业务逻辑，比如存数据库、发通知等
    }
}
```

> 📸 **你应该看到**：应用启动后控制台输出类似 `[Consumer clientId=..., groupId=my-spring-group] Subscribed to topic(s): my-topic`。当有消息发送时，会打印 `📩 收到消息: Hello`。

#### 7.4.7 可选：自动创建 Topic

**这段代码做了什么**：Kafka 默认需要手动创建 Topic。这段配置让 Spring Boot 在启动时自动检查并创建指定的 Topic，方便开发和测试。

```java
package com.example.kafka.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaTopicConfig {

    @Bean
    public NewTopic myTopic() {
        return TopicBuilder.name("my-topic")
                .partitions(3)              // 3 个分区，支持并行消费
                .replicas(1)                // 1 个副本（单机环境）
                .build();
    }
}
```


## 八、消费者分组消费机制详解

### 8.1 Consumer Group 核心概念

Consumer Group 是 Kafka 提供的可扩展且具有容错性的消费机制。其核心特点：

- **负载均衡**：Kafka 把订阅的分区均衡分配给组内所有消费者，实现并行处理
- **容错性**：消费者故障时，分区自动重新分配给组内其他消费者
- **可扩展性**：增加消费者实例可提升消费能力
- **独立消费**：不同 Consumer Group 可独立消费同一 Topic 的数据

### 8.2 分区分配策略

Kafka 提供四种内置分区分配策略：

| 策略 | 说明 |
|------|------|
| **Range 策略** | 按消费者总数和分区总数整除运算分配，可能导致分配不均 |
| **Round-Robin 策略** | 轮询分配，消费者间轮流分配分区 |
| **Sticky 策略** | 粘性策略，尽量保持分区分配均匀，且尽可能与上一次分配一致 |
| **CooperativeSticky 策略** | 协作粘性策略（Kafka 2.4+），支持增量再平衡，减少停顿时间 |

> 💡 **Kafka 2.4 起默认策略已变更**：`partition.assignment.strategy` 默认值从 `RangeAssignor` 改为 `RangeAssignor, CooperativeStickyAssignor`。CooperativeSticky 策略支持增量再平衡（Incremental Rebalance），消费者在再平衡期间不需要全部停止消费。

### 8.3 再平衡（Rebalance）

当消费者组中的消费者实例发生变化时（新增或退出），Kafka 会自动重新分配分区。再平衡期间，该消费者组暂时无法消费消息。

**触发再平衡的条件**：
- 消费者加入或退出消费者组
- 消费者心跳超时（`session.timeout.ms`）被踢出
- 消费者处理超时（`max.poll.interval.ms`）被踢出
- 订阅的 Topic 列表发生变化
- Topic 的分区数发生变化（`kafka-topics.sh --alter --partitions`）
- 消费者组 Coordinator 变更

#### 8.3.1 再均衡监听器（Rebalance Listener）

再均衡发生时，消费者可以在分区被撤销前保存状态、提交偏移量，在分区分配后恢复状态。

```java
consumer.subscribe(Arrays.asList("topic"), new ConsumerRebalanceListener() {
    @Override
    public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
        // 分区被撤销前，提交当前offset
        consumer.commitSync();
    }

    @Override
    public void onPartitionsAssigned(Collection<TopicPartition> partitions) {
        // 新分区分配后，可初始化状态
        for (TopicPartition tp : partitions) {
            consumer.seek(tp, getOffsetFromDB(tp)); // 自定义位移
        }
    }
});
```

### 8.4 消费者位移管理详解

#### 8.4.1 位移（Offset）与提交

Kafka 中消费者使用 `offset` 记录每个分区已消费的位置。位移提交是指消费者将当前处理到的 offset 持久化到 Kafka 内部主题 `__consumer_offsets` 中，以便重启或再均衡后从上次位置继续消费。

**提交方式对比：**

| 提交方式 | 说明 | 优点 | 缺点 |
|---------|------|------|------|
| 自动提交 | `enable.auto.commit=true`，按固定间隔提交 | 简单，无需编码 | 可能重复消费或丢失消息 |
| 同步手动提交 | `consumer.commitSync()` | 可靠，可捕获异常重试 | 阻塞，影响吞吐量 |
| 异步手动提交 | `consumer.commitAsync()` | 不阻塞，吞吐量高 | 无重试，可能提交失败不感知 |
| 精确分区提交 | 指定 TopicPartition 和 offset 提交 | 灵活控制每个分区进度 | 实现复杂 |

#### 8.4.2 同步与异步提交示例

**同步提交示例：**
```java
while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    for (ConsumerRecord<String, String> record : records) {
        // 处理消息
    }
    consumer.commitSync(); // 处理完一批后提交
}
```

**异步提交 + 回调：**
```java
consumer.commitAsync(new OffsetCommitCallback() {
    @Override
    public void onComplete(Map<TopicPartition, OffsetAndMetadata> offsets, Exception e) {
        if (e != null) {
            log.error("提交失败", e);
        }
    }
});
```


## 九、生产者拦截机制详解

### 9.1 拦截器概述

Kafka 提供两种拦截器：
- **生产者拦截器（ProducerInterceptor）**：在消息发送前拦截和修改消息
- **消费者拦截器（ConsumerInterceptor）**：在消息消费前拦截和修改消息

### 9.2 ProducerInterceptor 核心方法

**onSend()**：在序列化和分配分区之前调用，允许修改消息。修改 key/value 会影响分区分配。

**onAcknowledgement()**：在消息确认后或发送失败时调用，在用户回调之前执行。

### 9.3 拦截器链

多个拦截器按配置顺序执行：
- 第一个拦截器获取客户端传入的记录
- 下一个拦截器获取前一个拦截器返回的记录
- 任一拦截器抛出异常会被捕获并记录，不影响后续拦截器

### 9.4 使用示例

```java
public class CustomProducerInterceptor 
    implements ProducerInterceptor<String, String> {
    
    @Override
    public ProducerRecord<String, String> onSend(
            ProducerRecord<String, String> record) {
        // 在发送前修改消息
        String newValue = "[intercepted] " + record.value();
        return new ProducerRecord<>(record.topic(), 
            record.key(), newValue);
    }
    
    @Override
    public void onAcknowledgement(RecordMetadata metadata, 
            Exception exception) {
        // 统计或日志
    }
    
    @Override
    public void close() {}
    
    @Override
    public void configure(Map<String, ?> configs) {}
}
```

### 9.5 消费者拦截器使用示例

类似生产者，消费者也支持拦截器，实现 `ConsumerInterceptor` 接口。

```java
public class CustomConsumerInterceptor implements ConsumerInterceptor<String, String> {
    @Override
    public ConsumerRecords<String, String> onConsume(ConsumerRecords<String, String> records) {
        // 可以在消费前过滤或修改消息
        Map<TopicPartition, List<ConsumerRecord<String, String>>> filtered = new HashMap<>();
        for (TopicPartition tp : records.partitions()) {
            List<ConsumerRecord<String, String>> list = new ArrayList<>();
            for (ConsumerRecord<String, String> rec : records.records(tp)) {
                if (!rec.value().contains("skip")) {
                    list.add(rec);
                }
            }
            filtered.put(tp, list);
        }
        return new ConsumerRecords<>(filtered);
    }

    @Override
    public void onCommit(Map<TopicPartition, OffsetAndMetadata> offsets) {
        // 提交offset时的回调
    }

    @Override
    public void close() {}

    @Override
    public void configure(Map<String, ?> configs) {}
}
```

配置消费者时添加 `interceptor.classes=com.example.CustomConsumerInterceptor`。


## 十、消息序列化机制详解

### 10.1 序列化原理

序列化是将数据结构或对象状态转换为可以存储或传输的格式的过程。在 Kafka 中，序列化是将消息对象转换为字节流，以便在网络中传输。

### 10.2 内置序列化器

Kafka 提供了多种内置序列化器：
- `StringSerializer`：字符串序列化
- `IntegerSerializer`：整数序列化
- `ByteArraySerializer`：字节数组序列化
- `LongSerializer`、`DoubleSerializer` 等

### 10.3 自定义序列化器

实现 `org.apache.kafka.common.serialization.Serializer` 接口：

```java
public class UserSerializer implements Serializer<User> {
    @Override
    public byte[] serialize(String topic, User data) {
        // 将 User 对象转换为字节数组
        // 例如使用 JSON 或 Protobuf
        return jsonBytes;
    }
}
```


## 十一、消息分区路由机制详解

### 11.1 分区路由策略

生产者发送消息时，根据以下规则决定目标分区：

1. **指定分区**：若消息中指定了分区，直接发送到该分区
2. **有 Key**：若未指定分区但有 Key，对 Key 进行 Hash 计算路由到分区（同一 Key 始终进入同一分区）
3. **无 Key**：若既未指定分区也无 Key，使用轮询（Round-Robin）或粘性分区策略

### 11.2 自定义分区器

实现 `org.apache.kafka.clients.producer.Partitioner` 接口：

```java
public class CustomPartitioner implements Partitioner {
    @Override
    public int partition(String topic, Object key, byte[] keyBytes,
            Object value, byte[] valueBytes, Cluster cluster) {
        // 自定义分区逻辑
        return partitionIndex;
    }
}
```

### 11.3 消费者端分区分配

消费者可通过 `assign()` 方法指定消费特定分区：

```java
consumer.assign(Arrays.asList(
    new TopicPartition("my-topic", 0)
));
```

### 11.4 Sticky 分区策略（粘性分区）

Kafka 2.4 开始默认使用 Sticky 分区策略。当消息没有 key 时：

> ⚠️ **Kafka 3.4+ 变更**：`DefaultPartitioner` 在 Kafka 3.4（KIP-794）中被废弃，推荐使用 `org.apache.kafka.clients.producer.UniformStickyPartitioner`。3.4+ 的默认分区器已自动切换为 UniformStickyPartitioner，无需手动配置。

- **之前版本（轮询）**：每条消息轮流分配到不同分区，可能导致许多小批次，网络开销大。
- **Sticky 策略**：将一批消息发送到同一个分区，直到该批满或 `linger.ms` 到时间，再切换到下一个分区。这样可以在保证分区负载均衡的同时提高批量效率。

**配置自定义分区器**（保持原有粘性逻辑并扩展）：
```java
props.put(ProducerConfig.PARTITIONER_CLASS_CONFIG, "com.example.MyStickyPartitioner");
```


## 十二、生产者消息缓存机制详解

### 12.1 RecordAccumulator

Kafka 为了提高吞吐量，将消息暂时缓存起来，满足一定条件后再批量发送。缓存消息的组件是 **RecordAccumulator**。

### 12.2 缓存模型

- 按 **TopicPartition** 维度将消息放入不同的 Deque 队列
- **ProducerBatch**：同一个批次的消息，真正发送时以 Batch 为单位
- 找不到对应队列则创建新队列
- 找到队尾 Batch 且空间足够则追加，否则创建新 Batch

### 12.3 关键配置

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `buffer.memory` | 32MB | 生产者可用的总缓存内存 |
| `batch.size` | 16KB | 每个 Batch 的大小 |
| `linger.ms` | 0ms（3.x）/ 5ms（4.0+） | 发送前等待更多消息的时间 |

### 12.4 内存分配逻辑

创建 ProducerBatch 时，内存大小取 `batch.size` 和消息预估大小的较大值。如果生产者发送速度超过服务器处理速度，缓存会耗尽，`send()` 方法会被阻塞。

### 12.5 发送线程与网络模型

Kafka 生产者的内存缓冲区由 `RecordAccumulator` 管理，真正执行网络发送的是一个独立的 `Sender` 线程。

**工作流程：**
1. 应用线程调用 `send()`，消息进入 RecordAccumulator。
2. `Sender` 线程定期检查是否有 ready 的批次：
   - 该批次对应的 Broker 连接已建立且没有未完成的元数据更新请求；
   - `batch.size` 已满或 `linger.ms` 超时。
3. Sender 将就绪的批次按 Broker 分组，通过 NIO 网络发送。
4. 等待 Broker 响应，根据 `acks` 配置决定是否重试。

**关键参数补充：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max.block.ms` | 60000 | `send()` 或 `partitionsFor()` 最大阻塞时间（缓冲区满时） |
| `retries` | 2147483647 (2.1之后) | 发送失败重试次数 |
| `retry.backoff.ms` | 100 | 重试间隔 |
| `max.in.flight.requests.per.connection` | 5 | 单个连接上最多未确认请求数，设为1可保证顺序 |


## 十三、生产者发送应答机制详解

### 13.1 ACKS 参数

`acks` 参数控制生产者要求 Leader 在认为请求完成前收到的确认数量。

| 值 | 行为 | 可靠性 | 延迟 |
|----|------|--------|------|
| **0** | 不等待任何确认，消息直接加入 socket buffer 即视为已发送 | 最低 | 最低 |
| **1** | Leader 写入本地日志即返回确认，不等 Follower | 中等 | 中等 |
| **all / -1**（默认，Kafka 3.0+） | Leader 等待所有 ISR 副本确认 | 最高 | 最高 |

> 💡 **Kafka 3.0 重要变更**：自 Kafka 3.0（KIP-679）起，`acks` 默认值从 `1` 改为 `all`，同时 `enable.idempotence` 默认改为 `true`。这意味着 Kafka 3.0+ 的生产者默认就是"最安全"模式，无需手动配置。

### 13.2 选择建议

- `acks=0`：可容忍数据丢失，追求极致吞吐的场景
- `acks=1`：Kafka 2.x 默认，平衡可靠性与性能（3.0+ 已不再推荐）
- `acks=all`：Kafka 3.0+ 默认，金融、交易等对数据一致性要求极高的场景


## 十四、生产者消息幂等性详解

### 14.1 什么是幂等性

幂等性是指对同一个操作执行多次，其结果与执行一次完全一致。在 Kafka 中，即使因网络波动等原因导致消息重复发送，Broker 最终也只会持久化一条相同的消息。

### 14.2 实现原理

Kafka 幂等性基于 **PID（Producer ID）** 和 **Sequence Number（序列号）** 两大核心要素：

- **PID**：每个生产者实例初始化时向集群申请唯一 ID
- **Sequence Number**：每个 PID 和 Partition 的消息序列号单调递增
- **Broker 端校验**：维护“期望的下一个序列号”，收到消息时比对
  - 序列号 = 期望值：接受，期望值+1
  - 序列号 < 期望值：重复消息，丢弃
  - 序列号 > 期望值：乱序或丢失，抛异常

### 14.3 启用方式

```properties
# Kafka 3.0+ 已默认启用，无需手动配置
# Kafka 2.x 需要手动开启：
enable.idempotence=true
```

> 💡 **Kafka 3.0 起默认启用**：自 Kafka 3.0（KIP-679）起，`enable.idempotence` 默认为 `true`，同时 `acks` 默认改为 `all`、`retries` 默认改为 `Integer.MAX_VALUE`。如果你使用的是 Kafka 3.0+，无需手动配置幂等性。

### 14.4 作用范围

| 场景 | 是否幂等 | 原因 |
|------|----------|------|
| 单分区 | ✅ 是 | Sequence Number 顺序递增 |
| 多分区 | ❌ 否 | Sequence Number 仅分区级 |
| 重启 Producer | ❌ 否 | PID 重新生成 |

跨分区原子性需要事务机制。

### 14.5 幂等性的局限性及与事务的关系

- **幂等性无法跨分区**：对于 `enable.idempotence=true` 的生产者，发送到分区0的消息和分区1的消息是独立的序列号，无法保证跨分区原子性。
- **幂等性无法跨会话**：生产者重启后生成新 PID，无法识别上次未完成的消息是否被 Broker 重复写入。
- **事务是幂等性的超集**：开启事务前必须启用幂等性，事务通过 Transactional ID 关联不同生产者实例，实现跨会话的精确一次语义。


## 十五、消息压缩机制详解

### 15.1 压缩原理

Kafka 采用 **端到端的批量压缩**：Producer 端将多条消息合并为 Batch 并压缩，Broker 端原样存储压缩数据，Consumer 端消费时自动解压缩。

### 15.2 压缩算法对比

| 算法 | 压缩率 | 速度 | CPU 消耗 | 适用场景 |
|------|--------|------|----------|----------|
| **Gzip** | 最高（30%-90%） | 慢 | 高 | 带宽受限场景 |
| **Snappy** | 中等（30%-60%） | 快 | 中 | 高吞吐场景 |
| **Lz4** | 较低（20%-50%） | 最快 | 最低 | 低延迟场景 |
| **Zstd** | 平衡 | 快 | 中 | 兼顾压缩率和性能 |

### 15.3 配置方式

```properties
compression.type=snappy
```

### 15.4 注意事项

- Broker 一般不会主动解压缩，仅做存储和转发
- 若 Producer 与 Broker 的压缩算法不一致，Broker 会解压后重新压缩，增加 CPU 负载

### 15.5 日志压缩（Log Compaction）

除了基于时间和大小的日志保留策略，Kafka 还支持 **Log Compaction**，用于保留每个 key 的最新值，常用于变更数据捕获（CDC）、状态存储。

**配置示例（创建 Compact Topic）：**
```bash
bin/kafka-topics.sh --create --topic db-changelog \
  --bootstrap-server localhost:9092 \
  --partitions 3 --replication-factor 3 \
  --config cleanup.policy=compact \
  --config min.cleanable.dirty.ratio=0.5
```

- `cleanup.policy=compact`：启用压缩，保留相同 key 的最新值。
- `min.cleanable.dirty.ratio`：脏日志比例阈值，触发清理。
- 删除旧版本时，保留 key 的最新记录和带有 null 值的“墓碑消息”（可配置保留时间）。


## 十六、消息事务机制详解

### 16.1 为什么需要事务

Kafka 在 0.11.0.0 引入事务机制，解决以下痛点：
- **跨会话重复消息**：Producer 重启后重试导致消息重复
- **跨分区原子性缺失**：一批消息写入多个 Topic/Partition，部分失败无法回滚

### 16.2 事务的四大核心目标

| 目标 | 说明 |
|------|------|
| **原子性** | 一组消息要么全部成功，要么全部失败 |
| **跨会话幂等** | Producer 重启后仍能识别并去重未完成的事务 |
| **一致性** | consume-process-produce 模式下消费位点与下游结果一致 |
| **隔离性** | 事务未提交的消息对消费者不可见 |

### 16.3 事务 API

| 方法 | 作用 |
|------|------|
| `initTransactions()` | 注册 transactional.id，初始化 |
| `beginTransaction()` | 开启事务 |
| `sendOffsetsToTransaction()` | 将消费者 offset 作为事务的一部分提交 |
| `commitTransaction()` | 提交事务 |
| `abortTransaction()` | 回滚事务 |

### 16.4 事务运行流程（轻量级 2PC）

Kafka 基于内部 Topic `__transaction_state` 实现轻量级两阶段提交：

1. Producer 向 Transaction Coordinator 注册 transactional.id
2. Coordinator 在 `__transaction_state` 记录事务状态（BEGIN）
3. Producer 发送消息到目标分区
4. 提交时，Coordinator 更新状态为 PREPARE → COMMITTED
5. 回滚时更新为 ABORTED

### 16.5 消费者事务隔离级别

消费者通过 `isolation.level` 控制对事务性消息的可见性：

| 值 | 说明 |
|----|------|
| `read_uncommitted`（默认） | 可读取未提交的事务消息，延迟低但可能读到最终回滚的数据 |
| `read_committed` | 仅读取已提交的事务消息，保证事务一致性，延迟略高 |

事务场景下的消费者配置：
```properties
isolation.level=read_committed
```

如果生产者回滚事务，在 `read_committed` 模式下，消费者不会看到回滚的消息，offset 会平滑跳过。

### 16.6 完整事务示例：consume-process-produce

事务最核心的使用场景是 **consume-process-produce** 模式：从一个 Topic 消费消息，经过业务处理后，将结果写入另一个 Topic，同时提交消费位移——这三步在一个事务中要么全部成功，要么全部失败。

#### 配置

```properties
# producer-transactional.properties
bootstrap.servers=localhost:9092
# ⚠️ transactional.id 必须唯一且稳定，不要用随机值
transactional.id=my-transactional-app-001
# 开启事务前必须启用幂等性
enable.idempotence=true
acks=all
```

#### 完整代码

```java
package com.example.kafka.transaction;

import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.common.TopicPartition;

import java.time.Duration;
import java.util.*;

public class ConsumeProcessProduceExample {

    public static void main(String[] args) {
        // =====================================================
        // 1. 创建事务型生产者
        // =====================================================
        Properties producerProps = new Properties();
        producerProps.put("bootstrap.servers", "localhost:9092");
        producerProps.put("transactional.id", "my-transactional-app-001");
        producerProps.put("enable.idempotence", "true");
        producerProps.put("acks", "all");
        producerProps.put("key.serializer",
            "org.apache.kafka.common.serialization.StringSerializer");
        producerProps.put("value.serializer",
            "org.apache.kafka.common.serialization.StringSerializer");

        KafkaProducer<String, String> producer = new KafkaProducer<>(producerProps);
        // 初始化事务（必须在发送任何消息之前调用一次）
        producer.initTransactions();

        // =====================================================
        // 2. 创建消费者
        // =====================================================
        Properties consumerProps = new Properties();
        consumerProps.put("bootstrap.servers", "localhost:9092");
        consumerProps.put("group.id", "txn-consumer-group");
        consumerProps.put("enable.auto.commit", "false");  // 事务模式下必须关闭自动提交
        consumerProps.put("isolation.level", "read_committed");  // 只读已提交数据
        consumerProps.put("auto.offset.reset", "earliest");
        consumerProps.put("key.deserializer",
            "org.apache.kafka.common.serialization.StringDeserializer");
        consumerProps.put("value.deserializer",
            "org.apache.kafka.common.serialization.StringDeserializer");

        KafkaConsumer<String, String> consumer = new KafkaConsumer<>(consumerProps);
        consumer.subscribe(Arrays.asList("input-topic"));

        // =====================================================
        // 3. consume → process → produce 循环
        // =====================================================
        // 注册 shutdown hook，确保 Ctrl+C 时优雅关闭资源
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\n🛑 正在关闭...");
            producer.close();
            consumer.close();
            System.out.println("✅ 已关闭");
        }));

        System.out.println("🚀 事务型消费者-生产者已启动...");

        while (true) {
            ConsumerRecords<String, String> records =
                consumer.poll(Duration.ofMillis(1000));

            if (records.isEmpty()) {
                continue;
            }

            try {
                // 开启事务
                producer.beginTransaction();

                // 将本批次的分区和 offset 收集起来，用于事务性提交
                Map<TopicPartition, OffsetAndMetadata> offsets = new HashMap<>();

                for (ConsumerRecord<String, String> record : records) {
                    // ---- 业务处理 ----
                    String processedValue = processMessage(record.value());

                    // 将处理结果发送到输出 Topic
                    producer.send(new ProducerRecord<>(
                        "output-topic",
                        record.key(),
                        processedValue
                    )).get();  // 同步等待，确保发送成功

                    // 记录已处理的 offset
                    offsets.put(
                        new TopicPartition(record.topic(), record.partition()),
                        new OffsetAndMetadata(record.offset() + 1)
                    );
                }

                // 将消费位移作为事务的一部分提交
                // 这保证了：如果事务回滚，消费位移也不会被提交，消息会被重新消费
                producer.sendOffsetsToTransaction(
                    offsets,
                    consumer.groupMetadata()
                );

                // 提交事务：所有发送的消息 + 消费位移一起生效
                producer.commitTransaction();
                System.out.println("✅ 事务提交成功，处理了 " + records.count() + " 条消息");

            } catch (Exception e) {
                // 事务回滚：所有发送的消息作废，消费位移不提交，消息会被重新消费
                System.err.println("❌ 事务失败，回滚: " + e.getMessage());
                producer.abortTransaction();
            }
        }
    }

    /** 模拟业务处理逻辑 */
    private static String processMessage(String value) {
        // 示例：转大写、添加时间戳等
        return value.toUpperCase() + " [processed]";
    }
}
```

#### 事务流程图

```
消费 input-topic          业务处理              写入 output-topic       提交事务
     │                      │                       │                     │
     ▼                      ▼                       ▼                     ▼
┌──────────┐  ┌───────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ poll()   │→ │ 处理每条消息       │→ │ producer.send()  │→ │ commitTransaction│
│ 拉取消息  │  │ 转换/过滤/计算    │  │ 发送处理结果      │  │ 消息+offset 同时 │
└──────────┘  └───────────────────┘  └──────────────────┘  │ 生效             │
                                                           └──────────────────┘
如果任何一步失败 → abortTransaction()
  → output-topic 中的消息对其他消费者不可见
  → 消费位移不提交，消息会被重新消费
```

> 💡 **关键点**：
> - `enable.auto.commit` 必须设为 `false`，由事务统一管理位移提交
> - `isolation.level=read_committed` 确保下游消费者只看到已提交的事务消息
> - `transactional.id` 必须稳定且唯一，重启后保持不变才能实现跨会话幂等
> - `sendOffsetsToTransaction()` 是实现"消费位移与生产结果原子绑定"的关键调用

### 16.7 事务超时与僵尸生产者 Fencing

- **transaction.timeout.ms**：事务最大持续时间，默认 60000ms。超时后 Transaction Coordinator 会终止事务并回滚。
- **僵尸生产者问题**：生产者因网络分区或长时间 GC 被认为已死，恢复后可能持有相同的 transactional.id 重复发送事务消息。
- **Fencing 机制**：每个 transactional.id 注册时会分配一个递增的 epoch。原生产者恢复后重新注册时，epoch 递增，任何携带旧 epoch 的请求都会被拒绝，从而防止僵尸实例写入。


## 十七、Spring Boot 集成 Kafka（高级配置）

> 基础的 Spring Boot + Kafka 集成（依赖、配置、生产者、消费者、Topic 自动创建）已在第七章 7.4 节详细介绍，本章只补充高级配置和生产环境常用模式。

#### 17.1.1 错误处理与重试

Spring Kafka 提供 `SeekToCurrentErrorHandler` 和 `DefaultErrorHandler`（2.8 之后）处理消费失败后的重试和死信。

```java
@Bean
public DefaultErrorHandler errorHandler(KafkaTemplate<String, String> kafkaTemplate) {
    // 重试3次，间隔1秒，然后发送到死信主题
    return new DefaultErrorHandler(
        (record, exception) -> {
            // 发送到 dead-letter-topic
            kafkaTemplate.send("my-topic.DLT", record.key(), record.value());
        },
        new FixedBackOff(1000L, 3)
    );
}

@Bean
public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory(
        ConsumerFactory<String, String> consumerFactory, DefaultErrorHandler errorHandler) {
    var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
    factory.setConsumerFactory(consumerFactory);
    factory.setCommonErrorHandler(errorHandler);
    return factory;
}
```

#### 17.1.2 批量消费

```java
@Bean
public ConcurrentKafkaListenerContainerFactory<String, String> batchFactory(
        ConsumerFactory<String, String> consumerFactory) {
    var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
    factory.setConsumerFactory(consumerFactory);
    factory.setBatchListener(true); // 开启批量监听
    return factory;
}

@KafkaListener(topics = "my-topic", containerFactory = "batchFactory")
public void listen(List<String> messages) {
    messages.forEach(msg -> System.out.println("批量消息: " + msg));
}
```

#### 17.1.3 通过 @SendTo 实现 consume-process-produce

```java
@KafkaListener(topics = "input")
@SendTo("output")  // 方法返回值自动发送到 output 主题
public String process(String message) {
    return message.toUpperCase();
}
```

### 17.2 事务支持

Spring Boot 用户可以使用声明式或编程式事务：

```java
// 编程式事务
@Service
public class TransactionalProducerService {
    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    public void sendInTransaction(String topic, String message) {
        kafkaTemplate.executeInTransaction(operations -> {
            operations.send(topic, message);
            return null;
        });
    }
}
```

```yaml
# application.yml 中启用事务
spring:
  kafka:
    producer:
      transaction-id-prefix: tx-
    consumer:
      isolation-level: read_committed
```

### 17.3 测试支持

Spring for Apache Kafka 提供 `@EmbeddedKafka` 注解，可方便地使用嵌入式 Kafka Broker 进行测试：

```java
@SpringBootTest
@EmbeddedKafka(partitions = 1, topics = {"test-topic"})
class KafkaProducerServiceTest {

    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    @Test
    void testSendMessage() {
        kafkaTemplate.send("test-topic", "test-message");
        // 验证消息是否发送成功
    }
}
```

```xml
<!-- 测试依赖 -->
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka-test</artifactId>
    <scope>test</scope>
</dependency>
```


## 十八、Kafka Streams 流处理

> Kafka Streams 是 Kafka 官方提供的客户端库，用于构建流处理应用。它不需要额外的集群——你的应用本身就是一个流处理引擎，直接嵌入到 Java/Spring Boot 应用中即可。

### 18.1 Kafka Streams 是什么

Kafka Streams 解决的问题：**数据已经在 Kafka 里了，你不想再搬出去处理完搬回来，而是直接在 Kafka 内部完成实时计算。**

```
传统方式：
Kafka → 消费者 → 外部计算引擎（Flink/Spark） → 结果写回 Kafka

Kafka Streams 方式：
Kafka → Streams 应用（内嵌在你的 Java 程序中） → 结果写回 Kafka
```

**核心优势**：
- 无需独立集群，就是一个普通的 Java 库
- 支持精确一次语义（EOS）
- 自动处理容错和状态恢复
- 支持事件时间窗口处理

### 18.2 核心概念

| 概念 | 说明 | 生活比喻 |
|------|------|----------|
| **KStream** | 无界记录流，每条消息是独立事件 | 水龙头流出的水滴，每一滴都是独立的 |
| **KTable** | 变更日志流，每条消息是某个 Key 的最新状态 | 数据库的一张表，每个 Key 只保留最新值 |
| **GlobalKTable** | 每个实例都持有全量数据的 KTable | 每个人手上都有一份完整的通讯录 |
| **Topology** | 处理逻辑的有向无环图（DAG） | 工厂的流水线，定义了从原料到成品的每一步 |
| **State Store** | 本地状态存储，用于聚合和窗口操作 | 流水线旁边的仓库，存放中间产品 |

### 18.3 依赖配置

```xml
<dependency>
    <groupId>org.apache.kafka</groupId>
    <artifactId>kafka-streams</artifactId>
    <version>3.4.0</version>
</dependency>
```

### 18.4 Word Count 示例（最经典的流处理入门）

```java
package com.example.kafka.streams;

import org.apache.kafka.common.serialization.Serdes;
import org.apache.kafka.streams.*;
import org.apache.kafka.streams.kstream.*;

import java.util.Arrays;
import java.util.Properties;

public class WordCountExample {
    public static void main(String[] args) {
        // =====================================================
        // 1. 配置 Streams 应用
        // =====================================================
        Properties props = new Properties();
        // 应用 ID，用于标识消费者组和状态存储目录
        props.put(StreamsConfig.APPLICATION_ID_CONFIG, "word-count-app");
        props.put(StreamsConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        // Key/Value 的默认序列化/反序列化
        props.put(StreamsConfig.DEFAULT_KEY_SERDE_CLASS_CONFIG, Serdes.StringSerde.class);
        props.put(StreamsConfig.DEFAULT_VALUE_SERDE_CLASS_CONFIG, Serdes.StringSerde.class);

        // =====================================================
        // 2. 定义处理拓扑（Topology）
        // =====================================================
        StreamsBuilder builder = new StreamsBuilder();

        // 从 "sentences" Topic 读取消息
        KStream<String, String> sentences = builder.stream("sentences");

        KTable<String, Long> wordCounts = sentences
            // 按空格拆分单词（一行变多行）
            .flatMapValues(line -> Arrays.asList(line.toLowerCase().split("\\W+")))
            // 以单词作为 Key
            .map((key, word) -> KeyValue.pair(word, word))
            // 按 Key 分组
            .groupByKey()
            // 统计每个单词出现的次数
            .count();

        // 将结果写入 "word-count-output" Topic
        wordCounts.toStream().to("word-count-output",
            Produced.with(Serdes.String(), Serdes.Long()));

        // =====================================================
        // 3. 启动 Streams 应用
        // =====================================================
        KafkaStreams streams = new KafkaStreams(builder.build(), props);

        // 优雅退出：Ctrl+C 时关闭应用
        Runtime.getRuntime().addShutdownHook(new Thread(streams::close));

        streams.start();
        System.out.println("🚀 Word Count Streams 应用已启动");
    }
}
```

**运行流程**：
```
输入 ("sentences" Topic)               输出 ("word-count-output" Topic)
┌─────────────────────┐                ┌─────────────────────┐
│ "hello kafka"       │                │ "hello" → 1         │
│ "hello world"       │   ──处理──→    │ "kafka" → 1         │
│ "kafka streams"     │                │ "world" → 1         │
└─────────────────────┘                │ "streams" → 1       │
                                       └─────────────────────┘
```

### 18.5 KStream vs KTable

**KStream**：每条消息都是独立事件，适合处理日志、点击流等。

```java
// KStream：同样的 Key 会产生多条记录
KStream<String, String> clicks = builder.stream("user-clicks");
// 输入：user1=click_A, user1=click_B → 两条独立记录
```

**KTable**：每个 Key 只保留最新值，适合处理数据库变更日志（CDC）。

```java
// KTable：同样的 Key 只保留最新值
KTable<String, String> profiles = builder.table("user-profiles");
// 输入：user1=Alice, user1=Bob → user1 的值变为 Bob
```

**互转**：
```java
// KStream → KTable（按 Key 聚合）
KTable<String, Long> pageViews = clickStream
    .groupByKey()
    .count();

// KTable → KStream（发出变更事件）
KStream<String, String> changes = profiles.toStream();
```

### 18.6 窗口操作

窗口操作用于"在一段时间范围内聚合数据"。

#### 滚动窗口（Tumbling Window）
固定大小、不重叠。比如每 5 分钟统计一次点击量。

```java
KTable<Windowed<String>, Long> windowedCounts = clicks
    .groupByKey()
    .windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5)))
    .count();
```

```
时间轴：  |--窗口1--|--窗口2--|--窗口3--|
          0-5min   5-10min  10-15min
```

#### 滑动窗口（Hopping Window）
固定大小、可重叠。比如每 1 分钟统计过去 5 分钟的数据。

```java
.windowedBy(TimeWindows.ofSizeWithNoGrace(Duration.ofMinutes(5))
    .advanceBy(Duration.ofMinutes(1)))
```

#### 会话窗口（Session Window）
根据活动间隔动态调整窗口大小。比如用户 30 分钟没有操作就关闭会话。

```java
.windowedBy(SessionWindows.ofInactivityGapWithNoGrace(Duration.ofMinutes(30)))
```

### 18.7 Spring Boot 集成 Kafka Streams

```java
@Configuration
public class StreamsConfig {

    @Bean
    public KStream<String, String> kStream(StreamsBuilder builder) {
        KStream<String, String> stream = builder.stream("input-topic");

        stream
            .filter((key, value) -> value != null && !value.isEmpty())
            .mapValues(value -> value.toUpperCase())
            .to("output-topic");

        return stream;
    }
}
```

```yaml
# application.yml
spring:
  kafka:
    streams:
      application-id: my-streams-app
      bootstrap-servers: localhost:9092
      properties:
        default.key.serde: org.apache.kafka.common.serialization.Serdes$StringSerde
        default.value.serde: org.apache.kafka.common.serialization.Serdes$StringSerde
        commit.interval.ms: 1000
```


## 十九、Kafka Connect 数据集成

> Kafka Connect 是 Kafka 生态中的数据集成框架，用于在 Kafka 与外部系统（数据库、文件系统、搜索引擎等）之间高效传输数据，无需编写代码。

### 19.1 Kafka Connect 是什么

**问题**：你有一个 MySQL 数据库，想把表数据实时同步到 Kafka，再从 Kafka 同步到 Elasticsearch。写两个消费者+生产者程序？太麻烦，还要处理容错、分区、偏移量……

**Kafka Connect 的做法**：只需要一个 JSON 配置文件，声明数据从哪来、到哪去，Kafka Connect 自动处理数据传输、容错、扩展。

```
┌──────────┐    ┌───────────────┐    ┌──────────┐    ┌───────────────┐    ┌──────────────┐
│  MySQL   │ →  │ Source        │ →  │  Kafka   │ →  │ Sink          │ →  │ Elasticsearch│
│  数据库   │    │ Connector     │    │  Topics  │    │ Connector     │    │ 搜索引擎      │
└──────────┘    └───────────────┘    └──────────┘    └───────────────┘    └──────────────┘
                 读取 MySQL binlog                      从 Topic 读取
                 写入 Kafka Topic                       写入 Elasticsearch
```

### 19.2 两种运行模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **Standalone** | 单进程运行，配置简单 | 开发测试、小规模数据同步 |
| **Distributed** | 多节点集群运行，自动容错和负载均衡 | 生产环境 |

### 19.3 Standalone 模式快速体验

以 Kafka 自带的 **File Source** 和 **File Sink** Connector 为例，演示数据从文件 → Kafka → 文件的完整流程。

**第一步：准备测试文件**

```bash
# 创建输入文件
echo -e "Hello Kafka Connect\nThis is line 2\nKafka is awesome" > /tmp/input.txt
```

**第二步：配置 Source Connector**

```properties
# config/connect-file-source.properties
name=file-source
connector.class=FileStreamSource
tasks.max=1
file=/tmp/input.txt
topic=connect-test
```

**第三步：配置 Sink Connector**

```properties
# config/connect-file-sink.properties
name=file-sink
connector.class=FileStreamSink
tasks.max=1
file=/tmp/output.txt
topics=connect-test
```

**第四步：启动 Connect**

```bash
# 启动 Standalone 模式的 Connect Worker
bin/connect-standalone.sh \
  config/connect-standalone.properties \
  config/connect-file-source.properties \
  config/connect-file-sink.properties
```

**第五步：验证**

```bash
# 查看输出文件
cat /tmp/output.txt
# 应该能看到 input.txt 中的内容
```

### 19.4 Distributed 模式（生产环境）

Distributed 模式下，Connector 配置通过 REST API 提交，多个 Worker 节点自动分配任务。

**启动 Distributed Worker**：

```bash
bin/connect-distributed.sh config/connect-distributed.properties
```

**通过 REST API 提交 Source Connector**：

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "mysql-source",
    "config": {
        "connector.class": "io.debezium.connector.mysql.MySqlConnector",
        "database.hostname": "localhost",
        "database.port": "3306",
        "database.user": "root",
        "database.password": "password",
        "database.server.id": "1",
        "database.server.name": "myserver",
        "database.include.list": "mydb",
        "table.include.list": "mydb.users",
        "topic.prefix": "cdc-"
    }
}'
```

**常用 REST API**：

```bash
# 查看所有 Connector
curl http://localhost:8083/connectors

# 查看 Connector 状态
curl http://localhost:8083/connectors/mysql-source/status

# 暂停 Connector
curl -X PUT http://localhost:8083/connectors/mysql-source/pause

# 恢复 Connector
curl -X PUT http://localhost:8083/connectors/mysql-source/resume

# 删除 Connector
curl -X DELETE http://localhost:8083/connectors/mysql-source
```

### 19.5 常用 Connector 推荐

| Connector | 类型 | 用途 | 官方/第三方 |
|-----------|------|------|------------|
| **JDBC Source/Sink** | Source + Sink | 关系型数据库（MySQL、PostgreSQL、Oracle） | 官方 |
| **Debezium MySQL** | Source | MySQL binlog CDC（实时变更捕获） | 第三方 |
| **Debezium PostgreSQL** | Source | PostgreSQL WAL CDC | 第三方 |
| **Elasticsearch Sink** | Sink | 写入 Elasticsearch | 官方 |
| **S3 Sink** | Sink | 写入 Amazon S3 | 官方 |
| **HDFS Sink** | Sink | 写入 Hadoop HDFS | 官方 |
| **MongoDB Sink** | Sink | 写入 MongoDB | 第三方 |

> 💡 **Debezium vs JDBC Source**：JDBC Source 通过轮询表获取变更，无法捕获 DELETE；Debezium 通过读取数据库的 WAL/binlog 实现实时 CDC，能捕获 INSERT/UPDATE/DELETE，推荐生产环境使用 Debezium。

### 19.6 Single Message Transform（SMT）

SMT 允许在消息写入 Kafka 或从 Kafka 读出时进行轻量级转换，无需编写代码。

```json
{
    "name": "mysql-source",
    "config": {
        "connector.class": "io.debezium.connector.mysql.MySqlConnector",
        "transforms": "route,unwrap",
        "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
        "transforms.route.regex": "myserver\\.mydb\\.(.*)",
        "transforms.route.replacement": "orders-$1",
        "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState"
    }
}
```

常用 SMT：
- `ExtractNewRecordState`：提取 Debezium 变更事件中的新记录状态
- `InsertField`：添加静态字段（如环境标识）
- `TimestampRouter`：按时间路由到不同的 Topic
- `RegexRouter`：按正则表达式重命名目标 Topic


## 二十、Kafka 副本机制与高水位

### 20.1 副本与 ISR

每个分区有 1 个 Leader 和多个 Follower 副本。ISR（In-Sync Replicas）是一组与 Leader 保持同步的副本集合。

**成为 ISR 的条件：**
- Follower 与 Leader 的 `replica.lag.time.max.ms` 时间内未掉队（默认 30s）。

### 20.2 LEO 与 HW

- **LEO (Log End Offset)**：每个副本日志的最后一个 offset 的下一个位置。
- **HW (High Watermark)**：ISR 中所有副本 LEO 的最小值，消费者只能拉取到 HW 之前的消息（committed 消息）。

**HW 更新流程（Kafka 2.0+，基于 Leader Epoch）：**

> 💡 Kafka 2.0（KIP-101）起，HW 计算改为 Leader Epoch-based 方案，消除了旧方案中因 HW 截断导致的数据丢失风险。

1. Follower 发送 Fetch 请求，携带自己的 LEO 和当前 Leader Epoch。
2. Leader 返回当前 Leader Epoch 对应的 LEO（Leader Epoch Offset）。
3. Follower 根据 Leader 返回的信息**自行计算本地 HW** = min(本地 LEO, Leader 返回的 Epoch Offset)。
4. 如果 Follower 发现自己的 Leader Epoch 过期，会先截断不一致的日志段，再同步。

> ⚠️ **旧方案（Kafka 2.0 之前）**：Leader 计算 HW 后通过 Fetch 响应传给 Follower。该方案在 Leader 切换时可能导致已提交数据被截断，已在 2.0 后废弃。

### 20.3 Leader Epoch 机制

为了避免副本恢复时因 HW 截断导致日志不一致，Kafka 引入了 Leader Epoch。每次 Leader 变更，epoch 加1，并在日志段中记录 epoch 序列，这样 Follower 可根据 epoch 确定截断点，而非简单依赖 HW。

### 20.4 不清洁 Leader 选举

- `unclean.leader.election.enable`：默认 false，若 ISR 全部宕机，是否允许从非 ISR 副本选举 Leader。
- 开启后可能丢失数据，但可提升可用性；关闭则分区不可用直到 ISR 恢复。


## 二十一、Kafka 控制器与协调器

- **Controller**：Kafka 集群中一个 Broker 充当控制器，负责分区 Leader 选举、ISR 维护、向 Broker 分发元数据等。Controller 选举依赖 ZK 的临时节点（或 KRaft 中的 Raft 选举）。
- **Group Coordinator**：处理消费者组管理（加入组、同步组、偏移量提交）的 Broker。每个消费者组会有一个 Coordinator。
- **Transaction Coordinator**：管理事务，存储事务状态到 `__transaction_state` 主题，分配 producer epoch 和 fencing。


## 二十二、Kafka 日志存储与清理策略

### 22.1 日志目录结构

```
/var/lib/kafka/logs/
  topic-0/
    00000000000000000000.log       # 日志段文件
    00000000000000000000.index     # 偏移量索引
    00000000000000000000.timeindex # 时间索引
    leader-epoch-checkpoint
```

### 22.2 清理策略

- **delete**：按时间或大小删除旧日志段。
- **compact**：保留相同 key 的最新值（详见15.5节日志压缩）。
- `log.retention.hours`（默认 168 小时）和 `log.retention.bytes`（默认 -1，不限制）控制删除策略。


## 二十三、Kafka 安全（SSL/SASL）概述

生产环境建议启用认证、授权和加密。

- **加密**：通过 SSL/TLS 加密客户端与 Broker、Broker 间的数据传输。
- **认证**：
  - SASL/PLAIN：用户名密码，需结合 SSL。
  - SASL/SCRAM：更安全的用户名密码机制。
  - SASL/GSSAPI (Kerberos)：企业级集成。
  - mTLS：双向 SSL 认证。
- **授权**：通过 ACL（访问控制列表）控制用户对主题、消费者组的读写权限。`authorizer.class.name=kafka.security.authorizer.AclAuthorizer`。
- **超级用户**：`super.users` 配置，跳过 ACL 检查。

**Broker 监听器配置示例：**
```
listeners=SSL://:9093,SASL_SSL://:9094
advertised.listeners=SSL://broker1:9093,SASL_SSL://broker1:9094
```


## 二十四、监控与运维常用命令

### 24.1 常用管理命令

- 查看消费者组列表：
  ```bash
  bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list
  ```
- 查看消费者组偏移情况：
  ```bash
  bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group my-group
  ```
- 重置消费者位移到最早：
  ```bash
  bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group my-group --reset-offsets --to-earliest --execute --topic my-topic
  ```
- 查看主题详情：
  ```bash
  bin/kafka-topics.sh --describe --bootstrap-server localhost:9092 --topic my-topic
  ```
- 更改分区数（只能增加）：
  ```bash
  bin/kafka-topics.sh --alter --topic my-topic --partitions 6 --bootstrap-server localhost:9092
  ```

### 24.2 监控指标

- Broker 指标：`kafka.server:type=BrokerTopicMetrics`（MessagesInPerSec, BytesInPerSec）
- 生产者指标：`record-send-rate`, `buffer-available-bytes`
- 消费者指标：`records-consumed-rate`, `records-lag-max`
- 使用 JMX 或 Prometheus + Kafka Exporter 采集。

### 24.3 Prometheus + Grafana 监控实战

#### 第一步：部署 JMX Exporter

JMX Exporter 将 Kafka 的 JMX 指标转换为 Prometheus 格式。

**下载 JMX Exporter**：

```bash
wget https://repo1.maven.org/maven2/io/prometheus/jmx/jmx_prometheus_javaagent/0.19.0/jmx_prometheus_javaagent-0.19.0.jar
mv jmx_prometheus_javaagent-0.19.0.jar /opt/kafka/libs/
```

**创建 JMX Exporter 配置文件 `config/jmx-exporter.yml`**：

```yaml
rules:
  # Broker 指标
  - pattern: kafka.server<type=BrokerTopicMetrics, name=(MessagesInPerSec|BytesInPerSec|TotalProduceRequestsPerSec), topic=(.+)><>Count
    name: kafka_server_brokertopicmetrics_$1_total
    labels:
      topic: "$2"
    type: COUNTER

  - pattern: kafka.server<type=ReplicaManager, name=(UnderReplicatedPartitions|PartitionCount|LeaderCount)><>Value
    name: kafka_server_replicamanager_$1
    type: GAUGE

  # Controller 指标
  - pattern: kafka.controller<type=KafkaController, name=(ActiveControllerCount|OfflinePartitionsCount)><>Value
    name: kafka_controller_$1
    type: GAUGE

  # 请求指标
  - pattern: kafka.network<type=RequestMetrics, name=RequestsPerSec, request=(Produce|FetchConsumer|FetchFollower)><>Count
    name: kafka_network_requestmetrics_requestspersec_$1_total
    type: COUNTER

  # 消费者 Lag
  - pattern: kafka.server<type=FetcherLagMetrics, name=ConsumerLag, clientId=(.+), topic=(.+), partition=(.+)><>Value
    name: kafka_server_fetcherlagmetrics_consumerlag
    labels:
      client_id: "$1"
      topic: "$2"
      partition: "$3"
    type: GAUGE
```

**修改 Kafka 启动脚本，加载 JMX Exporter**：

编辑 `bin/kafka-server-start.sh`，在 `exec` 行之前添加：

```bash
export KAFKA_OPTS="-javaagent:/opt/kafka/libs/jmx_prometheus_javaagent-0.19.0.jar=7071:/opt/kafka/config/jmx-exporter.yml"
```

> 💡 `7071` 是 JMX Exporter 的 HTTP 端口，Prometheus 将从这个端口拉取指标。

**重启 Kafka 并验证**：

```bash
bin/kafka-server-start.sh config/server.properties

# 验证指标暴露
curl http://localhost:7071/metrics | head -20
```

#### 第二步：配置 Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'kafka'
    scrape_interval: 15s
    static_configs:
      - targets:
          - 'kafka-broker1:7071'
          - 'kafka-broker2:7071'
          - 'kafka-broker3:7071'
        labels:
          cluster: 'production'

  - job_name: 'kafka-exporter'
    # kafka-exporter 提供消费者 Lag 等高级指标
    # 项目地址：https://github.com/danielqsj/kafka_exporter
    static_configs:
      - targets: ['kafka-exporter:9308']
```

**部署 kafka-exporter（可选，提供消费者 Lag 等指标）**：

```bash
docker run -d --name kafka-exporter \
  -p 9308:9308 \
  danielqsj/kafka-exporter:latest \
  --kafka.server=kafka-broker1:9092
```

#### 第三步：Grafana Dashboard

推荐导入以下社区 Dashboard（Grafana Dashboard ID）：

| Dashboard ID | 名称 | 覆盖指标 |
|-------------|------|---------|
| **7589** | Kafka Overview | Broker、Topic、Partition 全局概览 |
| **12322** | Apache Kafka | 生产者、消费者、Broker 详细指标 |
| **7584** | Kafka Exporter Overview | 消费者 Lag、Topic 详情 |

**导入步骤**：
1. Grafana 左侧菜单 → Dashboards → Import
2. 输入 Dashboard ID（如 `7589`）
3. 选择 Prometheus 数据源
4. 点击 Import

**关键监控面板**：
- **Broker 面板**：CPU、内存、磁盘使用率、网络 IO
- **Topic 面板**：消息写入速率（MessagesInPerSec）、字节流入速率（BytesInPerSec）
- **消费者 Lag 面板**：每个消费者组的 Lag 趋势图
- **ISR 面板**：UnderReplicatedPartitions 数量（应为 0）

#### 第四步：告警规则

{% raw %}

```yaml
# kafka-alerts.yml
groups:
  - name: kafka_alerts
    rules:
      - alert: KafkaBrokerDown
        expr: up{job="kafka"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Kafka Broker {{ $labels.instance }} 宕机"

      - alert: KafkaUnderReplicatedPartitions
        expr: kafka_server_replicamanager_UnderReplicatedPartitions > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "存在未同步的分区: {{ $value }}"

      - alert: KafkaConsumerLagHigh
        expr: kafka_consumergroup_lag_sum > 10000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "消费者组 {{ $labels.consumergroup }} Lag 过高: {{ $value }}"

      - alert: KafkaDiskUsageHigh
        expr: (node_filesystem_avail_bytes{mountpoint="/var/lib/kafka"} / node_filesystem_size_bytes) < 0.3
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Kafka 磁盘使用率超过 70%"
```

{% endraw %}


## 二十五、大消息处理专题

> Kafka 默认消息大小上限约 1MB，实际生产中经常遇到需要发送几 MB 甚至几十 MB 大消息的场景（如图片、日志批次、数据库快照）。本节介绍如何协调各层参数以支持大消息。

### 25.1 参数协调关系

大消息涉及的参数分散在 Producer、Broker、Topic 三层，必须全部协调一致，任何一层不匹配都会导致 `RecordTooLargeException` 或 `MessageSizeTooLargeException`。

```
Producer                    Broker                     Consumer
┌──────────────────┐        ┌──────────────────┐       ┌──────────────────┐
│ max.request.size │ →      │ message.max.bytes│ →     │ max.partition    │
│ (默认 1MB)       │        │ (默认 ~1MB)      │       │ .fetch.bytes     │
│                  │        │                  │       │ (默认 1MB)       │
│ buffer.memory    │        │ replica.fetch    │       │                  │
│                  │        │ .max.bytes       │       │ fetch.max.bytes  │
│ batch.size       │        │ (默认 1MB)       │       │ (默认 ~50MB)     │
└──────────────────┘        └──────────────────┘       └──────────────────┘
```

### 25.2 完整参数配置示例

假设需要支持最大 10MB 的消息：

**Producer 端**：
```properties
# 单次请求最大大小（必须 > 消息大小）
max.request.size=10485760        # 10MB
# 缓冲区大小（应 >= max.request.size）
buffer.memory=67108864           # 64MB
# 单个批次大小（应 >= 单条消息大小）
batch.size=10485760              # 10MB
```

**Broker 端（server.properties）**：
```properties
# 单条消息最大大小
message.max.bytes=10485760       # 10MB
# 副本拉取最大字节数（必须 >= message.max.bytes）
replica.fetch.max.bytes=10485760 # 10MB
# 请求最大字节数（必须 >= message.max.bytes）
socket.request.max.bytes=104857600 # 100MB
```

**Topic 端（覆盖 Broker 默认值）**：
```bash
bin/kafka-configs.sh --bootstrap-server localhost:9092 \
  --entity-type topics --entity-name my-large-topic \
  --alter --add-config max.message.bytes=10485760
```

**Consumer 端**：
```properties
# 单个分区拉取最大字节数（必须 >= 消息大小）
max.partition.fetch.bytes=10485760  # 10MB
# 单次 fetch 最大字节数
fetch.max.bytes=52428800            # 50MB
```

### 25.3 Java 代码示例

```java
Properties props = new Properties();
props.put("bootstrap.servers", "localhost:9092");
props.put("max.request.size", 10 * 1024 * 1024);  // 10MB
props.put("buffer.memory", 64 * 1024 * 1024);      // 64MB
props.put("batch.size", 10 * 1024 * 1024);          // 10MB

KafkaProducer<String, byte[]> producer = new KafkaProducer<>(props);

// 发送大消息（如图片）
byte[] imageBytes = Files.readAllBytes(Path.of("/path/to/image.jpg"));
producer.send(new ProducerRecord<>("large-messages", "image-001", imageBytes));
```

> ⚠️ **最佳实践**：尽量避免发送超大消息。更好的做法是将大文件存到对象存储（S3/MinIO），Kafka 只传输文件的引用地址。


## 二十六、MirrorMaker2 跨数据中心复制

> 当 Kafka 部署在多个数据中心（如两地三中心、多云架构）时，需要在集群之间复制数据。MirrorMaker2（MM2）是 Kafka 官方提供的跨集群复制工具。

### 26.1 为什么需要 MirrorMaker2

| 场景 | 说明 |
|------|------|
| **灾备** | 主数据中心故障时，备中心有完整数据副本 |
| **就近访问** | 不同地域的消费者从本地集群读取，降低延迟 |
| **数据聚合** | 多个边缘集群的数据汇总到中心集群分析 |
| **迁移** | 将数据从旧集群迁移到新集群 |

### 26.2 MM2 核心特性

- 基于 Kafka Connect 框架运行（是一个 Source Connector）
- **自动 Topic 同步**：源集群创建 Topic，目标集群自动创建
- **Consumer Group 位移同步**：消费者切换到目标集群后可以从断点继续
- **精确一次语义**：避免跨集群数据重复
- **双向复制**：支持 A↔B 双向复制（需注意循环复制问题）

### 26.3 部署配置

**配置文件 `mm2.properties`**：

```properties
# 集群别名定义
clusters = dc1, dc2

# dc1 集群连接信息
dc1.bootstrap.servers = kafka-dc1-1:9092,kafka-dc1-2:9092,kafka-dc1-3:9092
dc2.bootstrap.servers = kafka-dc2-1:9092,kafka-dc2-2:9092,kafka-dc2-3:9092

# 启用复制流：dc1 → dc2
dc1->dc2.enabled = true
dc1->dc2.topics = orders\..*   # 正则匹配：复制 orders 开头的所有 Topic

# 启用复制流：dc2 → dc1（双向复制）
dc2->dc1.enabled = true
dc2->dc1.topics = users\..*

# Topic 命名策略：添加源集群前缀，避免命名冲突
replication.policy.class = org.apache.kafka.connect.mirror.IdentityReplicationPolicy

# 同步频率
sync.topic.configs.enabled = true
sync.topic.configs.interval.seconds = 600
emit.checkpoints.enabled = true
emit.checkpoints.interval.seconds = 60
refresh.groups.enabled = true
refresh.groups.interval.seconds = 600
sync.group.offsets.enabled = true
sync.group.offsets.interval.seconds = 60
```

**启动 MM2**：

```bash
bin/connect-mirror-maker.sh mm2.properties
```

### 26.4 Topic 命名策略

| 策略 | Topic 名称变化 | 适用场景 |
|------|---------------|----------|
| `IdentityReplicationPolicy` | `orders` → `orders`（同名） | 单向复制或 Topic 不冲突时 |
| `DefaultReplicationPolicy` | `orders` → `dc1.orders`（加源前缀） | 双向复制、避免命名冲突 |

> ⚠️ **双向复制注意事项**：如果 dc1 和 dc2 都复制 `orders` Topic，使用 `IdentityReplicationPolicy` 会导致循环复制。务必使用 `DefaultReplicationPolicy` 或通过 Topic 白名单避免冲突。

### 26.5 监控复制状态

```bash
# 查看 MM2 的 Connect 状态
curl http://localhost:8083/connectors | jq

# 查看复制延迟
bin/kafka-consumer-groups.sh \
  --bootstrap-server kafka-dc2-1:9092 \
  --describe --group mm2-dc1-consumer-group
```


## 二十七、Docker 与 Kubernetes 部署

> 现代基础设施中，容器化部署已成为主流。本节介绍如何用 Docker Compose 和 Kubernetes 部署 Kafka。

### 27.1 Docker Compose 快速搭建（开发测试）

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
```

启动：

```bash
docker-compose up -d
```

验证：

```bash
# 创建 Topic
docker exec kafka kafka-topics --create \
  --topic test --bootstrap-server localhost:9092 \
  --partitions 1 --replication-factor 1

# 收发消息
docker exec -it kafka kafka-console-producer \
  --topic test --bootstrap-server localhost:9092

docker exec -it kafka kafka-console-consumer \
  --topic test --from-beginning --bootstrap-server localhost:9092
```

### 27.2 Docker Compose 三节点集群

```yaml
version: '3.8'

services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    ports:
      - "2181:2181"

  kafka-1:
    image: confluentinc/cp-kafka:7.4.0
    depends_on: [zookeeper]
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
      KAFKA_DEFAULT_REPLICATION_FACTOR: 3
      KAFKA_MIN_INSYNC_REPLICAS: 2

  kafka-2:
    image: confluentinc/cp-kafka:7.4.0
    depends_on: [zookeeper]
    ports:
      - "9093:9093"
    environment:
      KAFKA_BROKER_ID: 2
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-2:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
      KAFKA_DEFAULT_REPLICATION_FACTOR: 3
      KAFKA_MIN_INSYNC_REPLICAS: 2

  kafka-3:
    image: confluentinc/cp-kafka:7.4.0
    depends_on: [zookeeper]
    ports:
      - "9094:9094"
    environment:
      KAFKA_BROKER_ID: 3
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9094
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-3:9094
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
      KAFKA_DEFAULT_REPLICATION_FACTOR: 3
      KAFKA_MIN_INSYNC_REPLICAS: 2
```

### 27.3 Kubernetes 部署（Strimzi Operator）

[Strimzi](https://strimzi.io/) 是 CNCF 毕业项目，是 Kubernetes 上部署 Kafka 的推荐方式。

**第一步：安装 Strimzi Operator**

```bash
# 通过 Helm 安装
helm repo add strimzi https://strimzi.io/charts/
helm install strimzi strimzi/strimzi-kafka-operator -n kafka --create-namespace
```

**第二步：创建 Kafka 集群**

```yaml
# kafka-cluster.yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: my-cluster
  namespace: kafka
spec:
  kafka:
    version: 3.4.0
    replicas: 3
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
      - name: tls
        port: 9093
        type: internal
        tls: true
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
      default.replication.factor: 3
      min.insync.replicas: 2
    storage:
      type: jbod
      volumes:
      - id: 0
        type: persistent-claim
        size: 100Gi
        deleteClaim: false
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 20Gi
      deleteClaim: false
  entityOperator:
    topicOperator: {}
    userOperator: {}
```

```bash
kubectl apply -f kafka-cluster.yaml
```

**第三步：创建 Topic**

```yaml
# kafka-topic.yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: orders
  namespace: kafka
  labels:
    strimzi.io/cluster: my-cluster
spec:
  partitions: 6
  replicas: 3
  config:
    retention.ms: 604800000  # 7 天
    cleanup.policy: delete
```

```bash
kubectl apply -f kafka-topic.yaml
```

**第四步：验证**

```bash
# 查看集群状态
kubectl get kafka -n kafka

# 查看 Pod 状态
kubectl get pods -n kafka

# 查看 Topic
kubectl get kafkatopic -n kafka

# 从 Pod 内部测试消息收发
kubectl exec -it my-cluster-kafka-0 -n kafka -- \
  bin/kafka-console-producer.sh --topic orders \
  --bootstrap-server localhost:9092
```

> 💡 **生产建议**：
> - 使用 Strimzi 的 `KafkaMirrorMaker2` CRD 在 K8s 中管理跨集群复制
> - 使用 `KafkaConnect` CRD 部署 Kafka Connect 集群
> - 配置 Pod 亲和性（anti-affinity）确保 Broker 分布在不同节点
> - 使用 `storage.type: persistent-claim` 确保数据持久化


## 二十八、常见问题排查指南

> 📖 **前置阅读**：集群搭建阶段的常见问题（ZooKeeper 端口占用、内存不足、选举失败、broker.id 重复等）请参考第六章。本章聚焦运维阶段的问题排查。

> 💡 **5 分钟快速诊断流程**：
> 1. **检查服务状态** → `systemctl status kafka` 或 `jps | grep Kafka`
> 2. **查看最近日志** → `tail -100 logs/server.log | grep -i error`
> 3. **检查磁盘空间** → `df -h`（确保 < 80%）
> 4. **检查网络连通** → `telnet broker1 9092`
> 5. **检查集群状态** → `kafka-topics.sh --describe --bootstrap-server localhost:9092`

---

### 28.1 生产者常见问题

#### 问题1：生产者发送消息超时

**问题现象**：
```
org.apache.kafka.common.errors.TimeoutException: Expiring 1 record(s) for my-topic-0 due to 60000 ms has passed since batch creation
```

**可能原因**：
1. `max.block.ms` 超时（缓冲区满）
2. Broker 负载过高，无法及时处理
3. 网络延迟或丢包
4. 分区 Leader 不可用

**解决步骤**：
```bash
# 1. 检查 Broker 负载
kafka-run-class.sh kafka.tools.JmxTool \
  --object-name kafka.server:type=BrokerTopicMetrics,name=MessagesInPerSec \
  --jmx-url service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi

# 2. 检查生产者配置
grep -E "max.block.ms|buffer.memory|batch.size" config/producer.properties

# 3. 调整生产者参数
cat >> config/producer.properties << EOF
buffer.memory=67108864  # 64MB
batch.size=32768        # 32KB
linger.ms=50            # 等待50ms
max.block.ms=120000     # 2分钟
EOF

# 4. 检查网络延迟
ping -c 10 kafka-broker1

# 5. 检查分区状态
kafka-topics.sh --describe --bootstrap-server localhost:9092 --topic my-topic
```

**预防措施**：
- 合理设置 `buffer.memory`，根据业务吞吐量调整
- 使用异步发送 + 回调，避免阻塞主线程
- 监控 `buffer-available-bytes` 指标

---

#### 问题2：生产者发送消息被拒绝（NOT_LEADER_FOR_PARTITION）

**问题现象**：
```
org.apache.kafka.common.errors.NotLeaderForPartitionException
```

**可能原因**：
1. 分区 Leader 正在选举中
2. 客户端元数据缓存过期
3. Broker 重启或故障转移

**解决步骤**：
```bash
# 1. 检查分区 Leader 状态
kafka-topics.sh --describe --bootstrap-server localhost:9092 --topic my-topic

# 2. 等待 Leader 选举完成（通常 30 秒内）
sleep 30

# 3. 手动触发 Leader 选举（如果长时间无 Leader）
kafka-leader-election.sh --bootstrap-server localhost:9092 \
  --election-type preferred --topic my-topic --partition 0

# 4. 检查生产者重试配置
grep "retries" config/producer.properties
# 建议设置：retries=5，retry.backoff.ms=100
```

**预防措施**：
- 启用生产者重试机制：`retries=5`
- 设置合理的 `retry.backoff.ms`（100-1000ms）
- 监控 `FailedProducerRequestsPerSec` 指标

---

### 28.2 消费者常见问题

#### 问题3：消费者 Lag 持续增长

**问题现象**：
```
消费者消费速度跟不上生产速度，Lag 越来越大
```

**可能原因**：
1. 消费者处理逻辑耗时过长
2. 消费者数量不足
3. `max.poll.records` 设置过小
4. 消费者频繁 Rebalance

**解决步骤**：
```bash
# 1. 查看消费者 Lag
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group my-group

# 输出示例：
# TOPIC           PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# my-topic        0          1000            50000           49000

# 2. 检查消费者处理时间
# 在消费者代码中添加处理时间日志

# 3. 增加消费者实例
# 启动更多消费者进程

# 4. 调整消费者配置
cat >> config/consumer.properties << EOF
max.poll.records=500        # 增加每次拉取数量
fetch.min.bytes=1           # 最小拉取字节数
fetch.max.wait.ms=500       # 最大等待时间
EOF

# 5. 优化消费逻辑
# - 批量处理而非逐条处理
# - 异步处理耗时操作
# - 使用线程池并行处理
```

**预防措施**：
- 监控消费者 Lag，设置告警阈值（如 > 10000）
- 根据业务需求合理设置消费者数量
- 使用 `@KafkaListener` 的 `concurrency` 参数并行消费

---

#### 问题4：消费者频繁 Rebalance

**问题现象**：
```
消费者频繁加入和退出组，消费进度不稳定
```

**可能原因**：
1. `max.poll.interval.ms` 设置过小
2. 消息处理时间过长
3. 网络不稳定导致心跳超时
4. 消费者数量频繁变化

**解决步骤**：
```bash
# 1. 查看 Rebalance 日志
grep -i "rebalance" logs/server.log

# 2. 调整消费者配置
cat >> config/consumer.properties << EOF
max.poll.interval.ms=300000  # 5分钟
session.timeout.ms=45000     # 45秒
heartbeat.interval.ms=15000  # 15秒（默认3000，建议调为 session.timeout.ms 的 1/3）
max.poll.records=100         # 减少每次拉取数量
EOF

# 3. 优化消息处理逻辑
# - 批量处理而非逐条处理
# - 异步处理耗时操作
# - 避免在消费线程中做耗时的数据库操作

# 4. 使用静态成员 ID（Kafka 2.3+）
# 在消费者配置中添加：
group.instance.id=consumer-host-1
```

**预防措施**：
- 合理设置 `max.poll.interval.ms`，留出足够余量
- 使用静态成员 ID 减少 Rebalance
- 监控 `RebalanceRatePerSec` 指标

---

#### 问题5：消费者消费到重复消息

**问题现象**：
```
同一条消息被消费多次
```

**可能原因**：
1. 消费者处理后未提交 Offset 就崩溃
2. 自动提交 Offset 的时间间隔过长
3. 生产者重复发送（未启用幂等性）

**解决步骤**：
```bash
# 1. 检查 Offset 提交方式
grep "enable.auto.commit" config/consumer.properties

# 2. 改为手动提交 Offset
cat >> config/consumer.properties << EOF
enable.auto.commit=false
EOF

# 3. 在消费逻辑中手动提交
# 参考 8.4.2 节的同步/异步提交示例

# 4. 启用生产者幂等性
cat >> config/producer.properties << EOF
enable.idempotence=true
EOF

# 5. 实现业务幂等性
# - 使用消息 ID 去重
# - 使用数据库唯一约束
# - 使用 Redis 记录已处理的消息 ID
```

**预防措施**：
- 启用生产者幂等性：`enable.idempotence=true`
- 使用手动提交 Offset，确保业务处理完成后再提交
- 实现业务层幂等性

---

### 28.3 集群运维常见问题

#### 问题6：磁盘使用率过高

**问题现象**：
```
磁盘空间不足，Kafka 写入失败
```

**可能原因**：
1. 日志保留时间过长
2. 消息量超出预期
3. 未配置日志清理策略

**解决步骤**：
```bash
# 1. 检查磁盘使用情况
df -h
du -sh /var/lib/kafka/logs/*

# 2. 清理旧日志段（kafka-log-cleaner.sh 是后台 Compaction 进程，不能用于手动清理）
# 正确做法：缩短保留时间让 Kafka 自动清理
kafka-configs.sh --bootstrap-server localhost:9092 \
  --entity-type topics --entity-name my-topic \
  --alter --add-config retention.ms=3600000  # 先设为 1 小时加速清理

# 3. 调整日志保留策略
kafka-configs.sh --bootstrap-server localhost:9092 \
  --entity-type topics --entity-name my-topic \
  --alter --add-config retention.ms=259200000  # 3天

# 4. 配置日志大小限制
kafka-configs.sh --bootstrap-server localhost:9092 \
  --entity-type topics --entity-name my-topic \
  --alter --add-config retention.bytes=1073741824  # 1GB

# 5. 扩展磁盘或添加新日志目录
# 在 server.properties 中配置多个日志目录
log.dirs=/var/lib/kafka/logs1,/var/lib/kafka/logs2,/var/lib/kafka/logs3
```

**预防措施**：
- 监控磁盘使用率，设置告警阈值（> 70%）
- 根据业务需求合理设置保留策略
- 使用多磁盘分散 IO 压力

---

#### 问题7：消费者组状态异常（DEAD 或 EMPTY）

**问题现象**：
```
消费者组状态为 DEAD 或 EMPTY，无法消费消息
```

**可能原因**：
1. 所有消费者都已退出
2. 消费者组长时间未活跃
3. Offset 数据被清理

**解决步骤**：
```bash
# 1. 检查消费者组状态
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group my-group

# 2. 如果状态为 EMPTY，重新启动消费者即可

# 3. 如果状态为 DEAD，需要重新创建消费者组
# 删除旧的消费者组（慎用！）
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --delete --group my-group

# 4. 重置 Offset
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --group my-group --reset-offsets --to-earliest \
  --execute --topic my-topic

# 5. 重新启动消费者
```

**预防措施**：
- 监控消费者组状态，设置告警
- 避免消费者长时间空闲
- 定期检查消费者组的 Offset 提交情况

---

#### 问题8：集群间网络延迟过高

**问题现象**：
```
生产者/消费者响应缓慢，日志显示网络超时
```

**可能原因**：
1. 网络带宽不足
2. 跨机房/跨地域部署
3. 防火墙规则过多
4. DNS 解析缓慢

**解决步骤**：
```bash
# 1. 检查网络延迟
ping -c 10 kafka-broker1
ping -c 10 kafka-broker2

# 2. 检查带宽使用情况
iftop -i eth0

# 3. 检查防火墙规则
iptables -L -n | wc -l

# 4. 测试端到端延迟
nc -zv kafka-broker1 9092

# 5. 调整超时配置
cat >> config/producer.properties << EOF
request.timeout.ms=60000
max.block.ms=120000        # send() 最大阻塞时间（替代已废弃的 metadata.fetch.timeout.ms）
EOF
```

**预防措施**：
- 同机房部署 Kafka 集群
- 使用专用网络通道
- 监控网络延迟指标

---

### 28.4 性能调优常见问题

#### 问题9：Kafka 吞吐量低

**问题现象**：
```
生产者/消费者吞吐量远低于预期
```

**可能原因**：
1. 批量大小设置不合理
2. 压缩算法选择不当
3. 磁盘 IO 成为瓶颈
4. 网络带宽限制

**解决步骤**：
```bash
# 1. 检查当前吞吐量
kafka-run-class.sh kafka.tools.JmxTool \
  --object-name kafka.server:type=BrokerTopicMetrics,name=BytesInPerSec \
  --jmx-url service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi

# 2. 调整生产者配置
cat >> config/producer.properties << EOF
batch.size=65536        # 64KB
linger.ms=100           # 等待100ms
compression.type=lz4    # 使用 LZ4 压缩
buffer.memory=134217728 # 128MB
EOF

# 3. 调整 Broker 配置
cat >> config/server.properties << EOF
num.network.threads=8
num.io.threads=16
socket.send.buffer.bytes=102400
socket.receive.buffer.bytes=102400
socket.request.max.bytes=104857600
EOF

# 4. 使用 SSD 硬盘
# 监控磁盘 IO
iostat -x 1

# 5. 增加分区数
kafka-topics.sh --alter --topic my-topic \
  --partitions 12 --bootstrap-server localhost:9092
```

**预防措施**：
- 根据业务需求调整批量大小和等待时间
- 使用 LZ4 或 ZSTD 压缩算法
- 使用 SSD 硬盘提升 IO 性能
- 合理设置分区数（建议 Broker 数量的 2-3 倍）

---

#### 问题10：Kafka 延迟过高

**问题现象**：
```
消息从生产到消费的延迟超过预期
```

**可能原因**：
1. 批量大小设置过大
2. 等待时间设置过长
3. Broker 负载过高
4. 消费者处理缓慢

**解决步骤**：
```bash
# 1. 调整生产者配置（降低延迟）
cat >> config/producer.properties << EOF
batch.size=16384        # 16KB
linger.ms=0             # 不等待
acks=1                  # Leader 确认即可
EOF

# 2. 调整消费者配置
cat >> config/consumer.properties << EOF
fetch.min.bytes=1
fetch.max.wait.ms=100
max.poll.records=100
EOF

# 3. 检查 Broker 负载
top -p $(pgrep -f kafka)

# 4. 检查消费者处理时间
# 在消费逻辑中添加处理时间日志

# 5. 使用异步处理
# 将耗时操作异步化，避免阻塞消费线程
```

**预防措施**：
- 根据业务需求平衡吞吐量和延迟
- 监控端到端延迟指标
- 使用异步处理提高消费速度

---

### 28.5 监控与告警建议

**关键监控指标**：

| 指标类别 | 指标名称 | 告警阈值 |
|---------|---------|---------|
| **Broker** | CPU 使用率 | > 80% |
| **Broker** | 内存使用率 | > 85% |
| **Broker** | 磁盘使用率 | > 70% |
| **Broker** | 网络 IO | > 80% 带宽 |
| **生产者** | 发送成功率 | < 99% |
| **生产者** | 发送延迟 P99 | > 100ms |
| **消费者** | 消费者 Lag | > 10000 |
| **消费者** | 消费成功率 | < 99% |

**推荐监控工具**：
- **Prometheus + Grafana**：开源监控方案
- **Kafka Manager**：集群管理工具
- **Burrow**：消费者 Lag 监控
- **LinkedIn Kafka Monitor**：端到端监控

---


> 📖 **附录阅读顺序**：建议先阅读末尾的「附录 A：环境搭建检查清单」确认环境就绪，再参考以下调优参数。

## 附录B：Kafka 性能调优速查表

### B.1 生产者调优参数

| 参数 | 默认值 | 建议值 | 说明 |
|------|--------|--------|------|
| `batch.size` | 16384 (16KB) | 65536 (64KB) | 批量发送大小，增大可提升吞吐量 |
| `linger.ms` | 0（3.x）/ 5（4.0+） | 50-100 | 发送前等待时间，配合 batch.size 使用 |
| `compression.type` | none | lz4 | 压缩算法，推荐 LZ4（速度与压缩率平衡） |
| `buffer.memory` | 33554432 (32MB) | 67108864 (64MB) | 生产者缓冲区大小 |
| `acks` | all（3.0+）/ 1（2.x） | all | 3.0+ 默认 all，无需修改 |
| `retries` | Integer.MAX_VALUE（幂等开启时） | Integer.MAX_VALUE | 3.0+ 幂等默认开启，retries 默认 MAX_VALUE |
| `retry.backoff.ms` | 100 | 100-1000 | 重试间隔 |
| `max.in.flight.requests.per.connection` | 5 | 1 | 保证消息顺序时设置为 1 |
| `enable.idempotence` | true（3.0+）/ false（2.x） | true | 3.0+ 默认启用 |
| `max.block.ms` | 60000 | 60000 | send() 最大阻塞时间 |

**调优建议**：
- **高吞吐场景**：增大 `batch.size`、`linger.ms`，启用压缩
- **低延迟场景**：减小 `batch.size`、`linger.ms=0`
- **高可靠场景**：`acks=all`、`enable.idempotence=true`

---

### B.2 消费者调优参数

| 参数 | 默认值 | 建议值 | 说明 |
|------|--------|--------|------|
| `max.poll.records` | 500 | 100-500 | 每次拉取的最大消息数 |
| `max.poll.interval.ms` | 300000 (5min) | 300000 | 消费者处理超时时间 |
| `session.timeout.ms` | 45000 (45s) | 45000 | 会话超时时间 |
| `heartbeat.interval.ms` | 3000 (3s) | 15000 | 心跳间隔 |
| `fetch.min.bytes` | 1 | 1 | 拉取的最小字节数 |
| `fetch.max.wait.ms` | 500 | 500 | 拉取的最大等待时间 |
| `enable.auto.commit` | true | false | 生产环境建议手动提交 |
| `auto.offset.reset` | latest | earliest | 首次消费从最早开始 |
| `isolation.level` | read_uncommitted | read_committed | 事务场景下使用 |

**调优建议**：
- **高吞吐场景**：增大 `max.poll.records`、`fetch.min.bytes`
- **低延迟场景**：减小 `fetch.max.wait.ms`
- **高可靠场景**：手动提交 Offset，使用 `read_committed`

---

### B.3 Broker 调优参数

| 参数 | 默认值 | 建议值 | 说明 |
|------|--------|--------|------|
| `num.network.threads` | 3 | 8 | 网络线程数 |
| `num.io.threads` | 8 | 16 | IO 线程数 |
| `socket.send.buffer.bytes` | 102400 | 102400 | 发送缓冲区大小 |
| `socket.receive.buffer.bytes` | 102400 | 102400 | 接收缓冲区大小 |
| `socket.request.max.bytes` | 10485760 | 104857600 | 请求最大字节数 |
| `log.flush.interval.messages` | 10000 | 10000 | 刷盘消息间隔 |
| `log.flush.interval.ms` | 1000 | 1000 | 刷盘时间间隔 |
| `num.replica.fetchers` | 1 | 3 | 副本拉取线程数 |
| `replica.fetch.max.bytes` | 1048576 | 10485760 | 副本拉取最大字节数 |
| `message.max.bytes` | 1000012 | 10485760 | 消息最大字节数 |

**调优建议**：
- **高吞吐场景**：增加 `num.network.threads`、`num.io.threads`
- **高可靠场景**：调整 `log.flush.interval.messages`、`log.flush.interval.ms`
- **大消息场景**：增大 `message.max.bytes`、`replica.fetch.max.bytes`

---

### B.4 JVM 调优建议

```bash
# 推荐 JVM 参数（8GB 内存的 Broker）
export KAFKA_HEAP_OPTS="-Xmx6g -Xms6g"
export KAFKA_JVM_PERFORMANCE_OPTS="-XX:+UseG1GC -XX:MaxGCPauseMillis=20 -XX:InitiatingHeapOccupancyPercent=35 -XX:G1HeapRegionSize=16M -XX:MinMetaspaceFreeRatio=50 -XX:MaxMetaspaceFreeRatio=80"
```

---


## 附录C：生产环境部署检查清单

### C.1 硬件要求检查

**最低配置**：
- CPU：8 核
- 内存：32GB
- 磁盘：SSD，500GB+
- 网络：千兆网卡

**推荐配置**：
- CPU：16 核
- 内存：64GB
- 磁盘：NVMe SSD，1TB+，多盘 RAID 10
- 网络：万兆网卡

**检查命令**：
```bash
# 检查 CPU
lscpu
nproc

# 检查内存
free -h

# 检查磁盘
lsblk
df -h
smartctl -a /dev/sda

# 检查网络
ethtool eth0
```

---

### C.2 网络配置检查

**端口规划**：
| 服务 | 端口 | 用途 |
|------|------|------|
| ZooKeeper | 2181 | 客户端连接 |
| ZooKeeper | 2888 | 节点间通信 |
| ZooKeeper | 3888 | Leader 选举 |
| Kafka | 9092 | 客户端连接 |
| Kafka JMX | 9999 | 监控 |

**检查命令**：
```bash
# 检查端口连通性
telnet zookeeper1 2181
telnet kafka-broker1 9092

# 检查防火墙规则
iptables -L -n
firewall-cmd --list-all

# 检查 DNS 解析
nslookup kafka-broker1
```

**防火墙配置示例**：
```bash
# 开放 ZooKeeper 端口
firewall-cmd --permanent --add-port=2181/tcp
firewall-cmd --permanent --add-port=2888/tcp
firewall-cmd --permanent --add-port=3888/tcp

# 开放 Kafka 端口
firewall-cmd --permanent --add-port=9092/tcp
firewall-cmd --permanent --add-port=9999/tcp

# 重载防火墙
firewall-cmd --reload
```

---

### C.3 安全配置检查

**认证配置**：
```properties
# SASL/PLAIN 认证
listeners=SASL_PLAINTEXT://:9093
security.inter.broker.protocol=SASL_PLAINTEXT
sasl.mechanism.inter.broker.protocol=PLAIN
sasl.enabled.mechanisms=PLAIN
```

**授权配置**：
```properties
# ACL 授权
authorizer.class.name=kafka.security.authorizer.AclAuthorizer
super.users=User:admin
allow.everyone.if.no.acl.found=false
```

**加密配置**：
```properties
# SSL/TLS 加密
listeners=SSL://:9094
ssl.keystore.location=/path/to/kafka.keystore.jks
ssl.keystore.password=changeit
ssl.truststore.location=/path/to/kafka.truststore.jks
ssl.truststore.password=changeit
```

**安全检查清单**：
- [ ] 启用 SASL 认证
- [ ] 配置 ACL 授权
- [ ] 启用 SSL/TLS 加密
- [ ] 定期更换证书
- [ ] 限制超级用户数量

---

### C.4 监控告警配置

**Prometheus 配置示例**：
```yaml
scrape_configs:
  - job_name: 'kafka'
    static_configs:
      - targets: ['kafka-broker1:9999', 'kafka-broker2:9999', 'kafka-broker3:9999']
  - job_name: 'zookeeper'
    static_configs:
      - targets: ['zookeeper1:2181', 'zookeeper2:2181', 'zookeeper3:2181']
```

**告警规则示例**：
{% raw %}

```yaml
groups:
  - name: kafka_alerts
    rules:
      - alert: KafkaBrokerDown
        expr: up{job="kafka"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Kafka broker {{ $labels.instance }} is down"
      
      - alert: KafkaDiskUsageHigh
        expr: node_filesystem_avail_bytes{mountpoint="/var/lib/kafka"} / node_filesystem_size_bytes < 0.3
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Kafka disk usage is high on {{ $labels.instance }}"
```

{% endraw %}

**监控指标**：
- Broker 指标：CPU、内存、磁盘、网络
- 生产者指标：发送速率、成功率、延迟
- 消费者指标：消费速率、Lag、Rebalance

---


## 附录D：学习路线图

### D.1 初学者应该学什么

**第一阶段：基础入门（1-2 周）**
- [ ] 理解消息队列的概念和作用
- [ ] 掌握 Kafka 的核心概念（Topic、Partition、Consumer Group）
- [ ] 学会 Kafka 的单机部署和基本操作
- [ ] 使用命令行工具发送和消费消息

**学习资源**：
- Apache Kafka 官方文档：https://kafka.apache.org/documentation/
- 《Kafka 权威指南》（入门章节）

**第二阶段：深入理解（2-4 周）**
- [ ] 理解 Kafka 的架构设计
- [ ] 掌握生产者和消费者的 API
- [ ] 学习 Kafka 的存储机制和副本机制
- [ ] 理解消费者组和 Rebalance 机制

**学习资源**：
- Kafka 官方文档（深入章节）
- 《Kafka 权威指南》（完整版）

**第三阶段：实战应用（2-4 周）**
- [ ] 使用 Java/Python 客户端开发生产者和消费者
- [ ] 集成 Spring Boot 使用 Kafka
- [ ] 实现消息的可靠传输（手动提交 Offset）
- [ ] 处理消息重复和顺序问题

**学习资源**：
- Kafka 客户端 API 文档
- Spring for Apache Kafka 文档

---

### D.2 进阶学习路径

**第四阶段：集群运维（2-4 周）**
- [ ] 搭建 Kafka 集群
- [ ] 学习集群监控和运维
- [ ] 掌握性能调优
- [ ] 学习故障排查

**学习资源**：
- Kafka 官方运维文档
- 本教程的第六章和第二十五章

**第五阶段：高级特性（2-4 周）**
- [ ] 掌握 Kafka 事务机制
- [ ] 学习 Kafka Streams 流处理
- [ ] 理解 Kafka Connect 数据集成
- [ ] 学习 Kafka 安全机制

**学习资源**：
- Kafka Streams 官方文档
- Kafka Connect 官方文档

**第六阶段：架构设计（持续学习）**
- [ ] 设计高可用 Kafka 集群
- [ ] 设计消息驱动架构
- [ ] 学习 Kafka 在微服务中的应用
- [ ] 了解 Kafka 与其他系统集成

**学习资源**：
- 企业级 Kafka 架构案例
- Confluent 官方博客

---

### D.3 推荐学习资源

**书籍推荐**：
1. 《Kafka 权威指南》 - 入门必读
2. 《Apache Kafka 实战》 - 实战导向
3. 《Kafka Streams 实战》 - 流处理深入

**在线课程**：
1. Confluent 官方培训：https://developer.confluent.io/
2. Udemy Kafka 课程
3. Coursera 大数据课程

**官方文档**：
1. Apache Kafka 官方文档：https://kafka.apache.org/documentation/
2. Confluent 文档：https://docs.confluent.io/
3. Spring for Apache Kafka：https://spring.io/projects/spring-kafka

**社区资源**：
1. Kafka 邮件列表：https://kafka.apache.org/contact
2. Stack Overflow Kafka 标签
3. GitHub Kafka 示例项目

**实践建议**：
1. 搭建本地 Kafka 环境进行实验
2. 参与开源项目贡献代码
3. 阅读 Kafka 源码理解实现原理
4. 在生产环境中积累经验

---


## 附录 A：环境搭建检查清单

> 在开始任何 Kafka/ZooKeeper 实操之前，逐项检查以下内容，全部 ✅ 再进入正文。

### A.1 Java 环境检查

| # | 检查项 | 命令 | ✅ 通过标准 |
|---|--------|------|------------|
| 1 | Java 已安装 | `java -version` | 显示版本号 ≥ 1.8（如 `openjdk version "1.8.0_xxx"`） |
| 2 | JAVA_HOME 已设置 | Linux/Mac: `echo $JAVA_HOME`<br>Win: `echo %JAVA_HOME%` | 输出一个有效的 JDK 安装路径 |
| 3 | java 命令在 PATH 中 | `which java`（Linux/Mac）<br>`where java`（Windows） | 能找到 java 可执行文件的路径 |
| 4 | javac 编译器可用（开发时需要） | `javac -version` | 显示版本号（仅使用预编译包时可选） |

### A.2 ZooKeeper 环境检查

| # | 检查项 | 命令 | ✅ 通过标准 |
|---|--------|------|------------|
| 5 | ZooKeeper 已下载并解压 | `ls /opt/zookeeper/bin/` 或 `dir D:\zookeeper\bin\` | 能看到 `zkServer.sh`（Linux/Mac）或 `zkServer.cmd`（Windows） |
| 6 | zoo.cfg 已创建 | `ls conf/zoo.cfg`（在 ZK 目录下） | 文件存在且内容包含 `tickTime`、`dataDir`、`clientPort` |
| 7 | dataDir 目录已创建 | `ls -la /var/lib/zookeeper` 或 `dir D:\zookeeper-data` | 目录存在 |
| 8 | ZK 端口未被占用 | Linux/Mac: `netstat -tlnp \| grep 2181`<br>Windows: `netstat -ano \| findstr 2181` | 无输出（端口空闲） |
| 9 | ZooKeeper 可以启动 | `bin/zkServer.sh start` 或 `bin\zkServer.cmd` | 输出 `STARTED`，无 ERROR |
| 10 | zkCli 可连接 | `bin/zkCli.sh -server 127.0.0.1:2181` | 能进入命令行，`ls /` 返回 `[zookeeper]` |

### A.3 Kafka 环境检查

| # | 检查项 | 命令 | ✅ 通过标准 |
|---|--------|------|------------|
| 11 | Kafka 已下载并解压 | `ls /opt/kafka/bin/` 或 `dir D:\kafka\bin\` | 能看到 `kafka-server-start.sh`（Linux/Mac）或 `.bat`（Windows） |
| 12 | server.properties 存在 | `ls config/server.properties` | 文件存在 |
| 13 | Kafka 端口未被占用 | `netstat -tlnp \| grep 9092` | 无输出（端口空闲） |
| 14 | log.dirs 目录已创建 | 检查 `server.properties` 中 `log.dirs` 指定的路径 | 目录存在且可写 |
| 15 | ZooKeeper 已启动 | ZK 端口 2181 可连接 | `telnet localhost 2181` 能连通，或 5 分钟体验中 ZK 终端正常运行 |
| 16 | Kafka 可以启动 | `bin/kafka-server-start.sh config/server.properties` | 日志出现 `started (kafka.server.KafkaServer)`，无 ERROR |

### A.4 消息收发验证

| # | 检查项 | 命令 | ✅ 通过标准 |
|---|--------|------|------------|
| 17 | 可以创建 Topic | `bin/kafka-topics.sh --create --topic test --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1` | 返回 `Created topic test` |
| 18 | 可以列出 Topic | `bin/kafka-topics.sh --list --bootstrap-server localhost:9092` | 能看到 `test` |
| 19 | 生产者可发送 | `bin/kafka-console-producer.sh --topic test --bootstrap-server localhost:9092` | 输入消息后无报错 |
| 20 | 消费者可接收 | `bin/kafka-console-consumer.sh --topic test --from-beginning --bootstrap-server localhost:9092` | 能看到生产者发送的消息 |

### A.5 开发环境检查（Java 代码开发时需要）

| # | 检查项 | 命令/检查方式 | ✅ 通过标准 |
|---|--------|---------------|------------|
| 21 | Maven 已安装 | `mvn -version` | 显示 Maven 版本号 |
| 22 | IDE 已配置 | IntelliJ IDEA / Eclipse / VS Code | 能正常打开项目，无编译错误 |
| 23 | kafka-clients 依赖下载成功 | Maven 项目中右键 → Reload | `~/.m2/repository/org/apache/kafka/kafka-clients/` 下有对应版本 jar |
| 24 | 生产者代码可运行 | 运行 `KafkaProducerExample` | 控制台输出 `✅ 发送成功` |
| 25 | 消费者代码可运行 | 运行 `KafkaConsumerExample` | 控制台输出 `📩 收到消息` |

---

### A.6 常见问题速查表

| 现象 | 可能原因 | 快速解决方法 |
|------|----------|-------------|
| `java: command not found` 或 `不是内部命令` | Java 未安装或未配置 PATH | 安装 JDK 并配置 JAVA_HOME 和 PATH |
| `JAVA_HOME is not set` | JAVA_HOME 环境变量未设置 | 设置 JAVA_HOME 并 `source ~/.bashrc`（Linux/Mac）或重启终端（Windows） |
| ZooKeeper 启动报 `Cannot find Java` | JAVA_HOME 未设置或路径错误 | 检查 `echo $JAVA_HOME` 是否输出正确路径 |
| `Address already in use: bind` | 端口被占用 | `netstat -ano \| findstr 2181`（Windows）或 `lsof -i:2181`（Linux）找到并关闭占用进程 |
| ZooKeeper 启动后立即退出 | dataDir 不存在或配置文件有误 | 1. 确认 dataDir 目录存在 2. 确认 `zoo.cfg` 格式正确（无多余空格） |
| `Connection refused: localhost:2181` | ZooKeeper 未启动或端口配错 | 先启动 ZooKeeper，再启动 Kafka |
| Kafka 启动报 `Broker may not be available` | ZK 连接地址配错 | 检查 `server.properties` 中 `zookeeper.connect` 的地址和端口 |
| `Replication factor: 3 larger than brokers: 1` | 单机环境副本数设为 3 | 创建 Topic 时 `--replication-factor 1` |
| `Topic already exists` | Topic 重复创建 | `bin/kafka-topics.sh --list --bootstrap-server localhost:9092` 查看已有 Topic |
| 生产者发送无报错但消费者收不到 | 未使用 `--from-beginning` | 消费者添加 `--from-beginning` 参数，或确认 Topic 名称一致 |
| Windows 下 `.sh` 文件无法执行 | Windows 应使用 `.bat` 文件 | 使用 `bin\windows\` 目录下的 `.bat` 脚本 |
| 消费者报 `OFFSET_OUT_OF_RANGE` | Offset 被清理或 Topic 被重建 | 重置 Offset：`kafka-consumer-groups.sh --reset-offsets --to-earliest --execute` |