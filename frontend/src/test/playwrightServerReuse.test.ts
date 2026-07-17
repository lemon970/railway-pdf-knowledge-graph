import { describe, expect, it } from 'vitest'
import { shouldReusePlaywrightServer } from '../../playwrightServerReuse'

describe('shouldReusePlaywrightServer', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['0', false],
    ['true', false],
    ['1', true],
  ])('PW_REUSE_SERVER=%s 时返回 %s', (value, expected) => {
    expect(shouldReusePlaywrightServer(value)).toBe(expected)
  })
})
