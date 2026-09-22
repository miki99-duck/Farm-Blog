---
tags: [AI]
---

# 第 2 章 · Prompt 工程:模板与 Few-shot

> 本章目标:把提示词从"散落在代码里的字符串"升级为**可复用、可传参、可测试的模板**,
> 并掌握两个提效大招:few-shot 示例与"提示词→模型→解析器"链。
>
> 对应 demo:`prompt_template.py`、`few_shot.py`、`template_chain.py`

---

## 1. 为什么提示词需要工程化

提示词(prompt)是你对模型下达的完整指令,直接决定输出质量。但把长字符串用 f-string 手工拼接,很快会遇到:

- 变量一多,`f"..."` 嵌套引号读到头晕;
- 同样的 system 提示词在 10 个接口里复制粘贴,改一处漏九处;
- 没法在不调模型的情况下**检查**最终发给模型的是什么。

`ChatPromptTemplate` 就是为解决这三件事而生的:**模板与数据分离、统一管理、可单独渲染**。

## 2. Demo 2-1 · prompt_template.py:模板与变量

```python
prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "你是资深文案,文字风格:{style}。"),
        ("human", "为一款{name}写一句广告语,目标人群是{audience}。"),
    ]
)
```

- `from_messages` 接收 `(角色, 内容)` 列表,角色是 `"system" / "human" / "ai" / "placeholder"`;
- 花括号 `{var}` 是变量占位符,**语法和 f-string 无关**,由模板自己解析;
- 调用模板必须传**字典**:`prompt.invoke({"style": "冷幽默", ...})`。

demo 里演示了一个好习惯——**先干跑,再真跑**:

```python
rendered = prompt.invoke({...})          # 只渲染,不调模型
for msg in rendered.to_messages():       # 检查每条消息长什么样
    print(f"[{msg.type}] {msg.content}")

response = llm.invoke(rendered)          # 确认无误后再调用模型
```

提示词出错时(比如变量名拼错),干跑能立刻发现,**零 token 成本**。

**预期输出**:

```
渲染后的消息列表:
  [system] 你是资深文案,文字风格:冷幽默。
  [human] 为一款智能门锁写一句广告语,目标人群是养猫的年轻人。

广告语:猫都挠不开——除非它认识你。(示例,实际输出随机)
```

## 3. Demo 2-2 · few_shot.py:用示例代替描述

有些任务"说不清但看得懂",比如"把句子改成傲娇猫娘语气"。与其写 500 字的风格说明书,不如直接给模型看 3 个例子——这叫 **few-shot(少样本)提示**。

结构上多了一个 `MessagesPlaceholder`:

```python
prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "把用户的话改写成傲娇猫娘的语气。只输出改写结果。"),
        MessagesPlaceholder("examples"),   # 预留槽位,运行时注入一整段消息
        ("human", "{input}"),
    ]
)
```

`MessagesPlaceholder` 与 `{var}` 的区别:占位符填的是**一段文字**,Placeholder 填的是**一组消息**。运行时:

```python
examples = [
    HumanMessage(content="今天天气真好"),
    AIMessage(content="哼,本喵才不是特意看天气呢……不过,今天确实是个好天气喵~"),
    # ... 成对出现,3 组示例
]
llm.invoke(prompt.invoke({"examples": examples, "input": "我考过了驾照"}))
```

模型最终看到的消息序列是:`system → 3 组示例对话 → 用户的新输入`。**示例的质量和一致性,就是模型模仿的上限**——示例里有错别字,输出大概率也有。

few-shot 的典型生产场景:固定格式的改写、内部黑话翻译、抽取任务的"标准答案示范"。

## 4. Demo 2-3 · template_chain.py:第一次组装链

第 2 章 demo 1 里我们是"渲染模板 → 手动 `llm.invoke(rendered)`"两步走。LangChain 提供了管道运算符把零件串起来:

```python
from langchain_core.output_parsers import StrOutputParser

chain = prompt | llm | parser      # StrOutputParser 把 AIMessage 剥成纯 str

result = chain.invoke({"code": "..."})   # 直接传模板变量,返回 str
```

这就是 **LCEL(LangChain Expression Language,LangChain 的拼接语法)** 的雏形:`|` 把上一个组件的输出接到下一个组件的输入,像接水管一样。这名字先不用深究,记住"用 `|` 接水管"这个动作就行——第 4 章会系统讲它的全部能力(并行、分支、重试)。

**预期输出**(针对示例代码中的 `ids[i] != None`、`range(len(ids))` 等,模型会指出):

```
1. 用 `ids[i] != None` 判断None应写为 `is not None`。
2. 遍历列表应直接 for id in ids,无需下标。
3. 建议补充类型注解: def get_user(ids: list[int]) -> list[int]:
```

## 5. 写好提示词的 6 条实战原则

模板只是容器,内容质量仍靠你。浓缩 6 条(本教程后续 demo 均按此风格书写):

1. **给角色**:system 里说明身份("你是代码审查助手")比 openai 式裸问效果好;
2. **给约束**:输出长度、格式、语气,写成明确的编号要求;
3. **给例子**:规则难描述就用 few-shot;
4. **要"只输出"**:明确说"只输出结果,不要解释",减少废话;
5. **变量语义化**:`{code}` 好过 `{text_1}`,模板可读性即代码可读性;
6. **先干跑**:复杂模板先 `format_messages` 检查,再花 token。

## 6. 常见坑

1. **变量名拼错** —— `invoke({"cod": ...})` 会 KeyError;因为模板变量是字典键,IDE 不检查;
2. **文本里出现花括号** —— 想输出字面 `{}` 需写成 {% raw %}`{{}}`{% endraw %}(和 f-string 一样);
3. **few-shot 示例太少或太一致** —— 2 个示例模型开始猜;示例全是同类句式,模型只会复读该句式,需覆盖不同情况;
4. **把规则写在 human 消息里** —— 规则应放 system;human 只放"本次的输入";
5. **示例顺序影响输出** —— 模型会偏向最近的示例,把最重要的例子放最后。

## 7. 小结与练习

模板(ChatPromptTemplate)→ 变量({var})→ 消息槽位(MessagesPlaceholder)→ few-shot → 链(prompt|llm|parser)。

**练习**:

1. 把 2-1 的模板加一个 `{length}` 变量控制广告语字数;
2. 为"中译英(保留人名不译)"任务写 3 组 few-shot 示例,测试"小明去北京大学"这句;
3. 把 2-3 的链改造:模板加 `{language}` 变量,让审查建议用指定语言输出。

下一章:让模型输出**程序能用的数据**——结构化输出。
