import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  // Node-environment tests (the vite config test) have no sessionStorage.
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
})
