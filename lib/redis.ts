import Redis from "ioredis"

let client: Redis | null = null

export function getRedisConnection() {
  const url = process.env.REDIS_URL
  if (!url) return null

  if (!client) {
    client = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  }
  return client
}
