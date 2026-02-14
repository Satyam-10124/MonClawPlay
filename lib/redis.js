let _client = null

function getClient() {
  if (_client) return _client

  if (process.env.REDIS_URL) {
    // Railway / standard Redis
    const IORedis = require('ioredis')
    const ioClient = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
    })
    ioClient.on('connect', () => console.log('[Redis] Connected to Railway Redis'))
    ioClient.on('error', (err) => console.error('[Redis] Error:', err.message))

    _client = {
      async get(key) {
        const val = await ioClient.get(key)
        if (val === null) return null
        try { return JSON.parse(val) } catch { return val }
      },
      async set(key, value) {
        const v = typeof value === 'string' ? value : JSON.stringify(value)
        return ioClient.set(key, v)
      },
      async del(key) { return ioClient.del(key) },
      async exists(key) { return ioClient.exists(key) },
      async incr(key) { return ioClient.incr(key) },
      async sadd(key, ...members) { return ioClient.sadd(key, ...members) },
      async smembers(key) { return ioClient.smembers(key) },
      async srem(key, ...members) { return ioClient.srem(key, ...members) },
    }
  } else {
    console.warn('[Redis] No REDIS_URL — using in-memory fallback')
    const store = new Map()
    const sets = new Map()
    _client = {
      async get(key) {
        const val = store.get(key)
        if (val === undefined) return null
        try { return JSON.parse(val) } catch { return val }
      },
      async set(key, value) {
        store.set(key, typeof value === 'string' ? value : JSON.stringify(value))
        return 'OK'
      },
      async del(key) { store.delete(key); return 1 },
      async exists(key) { return store.has(key) ? 1 : 0 },
      async incr(key) {
        const n = parseInt(store.get(key) || '0', 10) + 1
        store.set(key, String(n)); return n
      },
      async sadd(key, ...m) {
        if (!sets.has(key)) sets.set(key, new Set())
        const s = sets.get(key); let a = 0
        for (const v of m) { if (!s.has(v)) { s.add(v); a++ } }
        return a
      },
      async smembers(key) { return sets.has(key) ? Array.from(sets.get(key)) : [] },
      async srem(key, ...m) {
        if (!sets.has(key)) return 0
        const s = sets.get(key); let r = 0
        for (const v of m) { if (s.delete(v)) r++ }
        return r
      },
    }
  }

  return _client
}

// Proxy that lazily initializes on first call
const redis = new Proxy({}, {
  get(_, prop) {
    const client = getClient()
    return client[prop]
  }
})

export default redis
