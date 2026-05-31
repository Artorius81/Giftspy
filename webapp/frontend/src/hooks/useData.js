import { useState, useEffect } from 'react'

const cache = {}
const cacheTime = {} // stores timestamp of last successful fetch
const listeners = {}
const ongoingRequests = {} // stores active promise for each key

const CACHE_TTL = 3000 // 3 seconds cache TTL for high responsiveness but low spam

export function mutateData(key, data) {
  cache[key] = data
  cacheTime[key] = Date.now()
  if (listeners[key]) {
    listeners[key].forEach(fn => fn(data))
  }
}

export function useData(key, fetcher) {
  const [data, setData] = useState(cache[key] || null)
  const [loading, setLoading] = useState(!cache[key])

  useEffect(() => {
    if (!key) return
    
    if (!listeners[key]) listeners[key] = []
    
    const handler = (newData) => setData(newData)
    listeners[key].push(handler)

    let isMounted = true

    // Check if we already have a recent successful fetch within TTL
    const now = Date.now()
    const lastFetch = cacheTime[key] || 0
    const isRecent = now - lastFetch < CACHE_TTL

    if (isRecent && cache[key] !== undefined) {
      if (isMounted) setLoading(false)
    } else {
      // De-duplicate ongoing requests
      if (!ongoingRequests[key]) {
        ongoingRequests[key] = fetcher()
          .then(res => {
            cacheTime[key] = Date.now()
            const cachedStr = JSON.stringify(cache[key])
            const newStr = JSON.stringify(res)
            if (cachedStr !== newStr) {
              mutateData(key, res)
            }
            delete ongoingRequests[key]
            return res;
          })
          .catch(err => {
            console.error(`Error fetching ${key}:`, err)
            delete ongoingRequests[key]
            throw err;
          })
      }

      ongoingRequests[key]
        .then(() => {
          if (isMounted) setLoading(false)
        })
        .catch(() => {
          if (isMounted) setLoading(false)
        })
    }

    return () => {
      isMounted = false
      listeners[key] = listeners[key].filter(fn => fn !== handler)
    }
  }, [key]) // eslint-disable-line

  return { data, loading, mutate: (newData) => mutateData(key, newData) }
}
