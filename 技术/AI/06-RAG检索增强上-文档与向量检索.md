---
tags: [AI]
---

# 第 6 章 · RAG(上):文档切分与向量检索

> 本章目标:理解 RAG 为什么能"喂"给模型私有知识,并跑通流水线的**前三步**:
> 加载切分 → 向量化 → 向量库检索。生成回答放到第 7 章。
>
> 对应 demo:`load_and_split.py`、`embeddings_demo.py`、`vector_store_search.py`
> 示例语料:`data/sample_docs/`(4 篇虚构公司文档:公司介绍、员工手册、产品说明书、技术笔记)

---

## 1. RAG 是什么:开卷考试

模型不知道你的私有数据(公司制度、产品文档),硬问它就编。**RAG(Retrieval-Augmented Generation,检索增强生成)** 的思路是把它变成"开卷考试":

```
                         ┌────────────── 离线:知识入库(本章 6-1/6-3)─────────────┐
 文档们 ──> 切分 Chunk ──> 向量化 ──> 存入向量库
                                     │
                         ┌────────── 在线:检索问答(第 7 章)─────────────────────┐
 用户提问 ──> 向量化 ──> 到向量库找语义最相近的 k 个块 ──> 塞进提示词 ──> LLM 生成有据回答
```

两个关键效果:

1. **答得上有据**:提示词里塞了真实文档片段,模型"抄材料"而不是"凭记忆编";
2. **知识即时更新**:换文档就换知识,不用重新训练/微调模型——这是 RAG 相对微调最大的优势。

一句话记忆:**RAG = 检索器(Retrieval)+ 生成器(Generation)**。本章做前者,第 7 章做后者。

## 2. Demo 6-1 · load_and_split.py:加载与切分

### 2.1 Document:LangChain 的文档原子

一切文档在 LangChain 里都是 `Document` 对象("对象"可理解为"程序里代表一份资料的东西"):

```python
Document(
    page_content="文档正文文本……",
    metadata={"source": "/path/employee_handbook.md"},  # 来源等元信息
)
```

`metadata` 看着不起眼,第 7 章回答要标注"出处是哪份文档"全靠它,Web 应用里还能用它做权限过滤(如只检索当前用户部门的手册)。

### 2.2 DirectoryLoader 与切分器

```python
loader = DirectoryLoader(str(DOCS_DIR), glob="**/*.md", loader_cls=TextLoader,
                         loader_kwargs={"encoding": "utf-8"})
docs = loader.load()   # 目录下全部文档 -> [Document, ...]

splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50)
chunks = splitter.split_documents(docs)
```

**RecursiveCharacterTextSplitter 为什么是默认之选**:它不是无脑每 300 字一刀,而是**递归地**
先按段落(`\n\n`)切,太长再按行(`\n`)、句子、字切——尽量让"语义单元"不被拦腰斩断。

两个参数的权衡:

| 参数 | 太小 | 太大 |
|------|------|------|
| `chunk_size` | 块太碎,上下文不完整,答非所问 | 块太长,塞满提示词、噪声多、检索不聚焦 |
| `chunk_overlap` | 重叠少,边界句子丢失 | 重叠多,入库重复、浪费 |

中文文档建议从 `chunk_size=300~500, chunk_overlap=50` 起调。markdown 还可用
`MarkdownHeaderTextSplitter` 按标题层级切(保留章节结构进 metadata),进阶时值得研究。

## 3. Demo 6-2 · embeddings_demo.py:向量化与余弦相似度

**Embedding(嵌入,也叫"向量化")** 把一段文字变成一长串按顺序排好的小数,如 `[0.12, -0.83, ...]`——这串数字就是文字的"语义坐标"(**向量**就是"一串排好序的数字")。magic 在于:**意思相近的文字,坐标也相近**。

demo 用智谱 `embedding-3`(同样走 OpenAI 兼容端点,`shared/llm.py` 的 `get_embeddings()` 已封装)
对三条文本向量化,再用纯 Python 手算**余弦相似度**——名字唬人,含义简单:给"两个语义坐标的方向有多接近"打个分,越接近 1 越相似,完全不需要数学基础:

```
查询:'年假有几天?' 与三条文本的相似度:
  0.5821  <- 员工每年有 5 天带薪年假
  0.5533  <- 年假可以顺延到明年 3 月使用
  0.1207  <- 这款音箱支持蓝牙 5.3 连接
```

查询和"蓝牙音箱"没有共同词汇,相似度却垫底;和"年假"措辞不同的两句相似度遥遥领先——
**这就是"按意思检索"而非"按字面检索"** 的全部秘密,也是 RAG 能答上"换种说法的问题"的原因。

两个 API 的分工:

- `embed_documents([...])`:批量向量化**文档块**(入库前一次性做);
- `embed_query("...")`:向量化**查询**(每次提问时做)。

## 4. Demo 6-3 · vector_store_search.py:向量库与 Retriever

向量库 = 存向量 + 高效最近邻搜索。教程选 **Chroma**:纯本地、pip 装完即用,原型与学习场景最合适。
生产替换选项:Milvus(超大规模)、PGVector(适合已在用 PostgreSQL 数据库的团队)、Elasticsearch(适合还要关键词搜索)。都是现成的数据库产品,用到时再了解即可。

```python
from langchain_chroma import Chroma

db = Chroma.from_documents(
    chunks, get_embeddings(),
    persist_directory=str(DB_DIR),   # 持久化到磁盘,重启不用重新向量化
    collection_name="tutorial",
)

hits = db.similarity_search("年假可以攒到明年吗?", k=2)
# hits: list[Document],按相关度降序,metadata 自动继承
```

最后一步,把向量库包装成**标准 Retriever**:

```python
retriever = db.as_retriever(search_kwargs={"k": 3})
docs = retriever.invoke("问题")     # 只见 query 进、Documents 出,不关心底层是什么库
```

`Retriever` 是 LangChain 定义的检索统一接口——下游(第 7 章的 RAG 链)**只认这个接口**。
明天你把 Chroma 换成 Milvus,只要还能 `as_retriever()`,RAG 链一行不改。

## 5. 检索质量的常见杀手(先知道,第 7 章应对)

1. **切分破坏语义** —— QA 对被切成两半;对策:调 chunk 参数或按结构切分;
2. **查询与文档"词不匹配"** —— 用户说"攒到明年",文档写"顺延";向量检索通常能扛,极端时需改写查询;
3. **检索到的块答非所问** —— 缺相关性过滤,可设相似度阈值过滤低分块;
4. **top_k 太小漏答案、太大塞噪声** —— 从 k=3~5 起调。

## 6. 小结与练习

RAG 离线三步:加载(Loader)→ 切分(Splitter)→ 入库(VectorStore);检索统一入口:Retriever。
**练习**:

1. 把 `chunk_size` 分别改成 100 和 1000,对比 6-3 中"年假可以攒到明年吗?"检索到的块质量;
2. 在 6-1 中给 metadata 手动加一个 `{"doc_type": "handbook"}` 字段并打印;
3. (进阶)查一下 `MarkdownHeaderTextSplitter` 的用法,用它按"## 标题"切员工手册,观察 chunk 变化。

下一章:把 Retriever 接上 LLM,组装出真正能回答问题的 RAG 应用。
