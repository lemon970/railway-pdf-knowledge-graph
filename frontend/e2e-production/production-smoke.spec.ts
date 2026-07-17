import { expect, test, type Page } from '@playwright/test'

const LOCAL_ORIGIN = 'http://127.0.0.1:8027'

const answer = {
  intent: 'defect_action',
  subject: '车轮踏面剥离',
  found: true,
  answer: '车轮踏面剥离达到限度时，应更换轮对。',
  processing_method: 'rule',
  focus_entity_id: 'C001',
  entities: [
    { entity_id: 'C001', name: '车轮', entity_type: 'Component' },
    { entity_id: 'D001', name: '踏面剥离', entity_type: 'Defect' },
  ],
  relations: [
    { relation_type: 'HAS_DEFECT', source_id: 'C001', target_id: 'D001' },
  ],
  evidence: [
    {
      pdf_page: 18,
      printed_page: 12,
      source_text: '车轮踏面剥离达到运用限度时，应更换轮对。',
    },
  ],
}

const graph = {
  center_id: 'C001',
  nodes: [
    {
      entity_id: 'C001',
      name: '车轮',
      entity_type: 'Component',
      description: '轮对的组成部件',
      pdf_page: 17,
      printed_page: 11,
      source_text: '轮对由车轴和车轮组成。',
    },
    {
      entity_id: 'D001',
      name: '踏面剥离',
      entity_type: 'Defect',
      description: '车轮踏面材料局部剥落',
      pdf_page: 18,
      printed_page: 12,
      source_text: '检查车轮踏面剥离长度。',
    },
  ],
  edges: [
    {
      relation_id: 'R001',
      relation_type: 'HAS_DEFECT',
      source_id: 'C001',
      target_id: 'D001',
      pdf_page: 18,
      printed_page: 12,
      source_text: '车轮存在踏面剥离缺陷。',
    },
  ],
}

async function installGraphFixtures(page: Page) {
  await page.route('**/health', (route) =>
    route.fulfill({ json: { status: 'ok', database: 'connected' } }),
  )
  await page.route('**/api/natural-questions', (route) => route.fulfill({ json: answer }))
  await page.route('**/api/graph/*', (route) => route.fulfill({ json: graph }))
}

test('FastAPI 单服务提供中文页面、静态资源和 API 文档', async ({ page, request }) => {
  const docsResponse = await request.get('/docs')
  expect(docsResponse.status()).toBe(200)
  expect(docsResponse.headers()['content-type']).toContain('text/html')
  expect(await docsResponse.text()).toContain('Swagger UI')

  const openapiResponse = await request.get('/openapi.json')
  expect(openapiResponse.status()).toBe(200)
  expect((await openapiResponse.json()).info.title).toBe('铁路检修知识图谱问答 API')

  const healthResponse = await request.get('/health')
  expect([200, 503]).toContain(healthResponse.status())
  const health = await healthResponse.json()
  expect(['connected', 'unavailable']).toContain(health.database)

  const loadedResources: { type: string; url: string }[] = []
  const assetResponses: { status: number; type: string; url: string }[] = []
  const browserErrors: string[] = []
  page.on('request', (browserRequest) => {
    loadedResources.push({ type: browserRequest.resourceType(), url: browserRequest.url() })
  })
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/assets/')) {
      assetResponses.push({
        status: response.status(),
        type: response.request().resourceType(),
        url: response.url(),
      })
    }
  })
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserErrors.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`))
  await installGraphFixtures(page)

  const indexResponse = await page.goto('/')
  expect(indexResponse?.status()).toBe(200)
  expect(indexResponse?.headers()['content-type']).toContain('text/html')
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', 'data:,')
  await expect(page.getByRole('heading', { name: '铁路 PDF 知识图谱' })).toBeVisible()
  await expect(page.getByText('数据库已连接')).toBeVisible()

  await page.getByLabel('请输入铁路检修问题').fill('车轮踏面剥离如何处理？')
  await page.getByRole('button', { name: '查询规程' }).click()
  await expect(page.getByText(answer.answer)).toBeVisible()
  await expect(page.getByRole('img', { name: /以 C001 为中心的知识图谱/ })).toBeVisible()

  const browserResources = loadedResources.filter(({ type }) =>
    ['document', 'script', 'stylesheet'].includes(type),
  )
  expect(browserResources.some(({ type }) => type === 'script')).toBe(true)
  expect(browserResources.some(({ type }) => type === 'stylesheet')).toBe(true)
  expect(browserResources.some(({ url }) => /\/assets\/GraphExplorer-.+\.js$/.test(url))).toBe(true)
  expect(assetResponses.some(({ type }) => type === 'script')).toBe(true)
  expect(assetResponses.some(({ type }) => type === 'stylesheet')).toBe(true)
  expect(assetResponses.every(({ status }) => status === 200)).toBe(true)
  expect(loadedResources.every(({ url }) => new URL(url).origin === LOCAL_ORIGIN)).toBe(true)

  await page.unroute('**/api/natural-questions')
  await page.unroute('**/api/graph/*')
  expect(browserErrors).toEqual([])
  await page.context().setOffline(true)
  const offlineApiRequests: string[] = []
  page.on('request', (browserRequest) => {
    const url = new URL(browserRequest.url())
    if (url.pathname.startsWith('/api/')) offlineApiRequests.push(url.pathname)
  })

  const defectButton = page.getByRole('button', { name: /踏面剥离.*缺陷/ })
  await defectButton.click()
  await expect(defectButton).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '适应视图' }).click()
  await page.getByRole('button', { name: '重置选择' }).click()
  await expect(defectButton).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('heading', { name: '铁路 PDF 知识图谱' })).toBeVisible()
  expect(offlineApiRequests).toEqual([])
  expect(browserErrors).toEqual([])
})
