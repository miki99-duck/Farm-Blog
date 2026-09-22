---
tags: [AI]
---

# 第 8 章 · 工具调用与 Agent:让模型"动手"

> 本章目标:理解 tool calling 的完整机制(先手动实现,再看框架封装),
> 掌握 LangChain 1.0 的智能体标准 API `create_agent`,并学会让智能体输出结构化结果。
>
> 对应 demo:`tool_calling_basics.py`、`create_agent_demo.py`、`agent_structured_output.py`

---

## 1. 核心认知:模型不执行工具,只"点菜"

LLM 生成文本,拿不到你的数据库,也不知道现在几点。**工具调用(tool calling)** 的本质是一套约定好的沟通流程:

```
你:注册工具清单(名字+参数说明+用途描述)给模型
模型:不回答,而是说"请帮我调用 get_weather,参数 city=杭州"   <- tool_calls
你:在自己的代码里执行真正的函数,把结果回传给模型
模型:看到结果,组织成自然语言的最终回答
```

关键认知:**执行永远发生在你的机器上**。模型只是"点菜",做菜的是你的代码——
所以工具可以查内部数据库、调内部 API,只要你的函数能干的,智能体都能干。
这也意味着:**工具函数的安全性 100% 是你的责任**(demo 里的 `calculator` 做了白名单校验,原因见坑 4)。

## 2. Demo 8-1 · tool_calling_basics.py:手动走一遍内循环

### 2.1 定义工具:docstring 就是模型的使用说明书

```python
from langchain_core.tools import tool

@tool
def get_current_time() -> str:
    """获取当前的日期和时间。当用户询问现在几点、今天几号时使用。"""  # <- 模型读这个!
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
```

`@tool` 会把函数签名(参数名、类型)+ docstring 转成模型理解的结构化描述。
**docstring 不是注释,是提示词**:写清"干什么 + 什么时候用",模型才会在正确的时机选它。

### 2.2 四步循环

```python
llm_with_tools = llm.bind_tools([get_current_time, roll_dice])   # 1) 登记

ai_msg = llm_with_tools.invoke(messages)                          # 2) 模型点菜
print(ai_msg.tool_calls)   # [{'name': 'get_current_time', 'args': {}, 'id': 'call_xxx'}]

result = get_current_time.invoke(tc["args"])                      # 3) 你执行
messages.append(ToolMessage(content=str(result), tool_call_id=tc["id"]))

final = llm_with_tools.invoke(messages)                           # 4) 回传结果,模型收尾
```

第 3、4 步的 `tool_call_id` 必须与请求一一对应——消息序列里每个工具结果都要能对上"是哪次点菜的菜"。

**预期输出**(第二步的 tool_calls):

```
模型返回的 tool_calls:
  工具:get_current_time,参数:{}
  工具:roll_dice,参数:{'sides': 20}
```

注意:一句话里的**两个**需求,模型一次列出两个调用;`sides: 20` 是它从"20面"里抽出来的参数——
这就是模型在"填单子"。

## 3. Demo 8-2 · create_agent_demo.py:1.0 的标准答案

上面四步如果只走一轮就结束,模型只能"点一次菜"。真实任务常常需要
**点菜 → 吃菜 → 再点菜 → …**(如"先查日期,再算天数")。把 while 循环、消息管理、
结束判断全部封装好,就是 `create_agent`——LangChain 1.0 的核心抽象
(取代 0.x 的 `AgentExecutor` 与 langgraph.prebuilt 的 `create_react_agent`):

```python
from langchain.agents import create_agent

agent = create_agent(
    get_llm(temperature=0),
    tools=[calculator, get_weather, get_today],
    system_prompt="你是一位能干的助理,善用工具回答问题。",
)

result = agent.invoke({"messages": [("user", "今天几号?再算算距离2027年元旦还有多少天?")]})
answer = result["messages"][-1].content   # 最后一条 = 最终回答
```

### Agent 内部发生了什么

`create_agent` 返回的其实是一个 LangGraph 图(所以第 9 章是它的"原生进阶"):

