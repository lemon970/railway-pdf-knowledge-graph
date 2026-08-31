# 四类功能演示脚本

## 演示前提

演示前先确认 Neo4j 已启动、后端已运行，并且健康检查返回数据库已连接：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

前端开发地址通常为 `http://127.0.0.1:5173`；单服务构建版本使用启动命令中指定的端口。当前正式数据支持四类查询，正式表包含 65 个实体和 55 条已审核关系。成员 C 的 48 个实体和 47 条关系虽已完成修复，但因同名概念可能造成返回结果歧义，仍为 `draft`，不进入正式演示；成员 D 的原始提交目录保留提交版本，复核后的 60 个实体和 50 条关系已进入正式表。工序步骤可使用“清洗轴承→轴承外观检查→轴承检测与选配→轴承压装→涂抹密封胶→安装轴箱”链路演示。

## 演示顺序

打开前端后，依次提交以下自然语言问题。每次都检查答案、证据中的 PDF 页码和印刷页码，并在结果出现后查看图谱邻域。

| 类别 | 输入问题 | 预期识别意图 | 当前数据条件 |
| --- | --- | --- | --- |
| 部件关联 | `车轮（含轮盘）属于哪个部件？` | `component_association` | 正式表有 `车轮（含轮盘） PART_OF 轮对` |
| 缺陷处理 | `车轮直径小于Φ800mm时如何处理？` | `defect_action` | 正式表有缺陷到处理措施的证据 |
| 限度标准 | `车轮（含轮盘）的限度标准是什么？` | `limit_standard` | 正式表有 `车轮（含轮盘） HAS_STANDARD` |
| 工序步骤 | `清洗轴承下一步工序是什么？` | `procedure_steps` | 正式表有 `清洗轴承 NEXT_STEP 轴承外观检查` |

## 结构化接口复核

自然语言演示后，可用结构化接口确认意图和主题没有被前端展示层改写。PowerShell 示例：

```powershell
$body = @{ intent = 'component_association'; subject = '车轮（含轮盘）' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/questions `
  -ContentType 'application/json; charset=utf-8' -Body $body
```

把 `intent` 和 `subject` 替换为以下组合：

```text
defect_action    / 车轮直径小于Φ800mm
limit_standard   / 车轮（含轮盘）
procedure_steps  / 清洗轴承
```

有答案时应看到：

- `found=true`；
- `answer` 为查询结果；
- `entities`、`relations` 和 `evidence` 非空；
- `evidence` 同时包含 `pdf_page`、`printed_page` 和 `source_text`；
- `focus_entity_id` 对应返回实体，可继续加载图谱。

无答案时固定为：

```json
{
  "found": false,
  "answer": "未找到证据",
  "entities": [],
  "relations": [],
  "evidence": []
}
```

## 图谱邻域演示

从答案中的 `focus_entity_id` 取实体 ID，例如正式样例中的 `C002`：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/graph/C002
```

前端应显示中心实体、相邻节点、关系类型和证据页码。实体不存在时接口返回 `404 ENTITY_NOT_FOUND`；数据库未连接时返回 `503 DATABASE_UNAVAILABLE`。

## 批量评测

题库 `data/evaluation/questions.csv` 当前包含 16 道 `reviewed` 题目，四类意图各 4 道。启动后端并确认健康检查通过后运行：

```powershell
.\.venv\Scripts\python.exe scripts\evaluation\run_evaluation.py `
  --base-url http://127.0.0.1:8000 `
  --output output/evaluation/results-20260831.csv
```

退出码为 `0` 表示 16 道题全部通过，`1` 表示服务可用但有失败题目，`2` 表示题库无效或服务、数据库不可用。结果文件记录预测意图、答案、证据和失败原因，不要把 `output/` 或本地临时结果提交到仓库。

## 现场讲解口径

演示时只陈述接口实际返回的证据。不要把 OCR 候选、提交目录中的未复核记录、或前端固定测试数据当作正式知识；正式演示以 `data/import/` 中的 `reviewed` 记录为准。题库中的无答案题仍应保持“未找到证据”，不能补写规程内容。
