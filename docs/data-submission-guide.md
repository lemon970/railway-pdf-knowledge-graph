# 知识数据交付指南

## 小结

C、D两位数据负责人各提交一对CSV文件：一个保存实体，一个保存关系。每条数据必须能定位到PDF页码、印刷页码和规程原句；成员提交时统一使用 `draft`，由另一名成员对照原页后才能改为 `reviewed`，最终只有组长可以确认 `approved`。提交前必须运行校验器，校验失败的数据不进入Pull Request。

## 1. 分工与文件位置

| 负责人 | 内容范围 | ID号段 | 文件目录 |
| --- | --- | --- | --- |
| C | 4.3.1.1车轮 | 各类型100～199，关系R100～R199 | `data/submissions/member-c/` |
| D | 4.3.1.2车轴、4.3.1.3轮对组装、4.3.2轴箱轴承 | 各类型200～299，关系R200～R299 | `data/submissions/member-d/` |

同一号段内按顺序编号，不要自行使用001～099或对方号段。实体ID由“类型字母+三位数字”组成：

| 实体类型 | ID前缀 | 示例 |
| --- | --- | --- |
| `Component` 部件 | `C` | `C100` |
| `Defect` 缺陷或异常 | `D` | `D100` |
| `Action` 检查或处理措施 | `A` | `A100` |
| `Standard` 限度或要求 | `S` | `S100` |
| `Procedure` 有顺序的步骤 | `P` | `P100` |

每位成员的关系CSV只能引用自己实体CSV中已经存在的ID。需要连接到其他成员或主数据的关系先写进Pull Request说明，由组长集成时补充。

仓库已经提供 `member-c` 和 `member-d` 目录。开始工作时，在本人目录中新建 `entities.csv` 和 `relations.csv`，不要修改另一位成员的目录。

## 2. 实体CSV

第一行必须原样使用以下表头，不能改中文、调换顺序或增加列：

```csv
entity_id,name,entity_type,description,pdf_page,printed_page,source_text,reviewer,status
```

| 字段 | 填写要求 |
| --- | --- |
| `entity_id` | 使用本人号段，类型和前缀必须对应 |
| `name` | 优先采用规程原词，名称中保留数值和单位 |
| `entity_type` | 只能是 `Component`、`Defect`、`Action`、`Standard`、`Procedure` |
| `description` | 用一句话说明该实体在当前条文中的含义，不添加原文没有的结论 |
| `pdf_page` | PDF阅读器显示的一基页码，只填正整数 |
| `printed_page` | 页面底部印刷页码，只填正整数 |
| `source_text` | 能独立证明该实体的完整原句，保留条件、数值和单位 |
| `reviewer` | `draft`阶段填本人姓名；复核后改成实际复核人姓名 |
| `status` | 首次提交只能填 `draft` |

正确示例：

```csv
entity_id,name,entity_type,description,pdf_page,printed_page,source_text,reviewer,status
C100,车轮（含轮盘）,Component,轮对中的车轮部件且规程将轮盘计入车轮,6,29,4.3.1.1 车轮（含轮盘）,成员C,draft
D100,车轮直径小于Φ800mm,Defect,车轮直径低于整体更换界限,6,29,"车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。",成员C,draft
```

## 3. 关系CSV

第一行必须原样使用以下表头：

```csv
relation_id,source_id,relation_type,target_id,pdf_page,printed_page,source_text,reviewer,status
```

| 关系类型 | 允许方向 | 使用场景 |
| --- | --- | --- |
| `PART_OF` | Component → Component | 一个部件属于另一个部件 |
| `HAS_DEFECT` | Component → Defect | 部件存在某类缺陷或异常 |
| `REQUIRES_ACTION` | Component/Defect → Action | 部件或缺陷需要检查、处理、更换 |
| `HAS_STANDARD` | Component/Action/Procedure → Standard | 部件、措施或步骤对应限度要求 |
| `NEXT_STEP` | Procedure → Procedure | 后一个步骤紧接前一个步骤 |

正确示例：

```csv
relation_id,source_id,relation_type,target_id,pdf_page,printed_page,source_text,reviewer,status
R100,C100,HAS_DEFECT,D100,6,29,"车轮直径小于Φ800mm时，车轮（含轮盘）整体更换。",成员C,draft
```

