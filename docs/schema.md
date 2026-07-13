# 知识图谱 Schema V1

## 本节小结

第一版固定五类实体和五类关系，先满足课程指标和四类查询。任何新增类型都必须先修改本文档并通过 Pull Request 复核。

## 实体类型

| 类型 | 中文含义 | 示例方向 |
| --- | --- | --- |
| `Component` | 部件、零件、装置 | 轮对、车轮、车轴 |
| `Defect` | 缺陷或异常状态 | 裂纹、磨耗、松动 |
| `Action` | 检查或处理措施 | 检查、测量、更换 |
| `Standard` | 限度或技术要求 | 尺寸、间隙、温度要求 |
| `Procedure` | 有顺序的检修步骤 | 清洗、探伤、组装步骤 |

## 关系类型

| 类型 | 起点 -> 终点 | 含义 |
| --- | --- | --- |
| `PART_OF` | Component -> Component | 部件属于另一部件 |
| `HAS_DEFECT` | Component -> Defect | 部件可能出现缺陷 |
| `REQUIRES_ACTION` | Component/Defect -> Action | 对部件或缺陷采取措施 |
| `HAS_STANDARD` | Component/Action/Procedure -> Standard | 对应技术标准 |
| `NEXT_STEP` | Procedure -> Procedure | 后续工序 |

## 命名规则

- 实体名称优先使用规程原文；
- 不把同义词擅自合并，发现疑似同义词时在 Issue 中讨论；
- ID 使用类型前缀和三位序号，如 `C001`、`D001`、`A001`、`S001`、`P001`；
- 关系 ID 使用 `R` 加三位序号，如 `R001`；
- 状态只允许 `draft`、`reviewed`、`approved`；
- 单位必须保留，不得只录入数值。

