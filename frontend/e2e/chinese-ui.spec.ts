import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const answer = {
  intent: 'defect_action',
  subject: '车轮踏面剥离',
  found: true,
  answer: '车轮踏面剥离达到限度时，应更换轮对。',
  processing_method: 'rule',
  focus_entity_id: 'component-wheel',
  entities: [
    { entity_id: 'component-wheel', name: '车轮', entity_type: 'Component' },
    { entity_id: 'defect-spalling', name: '踏面剥离', entity_type: 'Defect' },
    { entity_id: 'action-replace', name: '更换轮对', entity_type: 'Action' },
  ],
  relations: [
    {
      relation_type: 'HAS_DEFECT',
      source_id: 'component-wheel',
      target_id: 'defect-spalling',
    },
    {
      relation_type: 'REQUIRES_ACTION',
      source_id: 'defect-spalling',
      target_id: 'action-replace',
    },
  ],
  evidence: [
    {
      pdf_page: 18,
      printed_page: 12,
      source_text: '车轮踏面剥离达到运用限度时，应更换轮对。',
    },
    {
      pdf_page: 19,
      printed_page: 13,
      source_text: '更换后须复测轮对尺寸并记录。',
    },
  ],
} as const

const graph = {
  center_id: 'component-wheel',
  nodes: [
    {
      entity_id: 'component-wheel',
      name: '车轮',
      entity_type: 'Component',
      description: '轮对的组成部件',
      pdf_page: 17,
      printed_page: 11,
      source_text: '轮对由车轴和车轮组成。',
    },
    {
      entity_id: 'defect-spalling',
      name: '踏面剥离',
      entity_type: 'Defect',
      description: '车轮踏面材料局部剥落',
      pdf_page: 18,
      printed_page: 12,
      source_text: '检查车轮踏面剥离长度。',
    },
    {
      entity_id: 'action-replace',
      name: '更换轮对',
      entity_type: 'Action',
      description: '拆下不合格轮对并更换',
      pdf_page: 18,
      printed_page: 12,
      source_text: '达到运用限度时更换轮对。',
    },
  ],
  edges: [
    {
      relation_id: 'relation-wheel-defect',
      relation_type: 'HAS_DEFECT',
      source_id: 'component-wheel',
      target_id: 'defect-spalling',
      pdf_page: 18,
      printed_page: 12,
      source_text: '车轮存在踏面剥离缺陷。',
    },
    {
      relation_id: 'relation-defect-action',
      relation_type: 'REQUIRES_ACTION',
      source_id: 'defect-spalling',
      target_id: 'action-replace',
      pdf_page: 18,
      printed_page: 12,
      source_text: '踏面剥离达到限度时更换轮对。',
    },
  ],
} as const

function collectUnexpectedConsole(page: Page) {
  const messages: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`))
  return messages
}

async function mockApplicationApi(page: Page, failFirstQuestion = false) {
  let questionRequests = 0
  await page.route('**/health', async (route) => {
    await route.fulfill({ json: { status: 'ok', database: 'connected' } })
  })
  await page.route('**/api/natural-questions', async (route) => {
    questionRequests += 1
    if (failFirstQuestion && questionRequests === 1) {
      await route.fulfill({ json: { unexpected: 'invalid contract' } })
      return
    }
    await route.fulfill({ json: answer })
  })
  await page.route('**/api/graph/*', async (route) => {
    await route.fulfill({ json: graph })
  })
  return () => questionRequests
}

async function submitQuestion(page: Page) {
  await page.getByLabel('请输入铁路检修问题').fill('车轮踏面剥离如何处理？')
  await page.getByRole('button', { name: '查询规程' }).click()
}

test('完成中文问答、双页证据和图谱详情闭环', async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page)
  await mockApplicationApi(page)
  await page.goto('/')

  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.getByText('数据库已连接')).toBeVisible()
  await submitQuestion(page)

  await expect(page.getByRole('heading', { name: '查询结论' })).toBeVisible()
  await expect(page.getByText(answer.answer)).toBeVisible()
  await expect(page.getByText('PDF 页码：18')).toBeVisible()
  await expect(page.getByText('印刷页码：12')).toBeVisible()
  await expect(page.getByText('PDF 页码：19')).toBeVisible()
  await expect(page.getByText('印刷页码：13')).toBeVisible()
  await expect(page.getByRole('img', { name: /以 component-wheel 为中心的知识图谱/ })).toBeVisible()

  const defectButton = page.getByRole('button', { name: /踏面剥离.*缺陷/ })
  await defectButton.click()
  await expect(defectButton).toHaveAttribute('aria-pressed', 'true')
  const details = page.getByRole('heading', { name: '实体详情' }).locator('..')
  await expect(details).toContainText('车轮踏面材料局部剥落')
  await expect(details).toContainText('PDF 第 18 页，印刷页第 12 页')

  await page.getByRole('button', { name: '适应视图' }).click()
  await page.getByRole('button', { name: '重置选择' }).click()
  await expect(defectButton).toHaveAttribute('aria-pressed', 'false')
  await expect(details).toContainText('请选择实体查看详情')

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(
    accessibility.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'),
  ).toEqual([])
  await page.screenshot({ path: '../output/playwright/chinese-query-graph.png', fullPage: true })
  expect(consoleMessages).toEqual([])
})

test('查询 API 首次失败后可用中文按钮重试', async ({ page }) => {
  const consoleMessages = collectUnexpectedConsole(page)
  const getQuestionRequests = await mockApplicationApi(page, true)
  await page.goto('/')
  await expect(page.getByText('数据库已连接')).toBeVisible()
  await submitQuestion(page)

  await expect(page.getByRole('alert')).toContainText('查询服务返回的数据格式无效')
  await page.getByRole('button', { name: '重试查询' }).click()
  await expect(page.getByText(answer.answer)).toBeVisible()
  expect(getQuestionRequests()).toBe(2)
  expect(consoleMessages).toEqual([])
})

for (const viewport of [
  { width: 320, height: 800, columns: 1 },
  { width: 768, height: 900, columns: 2 },
  { width: 1024, height: 900, columns: 2 },
  { width: 1440, height: 1000, columns: 2 },
]) {
  test(`${viewport.width}px 下无横向溢出且结果布局正确`, async ({ page }) => {
    const consoleMessages = collectUnexpectedConsole(page)
    await page.setViewportSize(viewport)
    await mockApplicationApi(page)
    await page.goto('/')
    await expect(page.getByText('数据库已连接')).toBeVisible()
    await submitQuestion(page)
    const resultLayout = page.locator('.result-layout')
    await expect(resultLayout).toBeVisible()
    await expect(page.getByRole('button', { name: /车轮.*部件/ })).toBeVisible()

    const measurements = await page.evaluate(() => {
      const layout = document.querySelector('.result-layout')
      return {
        bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        columns: layout ? getComputedStyle(layout).gridTemplateColumns.split(' ').length : 0,
      }
    })
    expect(measurements.bodyOverflow).toBeLessThanOrEqual(1)
    expect(measurements.columns).toBe(viewport.columns)
    await page.screenshot({
      path: `../output/playwright/layout-${viewport.width}.png`,
      fullPage: true,
    })
    expect(consoleMessages).toEqual([])
  })
}
