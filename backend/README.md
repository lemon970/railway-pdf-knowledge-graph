# 后端

后端采用 FastAPI、Pydantic 和 Neo4j Python Driver。当前已完成受控查询契约；HTTP 接口将在下一阶段基于该契约实现。

## 受控查询契约

`backend/app/query_templates.py` 只提供以下四类参数化只读查询：

| 意图值 | 用途 | 使用的关系 |
| --- | --- | --- |
| `component_association` | 查询部件的上级或下级部件 | `PART_OF` |
| `defect_action` | 查询部件或缺陷对应的处理措施 | `HAS_DEFECT`、`REQUIRES_ACTION` |
| `limit_standard` | 查询部件、措施或工序对应的限度标准 | `HAS_STANDARD` |
| `procedure_steps` | 查询某工序的下一步骤 | `NEXT_STEP` |

输入由 `QuestionQuery` 校验，只包含 `intent` 和 `subject`。`subject` 通过 Neo4j 参数传递，不拼接进 Cypher。

统一答案 `QuestionAnswer` 包含：

- `intent`、`subject`、`found` 和 `answer`；
- 涉及的 `entities` 和 `relations`；
- 带 PDF 页码、印刷页码和规程原文的 `evidence`。

有答案时必须携带证据。没有证据时统一返回 `found=false` 和 `answer="未找到证据"`，且不得夹带实体、关系或证据结果。

运行查询测试：

```powershell
.\.venv\Scripts\python.exe -m pytest tests\queries -q
```

其中 Neo4j 集成测试要求本地数据库已经启动且 `.env` 配置有效。

## 启动 API

从仓库根目录执行：

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

启动后可以访问 `http://127.0.0.1:8000/docs` 调试以下接口：

| 方法和路径 | 用途 |
| --- | --- |
| `GET /health` | 检查应用和 Neo4j 连接状态 |
| `POST /api/questions` | 按受控意图和主题查询答案及证据 |
| `POST /api/natural-questions` | 将自然语言映射到受控意图后查询 |
| `GET /api/graph/{entity_id}` | 查询一个实体的直接邻域节点和关系 |

结构化问答请求示例：

```json
{
  "intent": "defect_action",
  "subject": "车轮直径小于Φ800mm"
}
```

数据库离线时返回 HTTP `503` 和固定错误码 `DATABASE_UNAVAILABLE`，不会返回连接串、账号、密码或驱动堆栈。实体不存在时图谱接口返回 HTTP `404` 和错误码 `ENTITY_NOT_FOUND`。

## 可选 AI 意图映射

AI 默认关闭。关闭时 `/api/natural-questions` 使用本地关键词规则识别四类问题，基础问答不依赖网络。

需要使用兼容 Chat Completions 的接口时，在本地 `.env` 中配置：

```dotenv
AI_ENABLED=true
AI_BASE_URL=https://example.com/v1
AI_API_KEY=your-local-secret
AI_MODEL=your-model-name
```

远程接口必须使用 HTTPS；只有 `localhost`、`127.0.0.1` 和 `::1` 可以使用 HTTP。模型响应必须是只含 `intent` 和 `subject` 的 JSON，额外字段、未知意图、空主题、超时和无效 JSON 都会被拒绝并退回本地规则。模型输出不会作为 Cypher 执行。

自然语言请求示例：

```json
{
  "question": "车轮直径小于Φ800mm怎么处理？"
}
```

响应中的 `processing_method` 为 `rule` 或 `ai`；结构化接口返回 `structured`。
