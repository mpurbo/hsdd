// @vitest-environment node
import { describe, expect, it } from 'vitest'
import config from '../vite.config'

describe('vite config', () => {
  it('proxies /api to the backend development address', () => {
    expect(config.server?.proxy?.['/api']).toMatchObject({ target: 'http://127.0.0.1:3000' })
  })
})
