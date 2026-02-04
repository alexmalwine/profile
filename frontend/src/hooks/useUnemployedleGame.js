import { useState } from 'react'

const DEFAULT_TOP_JOBS_VISIBLE_COUNT = 4

export const useUnemployedleGame = () => {
  const [resumeFile, setResumeFile] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [guessedLetters, setGuessedLetters] = useState([])
  const [startError, setStartError] = useState('')
  const [gameMessage, setGameMessage] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [isGuessing, setIsGuessing] = useState(false)
  const [topJobs, setTopJobs] = useState([])
  const [jobsError, setJobsError] = useState('')
  const [isListing, setIsListing] = useState(false)
  const [topJobsSummary, setTopJobsSummary] = useState('')
  const [topJobsVisibleCount, setTopJobsVisibleCount] = useState(
    DEFAULT_TOP_JOBS_VISIBLE_COUNT,
  )
  const [desiredJobTitle, setDesiredJobTitle] = useState('')
  const [locationPreferences, setLocationPreferences] = useState({
    includeRemote: true,
    includeLocal: true,
    includeSpecific: false,
    specificLocation: '',
  })

  const handleResumeChange = (event) => {
    const file = event.target.files?.[0] ?? null
    setResumeFile(file)
  }

  const handleStartGame = async () => {
    if (!resumeFile) {
      setStartError('Please upload your resume to start.')
      return
    }
    if (
      locationPreferences.includeSpecific &&
      !locationPreferences.specificLocation.trim()
    ) {
      setStartError('Enter a specific location or uncheck that option.')
      return
    }

    setIsStarting(true)
    setStartError('')
    setGameMessage('')
    setJobsError('')

    try {
      const formData = new FormData()
      formData.append('resume', resumeFile)
      formData.append(
        'includeRemote',
        locationPreferences.includeRemote ? 'true' : 'false',
      )
      formData.append(
        'includeLocal',
        locationPreferences.includeLocal ? 'true' : 'false',
      )
      formData.append(
        'includeSpecific',
        locationPreferences.includeSpecific ? 'true' : 'false',
      )
      if (locationPreferences.specificLocation.trim()) {
        formData.append(
          'specificLocation',
          locationPreferences.specificLocation.trim(),
        )
      }
      if (desiredJobTitle.trim()) {
        formData.append('desiredJobTitle', desiredJobTitle.trim())
      }

      const response = await fetch('/api/games/unemployedle/start', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message ?? 'Unable to start the game.')
      }

      const payload = await response.json()
      setGameState(payload)
      setGuessedLetters(payload.guessedLetters ?? [])
      setTopJobs([])
      setTopJobsSummary('')
      setTopJobsVisibleCount(DEFAULT_TOP_JOBS_VISIBLE_COUNT)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to start the game.'
      setStartError(message)
    } finally {
      setIsStarting(false)
    }
  }

  const handleFetchTopJobs = async () => {
    if (!resumeFile) {
      setJobsError('Please upload your resume to see the top jobs.')
      return
    }
    if (
      locationPreferences.includeSpecific &&
      !locationPreferences.specificLocation.trim()
    ) {
      setJobsError('Enter a specific location or uncheck that option.')
      return
    }

    setIsListing(true)
    setJobsError('')
    setGameMessage('')
    setStartError('')

    try {
      const formData = new FormData()
      formData.append('resume', resumeFile)
      formData.append(
        'includeRemote',
        locationPreferences.includeRemote ? 'true' : 'false',
      )
      formData.append(
        'includeLocal',
        locationPreferences.includeLocal ? 'true' : 'false',
      )
      formData.append(
        'includeSpecific',
        locationPreferences.includeSpecific ? 'true' : 'false',
      )
      if (locationPreferences.specificLocation.trim()) {
        formData.append(
          'specificLocation',
          locationPreferences.specificLocation.trim(),
        )
      }
      if (desiredJobTitle.trim()) {
        formData.append('desiredJobTitle', desiredJobTitle.trim())
      }

      const response = await fetch('/api/games/unemployedle/jobs', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message ?? 'Unable to fetch job list.')
      }

      const payload = await response.json()
      setTopJobs(payload.jobs ?? [])
      setTopJobsSummary(payload.selectionSummary ?? '')
      setTopJobsVisibleCount(DEFAULT_TOP_JOBS_VISIBLE_COUNT)
      setGameState(null)
      setGuessedLetters([])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to fetch job list.'
      setJobsError(message)
    } finally {
      setIsListing(false)
    }
  }

  const handleGuess = async (letter) => {
    if (!gameState || gameState.status !== 'in_progress') {
      return
    }

    if (guessedLetters.includes(letter)) {
      setGameMessage('You already guessed that letter.')
      return
    }

    setIsGuessing(true)
    setGameMessage('')

    try {
      const response = await fetch('/api/games/unemployedle/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameState.gameId,
          letter,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message ?? 'Unable to submit guess.')
      }

      const payload = await response.json()
      setGameState(payload)
      setGuessedLetters((previous) => payload.guessedLetters ?? previous)
      if (payload.alreadyGuessed) {
        setGameMessage('You already guessed that letter.')
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to submit guess.'
      setGameMessage(message)
    } finally {
      setIsGuessing(false)
    }
  }

  const handleResetGame = () => {
    setGameState(null)
    setGuessedLetters([])
    setGameMessage('')
    setStartError('')
    setTopJobs([])
    setJobsError('')
    setTopJobsSummary('')
    setTopJobsVisibleCount(DEFAULT_TOP_JOBS_VISIBLE_COUNT)
    setDesiredJobTitle('')
    setLocationPreferences({
      includeRemote: true,
      includeLocal: true,
      includeSpecific: false,
      specificLocation: '',
    })
  }

  const handleShowMoreJobs = () => {
    setTopJobsVisibleCount((previous) =>
      Math.min(previous + DEFAULT_TOP_JOBS_VISIBLE_COUNT, topJobs.length),
    )
  }

  return {
    resumeFile,
    gameState,
    guessedLetters,
    startError,
    gameMessage,
    isStarting,
    isGuessing,
    topJobs,
    jobsError,
    isListing,
    topJobsSummary,
    topJobsVisibleCount,
    desiredJobTitle,
    setDesiredJobTitle,
    locationPreferences,
    setLocationPreferences,
    handleResumeChange,
    handleStartGame,
    handleFetchTopJobs,
    handleShowMoreJobs,
    handleGuess,
    handleResetGame,
  }
}
