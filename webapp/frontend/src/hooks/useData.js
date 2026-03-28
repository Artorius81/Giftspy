import { useState, useEffect } from 'react'

const cache = {}
const listeners = {}

export function mutateData(key, data) {
  cache[key] = data
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

    fetcher()
      .then(res => {
        if (!isMounted) return
        const cachedStr = JSON.stringify(cache[key])
        const newStr = JSON.stringify(res)
        if (cachedStr !== newStr) {
          mutateData(key, res)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error(`Error fetching ${key}:, err`)
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
      listeners[key] = listeners[key].filter(fn => fn !== handler)
    }
  }, [key]) // eslint-disable-line

  return { data, loading, mutate: (newData) => mutateData(key, newData) }
}
