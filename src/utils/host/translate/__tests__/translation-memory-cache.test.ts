import type { ProviderConfig } from "@/types/config/provider"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sendMessage } from "@/utils/message"
import { MAX_MEMORY_CACHE_SIZE, translateTextCore, translationMemoryCache } from "../translate-text"

// Mock external dependencies
vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn(),
}))

vi.mock("franc", () => ({
  franc: vi.fn(() => "und"), // unknown language — never skip
}))

vi.mock("@/utils/content/language", () => ({
  detectLanguage: vi.fn(),
}))

vi.mock("@/utils/prompts/translate", () => ({
  getTranslatePrompt: vi.fn().mockResolvedValue({
    systemPrompt: "system",
    prompt: "prompt",
  }),
}))

// Minimal LLM provider config
const mockAPIProviderConfig: ProviderConfig = {
  id: "google-translate-test",
  name: "Google Translate Test",
  enabled: true,
  provider: "google-translate",
} as ProviderConfig

const mockLangConfig = {
  sourceCode: "eng" as const,
  targetCode: "cmn" as const,
  level: "beginner" as const,
}

const mockedSendMessage = vi.mocked(sendMessage)

beforeEach(() => {
  translationMemoryCache.clear()
  mockedSendMessage.mockReset()
})

afterEach(() => {
  translationMemoryCache.clear()
})

describe("translateTextCore in-memory cache", () => {
  it("should cache translation result and return it on second call without IPC", async () => {
    mockedSendMessage.mockResolvedValueOnce("你好")

    const options = {
      text: "Hello",
      langConfig: mockLangConfig,
      providerConfig: mockAPIProviderConfig,
    }

    const first = await translateTextCore(options)
    expect(first).toBe("你好")
    expect(mockedSendMessage).toHaveBeenCalledTimes(1)

    // Second call — should hit in-memory cache
    const second = await translateTextCore(options)
    expect(second).toBe("你好")
    // sendMessage should NOT be called again
    expect(mockedSendMessage).toHaveBeenCalledTimes(1)
  })

  it("should not cache empty results", async () => {
    mockedSendMessage.mockResolvedValueOnce("")

    const options = {
      text: "Hello",
      langConfig: mockLangConfig,
      providerConfig: mockAPIProviderConfig,
    }

    await translateTextCore(options)
    expect(translationMemoryCache.size).toBe(0)

    // Second call should send another IPC message
    mockedSendMessage.mockResolvedValueOnce("你好")
    const second = await translateTextCore(options)
    expect(second).toBe("你好")
    expect(mockedSendMessage).toHaveBeenCalledTimes(2)
  })

  it("should evict oldest entry when cache exceeds max size", async () => {
    // Fill cache with MAX_MEMORY_CACHE_SIZE entries manually
    for (let i = 0; i < MAX_MEMORY_CACHE_SIZE; i++) {
      translationMemoryCache.set(`hash-${i}`, `translation-${i}`)
    }
    expect(translationMemoryCache.size).toBe(MAX_MEMORY_CACHE_SIZE)

    // Trigger translateTextCore — it should evict the oldest and add the new one
    mockedSendMessage.mockResolvedValueOnce("新翻译")

    await translateTextCore({
      text: "Some new text that produces a unique hash",
      langConfig: mockLangConfig,
      providerConfig: mockAPIProviderConfig,
    })

    // Size should still be MAX_MEMORY_CACHE_SIZE (evicted one, added one)
    expect(translationMemoryCache.size).toBe(MAX_MEMORY_CACHE_SIZE)
    // Oldest entry should be gone
    expect(translationMemoryCache.has("hash-0")).toBe(false)
  })
})
