---
tags: [AI]
---

# 第 9 章 · LangGraph:状态机、多智能体与人工把关

> 本章目标:当流程超出"链"的表达能力——需要循环、动态分支、状态共享、人工审批——
> 用 LangGraph 的 StateGraph 建模。学完本章,前 8 章的所有零件都有了"总装车间"。
>
> 对应 demo:`first_state_graph.py`、`conditional_edges.py`、
> `supervisor_multi_agent.py`、`checkpoint_interrupt.py`

---

## 1. 什么时候需要 LangGraph

先诚实地说:前面所有 demo 都不需要 LangGraph。判断标准很简单:

| 你要做的流程 | 工具 |
|--------------|------|
| 输入 → 固定几步 → 输出 | LCEL 链(第 4 章) |
| 模型自己决定下一步调什么工具 | `create_agent`(第 8 章,内部也是图) |
| **流程里要"看情况回头"**、**多个角色接力**、**中途等人拍板** | LangGraph |

"状态机"这个词听起来玄,其实就是一张**流程图**:图上有若干站点,箭头规定怎么走、能不能回头。
LangGraph 的模型只有三个概念,像一块**共享黑板 + 一堆步骤 + 导航规则**:

```
State(状态)   —— 一份 TypedDict"黑板",所有节点读它、写增量
Node(节点)    —— 一个函数:收 state,返回要合并进黑板的增量 dict
Edge(边)      —— 固定边:走完必去下一站;条件边:路由函数看黑板决定去哪
```

## 2. Demo 9-1 · first_state_graph.py:线性图

```
START ──> writer(写初稿)──> critic(审稿)──> editor(定稿)──> END
```

三个要件(其中 `TypedDict` 是 Python 自带的类型标注写法,作用只是"给字典的每个格子注明类型",让人一眼看懂黑板上有什么,不影响运行):

```python
class ArticleState(TypedDict):       # 1) 黑板上有哪些格子
    topic: str; draft: str; critique: str; final: str

def writer_node(state: ArticleState) -> dict:      # 2) 节点 = 函数
    draft = ...invoke({"input": state["topic"]})
    return {"draft": draft}          # 只返回【增量】,不用搬运整个 state

builder = StateGraph(ArticleState)   # 3) 组装
builder.add_node("writer", writer_node)
builder.add_edge(START, "writer")    # 入口
builder.add_edge("writer", "critic")
builder.add_edge("editor", END)      # 出口
graph = builder.compile()            # 编译成可执行图(它也是个 Runnable!)

result = graph.invoke({"topic": "为什么程序员需要懂大模型"})
```

两个细节:

- 节点返回 `{"draft": draft}` 只写黑板的这个格子,其他格子自动保留——增量更新;
- `compile()` 出来的 graph 是 Runnable,意味着能 `stream`、能嵌进更大的图、
  甚至能作为第 8 章 Agent 里的一个"工具"。

## 3. Demo 9-2 · conditional_edges.py:条件边

第 3 章 classifier.py 的路由是在 Python 代码里 if/else;第 4 章 RunnableBranch 把路由做进链。
LangGraph 的条件边更进一步:**路由发生在图的节点之间**,可以通往任何节点、甚至回到旧节点(循环)。

```python
def route_by_intent(state: TicketState) -> str:
    """路由函数:读黑板 -> 返回下一站的名字。"""
    return {"咨询": "consult", "投诉": "complain", "闲聊": "chat"}[state["intent"]]

builder.add_conditional_edges(
    "classify",          # 哪个节点之后做判断
    route_by_intent,     # 路由函数
    {"consult": "consult", "complain": "complain", "chat": "chat"},  # 分支名 -> 节点名
)
```

图结构:

```
                ┌──> consult ──┐
START ──> classify ──> complain ──┼──> END
                └──> chat ──────┘
```

与第 4 章 RunnableBranch 的关键区别:RunnableBranch 的分支执行完就**结束了**;
而图的每个分支节点后面还能继续接边——包括**接回前面的节点**。下一 demo 正是靠这个做循环。

## 4. Demo 9-3 · supervisor_multi_agent.py:多智能体调度

"多智能体"听着玄,拆开就是:**几个角色(节点)+ 一个会派活的主管(节点)+ 黑板传话**。
Supervisor 是最实用的模式:

```
          ┌──────────── researcher(调研员)──────────┐
          │                                          │(干完汇报)
START ──> supervisor ──┐                             │
          ▲            ├──> writer(写手)─────────────┤
          └────────────┴──────── 循环回主管 ───────────┘
              (材料够了 -> FINISH -> END)
```

