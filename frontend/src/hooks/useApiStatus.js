import { useEffect, useState } from 'react'

export const useApiStatus = () => {
  const [apiStatus, setApiStatus] = useState('checking')

  useEffect(() => {
    let isMounted = true

    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health')
        if (!response.ok) {
          throw new Error('API unavailable')
        }
        if (isMounted) {
          setApiStatus('online')
        }
      } catch (error) {
        if (isMounted) {
          setApiStatus('offline')
        }
      }
    }

    checkHealth()

    return () => {
      isMounted = false
    }
  }, [])

  return apiStatus
}
