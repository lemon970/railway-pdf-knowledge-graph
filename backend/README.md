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
