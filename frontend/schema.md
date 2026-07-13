# 实验二知识图谱 Schema（第一轮草案）

> 首轮范围：`4.3 轮对轴箱装置`，主要依据 PDF 第 6–12 页、印刷页码第 29–35 页。数据仍需由组员对照原 PDF 页面完成最终复核。

## 1. 实体类型

| 类型 | ID 格式 | 建议属性 | 说明 |
|---|---|---|---|
| Component 部件 | `COMP_001` | name, alias, category, source_page | 设备、部件或结构对象 |
| Defect 缺陷 | `DEF_001` | name, symptom, severity, source_page | 故障、缺陷或异常现象 |
| Action 处置措施 | `ACT_001` | name, step, condition, source_page | 检查、维修、更换等措施 |
| Standard 标准限度 | `STD_001` | indicator, value_min, value_max, unit, condition, source_page | 尺寸、间隙、压力等标准值 |
| Procedure 流程步骤 | `PROC_001` | name, sequence, prerequisite, source_page | 检修或检查流程 |

## 2. 关系类型

| 关系 | 起点 | 终点 | 含义 |
|---|---|---|---|
| `PART_OF` | Component | Component | 部件组成关系 |
| `HAS_DEFECT` | Component | Defect | 部件存在某缺陷 |
| `REQUIRES_ACTION` | Defect | Action | 缺陷对应处置措施 |
| `HAS_STANDARD` | Component/Defect | Standard | 对象对应标准限度 |
| `NEXT_STEP` | Procedure | Procedure | 流程先后关系 |
| `APPLIES_TO` | Standard | Component/Defect | 标准适用对象 |
| `INCLUDES` | Procedure | Action | 流程包含具体措施 |
| `SUPPORTED_BY` | Entity/Relation | Source | 由原文证据支持（如团队决定保留来源节点） |

## 3. 首轮实际实体

| ID | 类型 | 名称 | 依据 |
|---|---|---|---|
| `COMP_001` | Component | 轮对 | PDF 第6页 / 印刷页29，4.3.1 |
| `COMP_002` | Component | 车轮 | PDF 第6页 / 印刷页29，4.3.1.1 |
| `COMP_003` | Component | 车轴 | PDF 第8页 / 印刷页31，4.3.1.2 |
| `COMP_004` | Component | 轴箱轴承 | PDF 第10页 / 印刷页33，4.3.2 |
| `PROC_001` | Procedure | 轮对组装前检测与选配 | PDF 第12页 / 印刷页35，表4-5及4.3.1.3 |

## 4. 统一数据规则

- 每个实体和关系必须有唯一 ID。
- 每条记录必须保留 `source_file`、`pdf_page`、`print_page` 和 `evidence_note`。
- AI 只能辅助候选抽取，最终值、单位、关系方向和页码必须人工核对。
- 第一轮先用 5 个实体、8 条关系做小样本联调；后续扩展到课程要求的至少 30 个实体、40 条关系。

## 5. 查询类型

1. 部件关联：某部件由哪些部件组成，或与哪些对象关联？
2. 缺陷处置：某部件出现某缺陷时如何处理？
3. 标准限度：某指标的规定值、单位和适用条件是什么？
4. 流程步骤：某检修流程的前后步骤是什么？