```
        ┌────────────────────────────────────────┐
   ──>  │  model 节点:LLM 看全部消息,决定下一步    │
        │    ├─ 想调工具 ──> tools 节点:执行工具 ──┐ │(工具结果回传,再来一轮)
        │    └─ 不调工具 ──> 输出最终回答,结束       │ │
        └──────────────────────────────▲───────────┘ │
                                       └─────────────┘
```

demo 打印了完整消息轨迹,你会看到类似:

```
Q:今天几号?再算算距离 2027 年元旦还有多少天?
  [调用工具] get_today({})
  [工具结果] 2026-09-12
  [调用工具] calculator({'expression': '(2027-01-01 - 2026-09-12).days'})  ← 实际为模型生成的算式
  [工具结果] 111
  [回答] 今天是 2026 年 9 月 12 日,距离 2027 年元旦还有 111 天。
```

模型自主决定了"先查日期 → 再算差值 → 最后汇总",**没有一行流程是你在代码里写死的**——
这就是 Agent 与第 4 章固定链的本质区别:链是**你**排好的流水线,Agent 是**模型**现场决策的流程。

## 4. Demo 8-3 · agent_structured_output.py:智能体交"标准报告"

智能体的中间过程是"自由发挥"的,但企业下游系统往往要标准格式(写工单、入库、通知)。
`create_agent` 的 `response_format` 参数解决:

```python
agent = create_agent(model, tools=[lookup_product], response_format=ProductReport)

result = agent.invoke({"messages": [("user", "查一下小星4Pro的报价")]})
report: ProductReport = result["structured_output"]   # 第 3 章的 Pydantic 对象:可直接 report.price 取字段
```

机制:智能体先正常跑完"干活阶段"(调工具查资料),最后再做一次结构化整理,
按 schema 产出 `structured_output`。**干活用工具,交差用 schema**——这正是第 3 章
结构化输出的能力在 Agent 上的延伸。

## 5. MCP:工具生态的下一站

写好一个 `@tool`,只有你的程序能用。**MCP(Model Context Protocol)** 是把"工具服务化"的开放标准(一套大家都遵守的公开规矩):
工具封装成独立 MCP Server,任何支持 MCP 的客户端(LangChain、Claude、Cursor…)都能即插即用。
类比:第 6 章的 Retriever 统一了"检索"接口,MCP 统一了"工具提供"接口。
LangChain 1.0 可通过 `langchain-mcp-adapters` 把 MCP Server 的工具直接加载进 `create_agent`。
入门阶段不必急,知道有这条路即可。

## 6. 常见坑

1. **docstring 缺失或敷衍** —— 模型全靠它决定"何时用、怎么填参",一句话工具基本不会被选中;
2. **参数类型不标注** —— `def f(x)` 模型不知道 x 是数字还是字符串;务必写类型注解;
3. **工具返回对象而不是字符串** —— ToolMessage 要文本;返回 dict/list 时先 `json.dumps` 或转 str;
4. **把 eval/SQL 拼接直接当工具** —— 模型输出不可信,`calculator` 的正则白名单是最低要求;
   任何危险操作(删数据、付款)必须加人工确认(第 9 章 human-in-the-loop);
5. **给 Agent 塞一堆相似工具** —— 模型选择困难;工具宜精不宜多,相似的合并成一个带参数的;
6. **没有步数上限** —— 模型可能循环调用,生产要设最大迭代数(如 recursion_limit)并监控。

## 7. 小结与练习

tool calling 四步:登记 → 点菜(tool_calls)→ 你执行 → 回传收尾。
`create_agent` 把循环封装成 1.0 标准抽象,`response_format` 让智能体交标准格式。

**练习**:

1. 给 8-2 加一个 `send_email(to, subject, body)` 假工具(只打印不发送),测试模型会不会真去调;
2. 写一个查询 `data/sample_docs` 的 RAG 工具(内部用第 7 章的 retriever),让 Agent "查文档回答员工问题"——这就是 Agent + RAG 的合体;
3. 思考:8-3 的 `response_format` 整理阶段如果失败(模型没按 schema 填),程序里该怎么兜底?(提示:with_retry / fallback)。

下一章:当流程需要"固定骨架+灵活分支+人工把关"时,上 LangGraph。
