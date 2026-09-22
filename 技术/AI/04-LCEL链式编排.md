---
tags: [AI]
---

# 第 4 章 · LCEL 链式编排:把零件接成流水线

> 本章目标:系统掌握 LCEL(LangChain Expression Language)。它不只是 `|` 语法糖——
> 一旦你的逻辑装进 Runnable,就**免费**获得流式、并发、重试、降级、异步等全套能力。
>
> 对应 demo:`basic_chain.py`、`parallel_branch.py`、`fallback_retry.py`、`router_branch.py`

---

## 1. 先把两个名词说人话:LCEL 与 Runnable

这两个词会贯穿本书,先用白话钉死:

- **LCEL**(LangChain Expression Language):LangChain 的"链式书写语法"。没有玄妙内容,核心就是管道符 `|`——把零件一个个接起来,像接水管;
- **Runnable**(可运行的东西):LangChain 给**所有零件**定的统一标准,类比"所有电器统一用同一种插头"。

第 2、3 章你已经零星用过 `prompt | llm | parser`。LCEL 的核心只有一个约定:

> **Runnable = 有 `invoke / batch / stream` 三个方法的组件**。
> prompt、llm、parser、你写的普通函数(包成 RunnableLambda)、由它们组成的链——全是 Runnable。

因为协议统一,所以能任意拼接:

```
prompt ──|──> llm ──|──> parser ──|──> 你的函数
 (Runnable)  (Runnable)  (Runnable)   (RunnableLambda)
```

而拼接出来的**链本身也是 Runnable**,可以继续拼接、可以嵌进另一个链、可以 `batch`、可以 `stream`。
这就是为什么值得把逻辑"装进链":装进去一次,能力全家桶全部继承。

## 2. Demo 4-1 · basic_chain.py:三件套 invoke/batch/stream

```python
chain = prompt | get_llm() | StrOutputParser() | RunnableLambda(add_prefix)

chain.invoke({"country": "日本"})          # 单次
chain.batch([{...}, {...}])                # 并发多条
for chunk in chain.stream({...}): ...      # 流式
```

三个要点:

1. **invoke 的输入形态跟随链条第一环**:第一环是模板,就传变量字典;
2. **batch 并发且保序**:`batch` 的结果顺序与输入一一对应(第 3 章已用过);
3. **RunnableLambda 把普通函数接入链**——非模型步骤(格式化、过滤、计算)不必劳烦模型;
   注意 demo 里 stream 的最后一环是 Lambda:非流式环节会把上游攒齐后整段输出,
   想要全程流式,把 `| RunnableLambda(...)` 留在 stream 的链之外(如 demo 所示)。

## 3. Demo 4-2 · parallel_branch.py:多路并发

```python
parallel = RunnableParallel(
    summary=make_chain("你是新闻编辑", "..."),      # 分支 1:摘要
    title=make_chain("你是新媒体小编", "..."),       # 分支 2:标题
    word_count=RunnableLambda(lambda x: len(x["article"])),  # 分支 3:普通函数
)
result = parallel.invoke({"article": article})
# -> {"summary": "...", "title": "...", "word_count": 85}
```

要点:

- `RunnableParallel` 用**字典字面量**声明分支,输出是与字典同构的 dict;
- 两条模型分支**并发**执行,总耗时 ≈ 最慢分支,而不是两条相加;
- 分支不一定是链,`RunnableLambda` 也行——同一份输入,模型分支与非模型分支混排;
- 另一个高频用法:**用 RunnablePassthrough 给下游"同时保留原输入"**(第 7 章 RAG 链里会正式登场)。

## 4. Demo 4-3 · fallback_retry.py:重试与降级

LLM API 的三类常见失败:网络抖动 / 限流 429 / 服务 5xx。LCEL 用两个方法兜底:

```python
resilient = (
    primary.with_fallbacks([backup])        # 主链挂了 -> 自动切备用链
           .with_retry(stop_after_attempt=2) # 瞬时错误 -> 自动重试
)
```

| 方法 | 对付什么 | 原理 |
|------|----------|------|
| `with_retry(n)` | 瞬时错误(超时、429) | 同一条链再试,指数退避 |
| `with_fallbacks([...])` | 确定性失败(模型下线、配额耗尽) | 换一条链接着跑 |

demo 故意把主链的模型名写错(`glm-not-exist-9999`),观察输出:

```
降级后成功获得回复:
 幂等性是指同一个操作执行一次和执行多次,效果完全相同...
```

主链报"模型不存在"→ fallback 自动接管 → 备用链正常返回。**业务代码全程无感**。
生产建议:主链用旗舰模型 + 备链用便宜模型,牺牲质量保可用;或反过来省成本。

## 5. Demo 4-4 · router_branch.py:链内条件路由

第 3 章 classifier.py 的路由发生在"你的 Python 代码里"(分类完,查字典,再调第二条链)。
`RunnableBranch` 把路由搬进链对象内部:

```python
router = RunnableBranch(
    (is_code_question,   code_chain),     # (条件函数, 命中后的链)
    (is_english_learner, english_chain),
    general_chain,                        # 末尾单写一个链 = 默认分支
)
router.invoke({"question": "..."})
```

- 条件函数签名:输入 dict → bool,按顺序匹配,命中即停;
- 与第 3 章方案可无缝结合:**条件不用关键词匹配,改用结构化分类**——
  先跑分类链拿 `Intent`,条件函数读 `intent.category`;
- 最大收益:router 是**一个** Runnable,可以整体 `with_retry`、交给第 10 章的 FastAPI 暴露、
  供 LangSmith 追踪,路由细节对使用者完全透明。

更复杂的路由(多轮协商、循环、人工介入),LCEL 表达不了,那就是第 9 章 LangGraph 的舞台。

## 6. 何时用 LCEL,何时写普通代码

经验法则:

| 场景 | 建议 |
|------|------|
| 固定方向的"输入→加工→输出"流程 | LCEL 链(白得 batch/stream/重试) |
| 需要多路并发 | RunnableParallel |
| 需要失败兜底 | with_retry / with_fallbacks |
| 有状态(记忆)、循环、中途需要人审批 | 别硬凹 LCEL,用第 5 章 + 第 9 章的方案 |
| 一次性脚本里的普通字符串处理 | 普通 Python 就好,不必都包成 Runnable |

## 7. 常见坑

1. **输入形态对不上** —— 链第一环是模板就要传 dict;第一环是 RunnableLambda 就传它期待的原始类型;
2. **Lambda 里塞重逻辑** —— `RunnableLambda` 内的异常不会自动重试(它不是模型调用),重逻辑要自己处理错误;
3. **stream 遇到非流式环节被"截断"** —— parser/Lambda 之后就没有增量了,流式链要把这些放在 stream 之外;
4. **fallback 链配了同一个坏依赖** —— 备链与主链共用同一个失效组件等于没兜底,备链要真正独立;
5. **过度嵌套** —— 五层以上的链不如拆函数 + 少量链,可读性优先。

## 8. 小结与练习

LCEL = 统一 Runnable 协议 + `|` 组合。四大件:invoke/batch/stream、RunnableParallel 并发、
retry/fallback 容错、RunnableBranch 路由。

**练习**:

1. 给 4-2 的并行链再加一条分支:用第 3 章的 `with_structured_output` 输出新闻情感(Positive/Negative);
2. 把 4-4 的关键词路由换成结构化分类路由(Literal 三分类);
3. 给 4-1 的链加上 `with_retry`,并在 Lambda 里制造一个偶发异常,观察重试行为。

下一章:让应用"记得住"——会话记忆的三种实现。