方向不要凭语感填写。例如“车轮存在直径不足缺陷”应写成 `C100,HAS_DEFECT,D100`，不能反向写成 `D100,HAS_DEFECT,C100`。

## 4. 从原页到CSV的操作顺序

1. 打开人工修订文本和原PDF，确认PDF页码与印刷页码。
2. 每次只处理一个完整条款，先圈出部件、缺陷、措施、标准或步骤。
3. 把候选实体写入实体CSV，立即分配本人号段中的下一个ID。
4. 只在原文明确表达关系时写入关系CSV，不根据常识补关系。
5. 数值、范围、单位、标准号和否定词逐字对照PDF。
6. 保存为UTF-8 CSV，然后运行校验器。
7. 创建Pull Request，并用“数据交付复核”Issue记录复核结果。

AI可以协助提出候选实体、解释CSV报错或检查漏项，但AI输出不能代替PDF复核。不得把原PDF、课程DOCX、`.env`或密钥上传到AI服务或GitHub。

## 5. 本地校验

C成员执行：

```powershell
.\.venv\Scripts\python.exe -m scripts.validation.validate_csv `
  --entities data\submissions\member-c\entities.csv `
  --relations data\submissions\member-c\relations.csv `
  --submission-role member-c
```

D成员把命令中的两处 `member-c` 都改为 `member-d`。角色模式会额外检查文件非空、本人ID号段、首次提交状态和Schema关系方向。成功时最后一行必须是：

```text
CSV validation passed.
```

程序报告 `文件名:行号:原因` 时，只修改对应行。不要为了通过校验删除证据、页码或单位。

## 6. 状态与复核

| 状态 | 谁可以设置 | 条件 |
| --- | --- | --- |
| `draft` | 数据录入人 | 已录入并通过自动校验，尚未由别人核对原页 |
| `reviewed` | 数据录入人按复核结论修改 | 另一名成员逐条对照PDF，复核人字段写真实姓名 |
| `approved` | 组长 | 自动校验通过，组长核对数值类数据并完成集成检查 |

本人检查不能把数据从 `draft` 改为 `reviewed`。复核发现问题时，在数据复核Issue中写明文件、行号、PDF页码和修改要求，不只在聊天里说“有问题”。

## 7. 常见错误

| 错误写法 | 问题 | 正确处理 |
| --- | --- | --- |
| `C12` | ID不是三位数字 | 改为本人号段中的 `C100` 等 |
| `D100` + `Component` | ID前缀与类型不一致 | Component使用 `C` 前缀 |
| `Wheel` | 类型不在白名单 | 使用 `Component` 等固定英文类型 |
| `done` | 状态不合法 | 只用 `draft`、`reviewed`、`approved` |
| 页码写 `29-30` | 页码字段必须是一个正整数 | 跨页证据拆成可定位的数据，或选择主要证据页并在Issue说明 |
| 标准写成 `800` | 单位和条件丢失 | 写清 `车轮直径小于Φ800mm` |
| `source_text` 写“见原文” | 不能独立复核 | 粘贴包含条件和结论的完整原句 |
| 关系引用 `C001` 但文件中没有 | 独立校验时端点不存在 | 首批小样只连接本人文件中的实体，跨文件关系交给组长集成 |
| `D100,HAS_DEFECT,C100` | 关系方向反了 | 按 `Component → Defect` 写为 `C100,HAS_DEFECT,D100` |
| 手工删除CSV中的双引号 | 含逗号的原句会错列 | 用表格软件保存CSV，或保留自动生成的引号 |
| OCR识别后直接填 `reviewed` | 未对照扫描页 | 先逐字复核，首次提交仍填 `draft` |

## 8. Pull Request交付清单

- [ ] 文件位于规定的成员目录，文件名为 `entities.csv` 和 `relations.csv`
- [ ] 只使用本人ID号段，没有重复ID
- [ ] 每行都有PDF页码、印刷页码、原文证据、复核人和状态
- [ ] 首次提交状态全部为 `draft`
- [ ] 数字、小数点、范围、单位、标准号和否定词已对照PDF
- [ ] 实体类型、关系类型和关系方向符合Schema
- [ ] 校验器输出 `CSV validation passed.`
- [ ] Pull Request中写明章节、数据条数、未确定问题和需要添加的跨文件关系
- [ ] 已创建“数据交付复核”Issue并链接Pull Request
