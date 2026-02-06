import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MAX_TRADING_CARD_COMBINATIONS,
  TRADING_CARD_ART_STYLES,
} from '../constants/gameConstants'

const DEFAULT_ART_STYLE = TRADING_CARD_ART_STYLES[0]?.id ?? 'retro-comic'

const parseList = (value) =>
  value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)

const extractFileName = (contentDisposition) => {
  if (!contentDisposition) {
    return null
  }
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }
  const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
  return filenameMatch?.[1] ?? null
}

const triggerDownload = (url, fileName) => {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

export const useCustomTradingCards = () => {
  const [cardTitlesInput, setCardTitlesInput] = useState('')
  const [prefixesInput, setPrefixesInput] = useState('')
  const [theme, setTheme] = useState('')
  const [artStyle, setArtStyle] = useState(DEFAULT_ART_STYLE)
  const [referenceImages, setReferenceImages] = useState([])
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewName, setPreviewName] = useState('')
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [downloadName, setDownloadName] = useState('')

  const cardTitles = useMemo(
    () => parseList(cardTitlesInput),
    [cardTitlesInput],
  )
  const prefixes = useMemo(() => parseList(prefixesInput), [prefixesInput])
  const prefixCount = prefixes.length > 0 ? prefixes.length : 1
  const totalCombinations = cardTitles.length * prefixCount
  const previewCombination = useMemo(() => {
    if (cardTitles.length === 0) {
      return null
    }
    const prefix = prefixes[0] ?? ''
    const title = cardTitles[0]
    const displayTitle = prefix ? `${prefix} ${title}` : title
    return { title, prefix: prefix || null, displayTitle }
  }, [cardTitles, prefixes])

  const clearPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl('')
    setPreviewName('')
  }, [previewUrl])

  const clearDownload = useCallback(() => {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl)
    }
    setDownloadUrl('')
    setDownloadName('')
  }, [downloadUrl])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl)
      }
    }
  }, [previewUrl, downloadUrl])

  const handleCardTitlesChange = (event) => {
    setCardTitlesInput(event.target.value)
    setError('')
    clearPreview()
    clearDownload()
  }

  const handlePrefixesChange = (event) => {
    setPrefixesInput(event.target.value)
    setError('')
    clearPreview()
    clearDownload()
  }

  const handleThemeChange = (event) => {
    setTheme(event.target.value)
    setError('')
    clearPreview()
    clearDownload()
  }

  const handleArtStyleChange = (event) => {
    setArtStyle(event.target.value)
    setError('')
    clearPreview()
    clearDownload()
  }

  const handleReferenceImagesChange = (event) => {
    const files = Array.from(event.target.files ?? [])
    setReferenceImages(files)
    setError('')
    clearPreview()
    clearDownload()
  }

  const handleGeneratePreview = async () => {
    if (cardTitles.length === 0) {
      setError('Add at least one card title to continue.')
      return
    }
    if (!theme.trim()) {
      setError('Add a theme to guide the artwork.')
      return
    }
    if (totalCombinations > MAX_TRADING_CARD_COMBINATIONS) {
      setError(
        `Limit requests to ${MAX_TRADING_CARD_COMBINATIONS} card combinations.`,
      )
      return
    }

    setIsPreviewing(true)
    setError('')
    clearPreview()
    clearDownload()

    try {
      const formData = new FormData()
      formData.append('card_titles', JSON.stringify(cardTitles))
      if (prefixes.length > 0) {
        formData.append('prefixes', JSON.stringify(prefixes))
      }
      formData.append('art_style', artStyle)
      formData.append('theme', theme.trim())
      referenceImages.forEach((file) => {
        formData.append('reference_images', file, file.name)
      })

      const response = await fetch('/api/games/custom-trading-cards/preview', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message ?? 'Unable to generate preview.')
      }

      const blob = await response.blob()
      const fileName =
        extractFileName(response.headers.get('content-disposition')) ??
        'card-preview.png'
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setPreviewName(fileName)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to generate preview.'
      setError(message)
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleGenerateCards = async () => {
    if (cardTitles.length === 0) {
      setError('Add at least one card title to continue.')
      return
    }
    if (!theme.trim()) {
      setError('Add a theme to guide the artwork.')
      return
    }
    if (totalCombinations > MAX_TRADING_CARD_COMBINATIONS) {
      setError(
        `Limit requests to ${MAX_TRADING_CARD_COMBINATIONS} card combinations.`,
      )
      return
    }
    if (!previewUrl) {
      setError('Generate a preview card before requesting the full set.')
      return
    }

    setIsGenerating(true)
    setError('')
    clearDownload()

    try {
      const formData = new FormData()
      formData.append('card_titles', JSON.stringify(cardTitles))
      if (prefixes.length > 0) {
        formData.append('prefixes', JSON.stringify(prefixes))
      }
      formData.append('art_style', artStyle)
      formData.append('theme', theme.trim())
      referenceImages.forEach((file) => {
        formData.append('reference_images', file, file.name)
      })

      const response = await fetch('/api/games/custom-trading-cards/generate', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message ?? 'Unable to generate cards.')
      }

      const blob = await response.blob()
      const fileName =
        extractFileName(response.headers.get('content-disposition')) ??
        'custom-trading-cards.zip'
      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      setDownloadName(fileName)
      triggerDownload(url, fileName)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to generate cards.'
      setError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReset = () => {
    setCardTitlesInput('')
    setPrefixesInput('')
    setTheme('')
    setArtStyle(DEFAULT_ART_STYLE)
    setReferenceImages([])
    setError('')
    setIsGenerating(false)
    setIsPreviewing(false)
    clearPreview()
    clearDownload()
  }

  return {
    cardTitlesInput,
    prefixesInput,
    theme,
    artStyle,
    referenceImages,
    previewUrl,
    previewName,
    previewCombination,
    isPreviewing,
    isGenerating,
    error,
    downloadUrl,
    downloadName,
    cardTitles,
    prefixes,
    prefixCount,
    totalCombinations,
    handleCardTitlesChange,
    handlePrefixesChange,
    handleThemeChange,
    handleArtStyleChange,
    handleReferenceImagesChange,
    handleGeneratePreview,
    handleGenerateCards,
    handleReset,
  }
}
