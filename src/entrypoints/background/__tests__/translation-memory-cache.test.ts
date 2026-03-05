import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { MAX_MEMORY_CACHE_SIZE, setToMemoryCache, translationMemoryCache } from "../translation-queues"

describe("translationMemoryCache", () => {
  beforeEach(() => {
    translationMemoryCache.clear()
  })

  afterEach(() => {
    translationMemoryCache.clear()
  })

  it("stores and retrieves translations by hash", () => {
    const hash = "abc123"
    const translation = "你好"
    setToMemoryCache(hash, translation)
    expect(translationMemoryCache.get(hash)).toBe(translation)
  })

  it("returns undefined for unknown hash", () => {
    expect(translationMemoryCache.get("nonexistent")).toBeUndefined()
  })

  it("stores multiple distinct entries", () => {
    setToMemoryCache("h1", "translation1")
    setToMemoryCache("h2", "translation2")
    expect(translationMemoryCache.get("h1")).toBe("translation1")
    expect(translationMemoryCache.get("h2")).toBe("translation2")
    expect(translationMemoryCache.size).toBe(2)
  })

  it("overwrites existing entry with same hash", () => {
    setToMemoryCache("h1", "original")
    setToMemoryCache("h1", "updated")
    expect(translationMemoryCache.get("h1")).toBe("updated")
    expect(translationMemoryCache.size).toBe(1)
  })

  it("evicts the oldest entry when at max size", () => {
    // Fill cache to max
    for (let i = 0; i < MAX_MEMORY_CACHE_SIZE; i++) {
      setToMemoryCache(`key-${i}`, `val-${i}`)
    }
    expect(translationMemoryCache.size).toBe(MAX_MEMORY_CACHE_SIZE)

    // Adding one more should evict key-0 (the first inserted)
    setToMemoryCache("new-key", "new-val")
    expect(translationMemoryCache.size).toBe(MAX_MEMORY_CACHE_SIZE)
    expect(translationMemoryCache.has("key-0")).toBe(false)
    expect(translationMemoryCache.get("new-key")).toBe("new-val")
  })
})
