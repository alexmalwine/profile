import { useState } from 'react'

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

  const handleResumeChange = (event) => {
    const file = event.target.files?.[0] ?? null
    setResumeFile(file)
  }

  const handleStartGame = async () => {
    if (!resumeFile) {
      setStartError('Please upload your resume to start.')
      return
    }

    setIsStarting(true)
    setStartError('')
    setGameMessage('')
    setJobsError('')

    try {
      const formData = new FormData()
      formData.append('resume', resumeFile)

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
      setJobsError('Please upload your resume to see the top 10 jobs.')
      return
    }

    setIsListing(true)
    setJobsError('')
    setGameMessage('')
    setStartError('')

    try {
      const formData = new FormData()
      formData.append('resume', resumeFile)

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
    handleResumeChange,
    handleStartGame,
    handleFetchTopJobs,
    handleGuess,
    handleResetGame,
  }
}
