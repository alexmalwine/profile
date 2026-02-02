import { useState } from 'react'
import { RESUME_FORMATS } from '../constants/gameConstants'

export const useResumeFormatter = () => {
  const [formatterFile, setFormatterFile] = useState(null)
  const [selectedFormat, setSelectedFormat] = useState(RESUME_FORMATS[0].id)
  const [formatResult, setFormatResult] = useState(null)
  const [formatError, setFormatError] = useState('')
  const [isFormatting, setIsFormatting] = useState(false)

  const handleFormatterFileChange = (event) => {
    const file = event.target.files?.[0] ?? null
    setFormatterFile(file)
  }

  const handleFormatResume = async () => {
    if (!formatterFile) {
      setFormatError('Please upload a resume to format.')
      return
    }

    setIsFormatting(true)
    setFormatError('')
    setFormatResult(null)

    try {
      const formData = new FormData()
      formData.append('resume', formatterFile)
      formData.append('formatId', selectedFormat)

      const response = await fetch('/api/tools/resume-formatter/format', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message ?? 'Unable to format resume.')
      }

      const payload = await response.json()
      setFormatResult(payload)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to format resume.'
      setFormatError(message)
    } finally {
      setIsFormatting(false)
    }
  }

  const handleDownloadFormatted = () => {
    if (!formatResult?.content) {
      return
    }

    const blob = new Blob([formatResult.content], {
      type: formatResult.mimeType ?? 'text/plain',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = formatResult.fileName ?? 'resume.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return {
    formatterFile,
    selectedFormat,
    setSelectedFormat,
    formatResult,
    formatError,
    isFormatting,
    handleFormatterFileChange,
    handleFormatResume,
    handleDownloadFormatted,
  }
}
