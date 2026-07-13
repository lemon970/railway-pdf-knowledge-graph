# OCR 脚本

PaddleOCR 使用独立虚拟环境，避免它的图像处理依赖影响后端环境。脚本输出必须进入 `data/ocr/`，不能覆盖 `data/reviewed/`。

## 安装

```powershell
py -3.12 -m venv .venv-ocr
.\.venv-ocr\Scripts\python.exe -m pip install -r scripts\ocr\requirements.txt
.\.venv-ocr\Scripts\python.exe -m pip check
```

首次识别会将 PaddleOCR 模型下载到用户目录，不会写入仓库。

## 运行

以下命令中的页码是 PDF 阅读器显示的一基页码，不是规程印刷页码：

```powershell
.\.venv-ocr\Scripts\python.exe -m scripts.ocr.run_ocr `
  --pdf "D:\path\to\规程.pdf" `
  --pages "6,7,10" `
  --output data\ocr\task5-raw.txt `
  --dpi 200
```

输出包括按 `PDF_PAGE` 分隔的 UTF-8 文本和同名 JSON 耗时记录。原始 OCR 文本只作候选，数值、单位和专业术语必须对照原页人工修订。
