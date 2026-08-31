# 评测脚本

`run_evaluation.py` 读取 `data/evaluation/questions.csv`，先检查 API 和 Neo4j 健康状态，再逐题调用自然语言问答接口。结果包含预测意图、答案、证据、预期答案、通过状态和失败原因。

## 运行

默认连接 `http://127.0.0.1:8000`，可用 `--base-url` 指定正在运行的服务：

```powershell
.\.venv\Scripts\python.exe scripts\evaluation\run_evaluation.py --base-url http://127.0.0.1:8027
```

默认结果写入带时间戳的 `output/evaluation/results-*.csv`，不会覆盖之前的结果。也可以显式指定路径：

```powershell
.\.venv\Scripts\python.exe scripts\evaluation\run_evaluation.py `
  --base-url http://127.0.0.1:8000 `
  --output output/evaluation/results-20260831.csv
```

退出码：`0` 表示全部通过，`1` 表示服务可用但存在失败题目，`2` 表示题库无效或服务/数据库不可用。

## 题库字段

```text
question_id,category,question,expected_answer,evidence_page,status
```

`category` 必须是四类受控意图之一；有答案题的 `evidence_page` 必须填写 PDF 页码，无答案题将 `expected_answer` 写为 `未找到证据` 并留空页码；正式评测题必须标记为 `reviewed`。脚本不会把 `draft` 题目带入评测。