主管节点 = 第 3 章结构化输出的又一次登场:

```python
class Decision(BaseModel):
    next: Literal["researcher", "writer", "FINISH"] = Field(...)

def supervisor_node(state: TaskState) -> dict:
    decision = ...with_structured_output(Decision).invoke({"input": 材料现状})
    return {"next": decision.next}

builder.add_conditional_edges(
    "supervisor", lambda s: s["next"],
    {"researcher": "researcher", "writer": "writer", "FINISH": END},
)
builder.add_edge("researcher", "supervisor")   # 工人干完必回主管汇报 -> 形成循环
builder.add_edge("writer", "supervisor")
```

运行时你会看到主管的真实调度轨迹:`researcher → supervisor → writer → supervisor → FINISH`。

三个工程要点:

1. **工人可以是任何东西**——demo 里是纯 LLM 链;换成第 8 章的 `create_agent`(带工具)就是
   "会干活的专家";两个 worker 各自的工具箱互不相同,这是多智能体相对单 Agent 的核心增益;
2. **黑板是唯一的通信方式**——worker 之间不直接对话,全靠 state 里的字段交接,简单且可调试;
3. **防死循环**——主管有极小概率反复派活,生产中给 `graph.compile()` 后的 invoke 传
   `recursion_limit`(如 25),超限报错而不是烧钱转圈。

## 5. Demo 9-4 · checkpoint_interrupt.py:持久化与人工把关

高风险动作(群发通知、付款、删库)必须"AI 干活,人类把关"。LangGraph 的原生支持:

```python
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import interrupt, Command

def review_node(state: PostState) -> dict:
    decision = interrupt({"question": "这条文案可以发布吗?", "draft": state["draft"]})
    return {"decision": decision}          # interrupt() 的返回值 = 恢复时传入的决定

graph = builder.compile(checkpointer=InMemorySaver())   # 持久化是暂停/恢复的前提
config = {"configurable": {"thread_id": "post-001"}}

# 第一次执行:跑到 review 节点自动暂停
graph.invoke({"topic": "公司十周年庆典"}, config)
graph.get_state(config).next        # -> ('review',)  有人在等你

# 任意时刻(甚至重启进程后)恢复:传入人类的决定
graph.invoke(Command(resume="同意发布"), config)
```

机制解读:

- `interrupt()` 抛出"暂停信号",图停在该节点,**状态已存入 checkpointer**;
- 恢复时必须带 `thread_id`,LangGraph 从存档里找到卡住的位置,把 `resume` 的值
  作为 `interrupt()` 的返回值,节点接着执行;
- 教程用 `InMemorySaver`(内存存档);生产换 `langgraph-checkpoint-postgres` 等持久化实现,
  暂停才能跨进程、跨天存活(审批等一天是常态)。

demo 的两次 invoke 之间打印了暂停状态,预期输出:

```
图已暂停,待执行节点:('review',)  <- 有人在等你审批
第 2 次 invoke:传入人类的决定,图从暂停点继续
[publish] 已发布!(假装调用了发布 API)
```

`thread_id` 同时也是**多会话隔离键**:不同 thread 的图实例互相独立——
第 5 章"会话隔离自己做"的欠账,这里由 checkpointer 正式还上。

## 6. 常见坑

1. **节点忘记返回 dict** —— 节点函数必须返回增量 dict(哪怕 `{}`),返回 None 会导致状态不更新;
2. **在节点里直接改传入的 state** —— 应返回增量让 LangGraph 合并;直接改副本不可靠;
3. **条件边的路由函数返回了映射表里没有的名字** —— 图不知道去哪,直接报错;
4. **忘了 checkpointer 就用 interrupt** —— 没有存档就没有"暂停点",恢复无从谈起;
5. **supervisor 循环无上限** —— 配 `recursion_limit`;
6. **把 InMemorySaver 带上生产** —— 进程一重启存档全丢,等于没持久化。

## 7. 小结与练习

StateGraph = 状态黑板 + 节点函数 + (条件)边。四个 demo 覆盖了 90% 的日常用法:
线性流水线、条件分支、supervisor 循环、持久化中断。

**练习**:

1. 给 9-2 的投诉分支后加一个"升级人工"节点(投诉关键词再命中则进);
2. 把 9-3 的 researcher 节点换成第 7 章的 RAG 检索(黑板里存检索结果);
3. 给 9-4 的 publish 节点换成真实动作前,先让图在 publish 前再加一道 interrupt(双重审批)。

最后一章:把这一切推向生产——可观测、缓存、限流、服务化。
