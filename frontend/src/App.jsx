import { useEffect, useState } from 'react'

const API_STATUS_LABELS = {
  checking: 'Checking...',
  online: 'Connected',
  offline: 'Offline',
}

const GAME_TABS = [
  { id: 'unemploydle', label: 'Unemploydle' },
  { id: 'resume-formatter', label: 'Resume Formatter' },
  { id: 'coming-soon', label: 'More soon', disabled: true },
]

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const MAX_GUESSES = 7

const RESUME_FORMATS = [
  {
    id: 'modern',
    label: 'Modern',
    description: 'Clean sections with emphasis on impact and metrics.',
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Traditional format with clear headings and bullet points.',
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Condensed format designed for quick scanning.',
  },
]

function App() {
  const [apiStatus, setApiStatus] = useState('checking')
  const [activeGame, setActiveGame] = useState('unemploydle')
  const [resumeFile, setResumeFile] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [guessedLetters, setGuessedLetters] = useState([])
  const [startError, setStartError] = useState('')
  const [gameMessage, setGameMessage] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [isGuessing, setIsGuessing] = useState(false)
  const [formatterFile, setFormatterFile] = useState(null)
  const [selectedFormat, setSelectedFormat] = useState(RESUME_FORMATS[0].id)
  const [formatResult, setFormatResult] = useState(null)
  const [formatError, setFormatError] = useState('')
  const [isFormatting, setIsFormatting] = useState(false)
  const year = new Date().getFullYear()

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

  const apiStatusLabel = API_STATUS_LABELS[apiStatus] ?? apiStatus
  const isGameActive = gameState?.status === 'in_progress'
  const gameStatusLabel =
    gameState?.status === 'won'
      ? 'You won'
      : gameState?.status === 'lost'
        ? 'Game over'
        : isGameActive
          ? 'In progress'
          : 'Ready'
  const formatterStatusLabel = formatResult ? 'Formatted' : 'Ready'
  const formatterStatusClass = formatResult ? 'formatted' : 'ready'
  const selectedFormatMeta = RESUME_FORMATS.find(
    (format) => format.id === selectedFormat
  )

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

    try {
      const formData = new FormData()
      formData.append('resume', resumeFile)

      const response = await fetch('/api/games/unemploydle/start', {
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to start the game.'
      setStartError(message)
    } finally {
      setIsStarting(false)
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
      const response = await fetch('/api/games/unemploydle/guess', {
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
  }

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

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container nav-row">
          <a className="logo" href="#top">
            [Your Name]
          </a>
          <nav className="nav">
            <a href="#about">About</a>
            <a href="#work">Work</a>
            <a href="#projects">Projects</a>
            <a href="#skills">Skills</a>
            <a href="#games">Games and Stuff</a>
            <a href="#contact">Contact</a>
          </nav>
          <a className="button small" href="[resume.pdf]">
            Resume
          </a>
        </div>
      </header>

      <main id="main">
        <section id="top" className="hero">
          <div className="container hero-grid">
            <div className="hero-content">
              <p className="eyebrow">Software Engineer</p>
              <h1>Build reliable systems and delightful product experiences.</h1>
              <p className="lead">
                I help teams ship performant, accessible web applications with
                measurable impact. Currently looking for a full-time role in
                [Location or Remote].
              </p>
              <div className="cta">
                <a className="button primary" href="#contact">
                  Lets talk
                </a>
                <a className="button ghost" href="#projects">
                  View projects
                </a>
              </div>
              <div className="hero-highlights">
                <div className="highlight-card">
                  <p className="label">Focus</p>
                  <p className="value">
                    Frontend, platform, and developer experience
                  </p>
                </div>
                <div className="highlight-card">
                  <p className="label">Stack</p>
                  <p className="value">
                    TypeScript, React, Node.js, cloud services
                  </p>
                </div>
                <div className="highlight-card">
                  <p className="label">Impact</p>
                  <p className="value">
                    Reduced latency, improved conversion, faster release cycles
                  </p>
                </div>
                <div className="highlight-card">
                  <p className="label">API status</p>
                  <p className="value" aria-live="polite">
                    {apiStatusLabel}
                  </p>
                </div>
              </div>
            </div>
            <div className="hero-card">
              <div className="profile-card">
                <div className="avatar" aria-hidden="true">
                  YN
                </div>
                <div>
                  <p className="name">[Your Name]</p>
                  <p className="role">Software Engineer</p>
                  <p className="meta">
                    [City, Country] | Open to [Remote or Relocation]
                  </p>
                </div>
                <div className="contact-list">
                  <a href="mailto:[you@email.com]">[you@email.com]</a>
                  <a href="[https://www.linkedin.com/in/your-handle]">
                    LinkedIn
                  </a>
                  <a href="[https://github.com/your-handle]">GitHub</a>
                </div>
              </div>
              <div className="availability">
                <p className="label">Availability</p>
                <p className="value">Open to new roles starting [Month Year]</p>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="section">
          <div className="container section-grid">
            <div>
              <h2>Context and goal</h2>
              <p>
                This site is focused on helping me get hired as a software
                engineer. I build modern, scalable products and enjoy working
                with product, design, and data partners to solve real customer
                problems.
              </p>
              <p>
                Add a short narrative here that explains your focus, the kind of
                team you want to join, and what makes you effective.
              </p>
              <div className="pill-row">
                <span className="pill">[Domain expertise]</span>
                <span className="pill">[Favorite impact area]</span>
                <span className="pill">[Team values]</span>
              </div>
            </div>
            <div className="card">
              <h3>What I am looking for</h3>
              <ul className="checklist">
                <li>Product-focused engineering teams.</li>
                <li>Ownership and clear impact metrics.</li>
                <li>Culture of feedback, mentorship, and growth.</li>
                <li>Opportunities to ship, learn, and scale.</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="work" className="section muted">
          <div className="container">
            <h2>Experience</h2>
            <div className="timeline">
              <article className="timeline-item">
                <div className="timeline-meta">
                  <p className="role">[Company] - [Role]</p>
                  <p className="time">[YYYY] - [YYYY]</p>
                </div>
                <div className="timeline-content">
                  <p className="summary">
                    Led initiatives to [outcome]. Collaborated with [teams] to
                    deliver [features]. Improved [metric] by [value].
                  </p>
                  <ul>
                    <li>
                      Built [feature] used by [users] and reduced [issue] by
                      [percent].
                    </li>
                    <li>
                      Designed [system] that improved reliability and on-call
                      health.
                    </li>
                    <li>
                      Mentored [number] engineers and improved onboarding time.
                    </li>
                  </ul>
                </div>
              </article>

              <article className="timeline-item">
                <div className="timeline-meta">
                  <p className="role">[Company] - [Role]</p>
                  <p className="time">[YYYY] - [YYYY]</p>
                </div>
                <div className="timeline-content">
                  <p className="summary">
                    Delivered [project] focused on [goal]. Partnered with
                    [stakeholders].
                  </p>
                  <ul>
                    <li>
                      Shipped [feature] that increased [metric] by [value].
                    </li>
                    <li>Automated [workflow], saving [hours] per week.</li>
                  </ul>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="projects" className="section">
          <div className="container">
            <div className="section-header">
              <div>
                <h2>Selected projects</h2>
                <p>Showcase work that demonstrates depth, polish, and impact.</p>
              </div>
              <a className="button ghost" href="[https://github.com/your-handle]">
                View all
              </a>
            </div>
            <div className="card-grid">
              <article className="project-card">
                <div className="project-top">
                  <h3>[Project name]</h3>
                  <span className="tag">[Role]</span>
                </div>
                <p>
                  [One sentence description of the project and its impact or
                  outcome.]
                </p>
                <div className="project-metrics">
                  <span className="metric">Metric: [value]</span>
                  <span className="metric">Users: [count]</span>
                  <span className="metric">Stack: [tech]</span>
                </div>
                <div className="project-links">
                  <a href="[https://github.com/your-handle/project]">Source</a>
                  <a href="[https://project-url.com]">Live</a>
                </div>
              </article>

              <article className="project-card">
                <div className="project-top">
                  <h3>[Project name]</h3>
                  <span className="tag">[Role]</span>
                </div>
                <p>
                  [One sentence description of the project and its impact or
                  outcome.]
                </p>
                <div className="project-metrics">
                  <span className="metric">Metric: [value]</span>
                  <span className="metric">Users: [count]</span>
                  <span className="metric">Stack: [tech]</span>
                </div>
                <div className="project-links">
                  <a href="[https://github.com/your-handle/project]">Source</a>
                  <a href="[https://project-url.com]">Live</a>
                </div>
              </article>

              <article className="project-card">
                <div className="project-top">
                  <h3>[Project name]</h3>
                  <span className="tag">[Role]</span>
                </div>
                <p>
                  [One sentence description of the project and its impact or
                  outcome.]
                </p>
                <div className="project-metrics">
                  <span className="metric">Metric: [value]</span>
                  <span className="metric">Users: [count]</span>
                  <span className="metric">Stack: [tech]</span>
                </div>
                <div className="project-links">
                  <a href="[https://github.com/your-handle/project]">Source</a>
                  <a href="[https://project-url.com]">Live</a>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="skills" className="section muted">
          <div className="container section-grid">
            <div>
              <h2>Skills and tools</h2>
              <p>
                Highlight the technical areas you are confident owning end-to-end.
                Keep this list focused and aligned with the roles you want.
              </p>
              <div className="pill-row">
                <span className="pill">Frontend engineering</span>
                <span className="pill">Design systems</span>
                <span className="pill">Performance optimization</span>
                <span className="pill">API design</span>
                <span className="pill">Observability</span>
                <span className="pill">Technical leadership</span>
              </div>
            </div>
            <div className="card">
              <h3>Technology stack</h3>
              <div className="columns">
                <ul>
                  <li>TypeScript</li>
                  <li>JavaScript</li>
                  <li>React</li>
                  <li>Next.js</li>
                  <li>Node.js</li>
                </ul>
                <ul>
                  <li>PostgreSQL</li>
                  <li>Redis</li>
                  <li>GraphQL</li>
                  <li>Docker</li>
                  <li>Cloud services</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container section-grid">
            <div className="card">
              <h3>Approach</h3>
              <ul className="checklist">
                <li>Start with user needs and define success metrics.</li>
                <li>Ship iteratively with clear milestones and feedback loops.</li>
                <li>
                  Invest in quality through testing, reviews, and observability.
                </li>
                <li>Document decisions and share knowledge.</li>
              </ul>
            </div>
            <div>
              <h2>Proof of impact</h2>
              <p>
                Include a short list of outcomes that hiring managers can scan
                quickly. Examples: &quot;Cut page load time by 40%&quot; or
                &quot;Grew activation by 12%&quot;.
              </p>
              <div className="impact-grid">
                <div className="impact-card">
                  <p className="impact-label">Performance</p>
                  <p className="impact-value">[Metric and result]</p>
                </div>
                <div className="impact-card">
                  <p className="impact-label">Growth</p>
                  <p className="impact-value">[Metric and result]</p>
                </div>
                <div className="impact-card">
                  <p className="impact-label">Reliability</p>
                  <p className="impact-value">[Metric and result]</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="games" className="section">
          <div className="container">
            <div className="section-header">
              <div>
                <h2>Games and Stuff</h2>
                <p>
                  Play with experiments, tools, and interactive experiences that
                  highlight how I build products and systems.
                </p>
              </div>
              <div className="game-status">
                <span className="label">API</span>
                <span className={`status-badge ${apiStatus}`}>
                  {apiStatusLabel}
                </span>
              </div>
            </div>

            <div className="tabs" role="tablist" aria-label="Games">
              {GAME_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  id={`${tab.id}-tab`}
                  role="tab"
                  aria-selected={activeGame === tab.id}
                  aria-controls={`${tab.id}-panel`}
                  className={`tab ${activeGame === tab.id ? 'active' : ''}`}
                  disabled={tab.disabled}
                  onClick={() => setActiveGame(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="games-grid">
              <div
                className="game-card"
                role="tabpanel"
                id="unemploydle-panel"
                aria-labelledby="unemploydle-tab"
                hidden={activeGame !== 'unemploydle'}
              >
                <div className="game-header">
                  <div>
                    <h3>Unemploydle</h3>
                    <p className="muted">
                      Upload your resume, then guess the company name for a
                      curated job match.
                    </p>
                  </div>
                  <span
                    className={`status-badge ${
                      gameState?.status ?? 'ready'
                    }`}
                  >
                    {gameStatusLabel}
                  </span>
                </div>

                <div className="game-grid">
                  <div className="game-panel">
                    <label className="file-input">
                      <span>Resume upload</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleResumeChange}
                      />
                    </label>
                    {resumeFile && (
                      <p className="file-meta">
                        Selected file: <strong>{resumeFile.name}</strong>
                      </p>
                    )}
                    {startError && (
                      <p className="status-line error">{startError}</p>
                    )}
                    <div className="game-actions">
                      <button
                        type="button"
                        className="button primary"
                        onClick={handleStartGame}
                        disabled={isStarting}
                      >
                        {isStarting ? 'Starting...' : 'Start game'}
                      </button>
                      {gameState && (
                        <button
                          type="button"
                          className="button ghost"
                          onClick={handleResetGame}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <p className="note">
                      Job matching is currently mocked with sample data. Swap in
                      real job feeds and LLM ranking when ready.
                    </p>

                    {gameState?.job && (
                      <div className="job-card">
                        <p className="label">Selected role</p>
                        <h4>{gameState.job.title}</h4>
                        <p className="muted">
                          {gameState.job.location} · {gameState.job.source}
                        </p>
                        <div className="job-meta">
                          <span>Match {gameState.job.matchScore}%</span>
                          <span>Rating {gameState.job.rating}</span>
                        </div>
                        <p className="muted">
                          Company: {gameState.job.companyMasked}
                        </p>
                        <p className="note">{gameState.selectionSummary}</p>
                      </div>
                    )}
                  </div>

                  <div className="game-panel">
                    <p className="label">Company to guess</p>
                    <div className="word-display">
                      {gameState?.maskedCompany ?? '—'}
                    </div>
                    <div className="game-meta">
                      <div className="meta-item">
                        <span className="label">Guesses left</span>
                        <span className="value">
                          {gameState?.guessesLeft ?? MAX_GUESSES} /{' '}
                          {gameState?.maxGuesses ?? MAX_GUESSES}
                        </span>
                      </div>
                      <div className="meta-item">
                        <span className="label">Incorrect guesses</span>
                        <span className="value">
                          {gameState?.incorrectGuesses?.length ?? 0}
                        </span>
                      </div>
                    </div>

                    <div className="letters-grid" aria-label="Guess a letter">
                      {LETTERS.map((letter) => {
                        const isUsed = guessedLetters.includes(letter)
                        return (
                          <button
                            key={letter}
                            type="button"
                            className={`letter-button ${isUsed ? 'used' : ''}`}
                            disabled={!isGameActive || isUsed || isGuessing}
                            onClick={() => handleGuess(letter)}
                          >
                            {letter}
                          </button>
                        )
                      })}
                    </div>

                    {guessedLetters.length > 0 && (
                      <p className="note">
                        Guessed letters: {guessedLetters.join(', ')}
                      </p>
                    )}
                    {gameState?.incorrectGuesses?.length > 0 && (
                      <p className="note">
                        Incorrect: {gameState.incorrectGuesses.join(', ')}
                      </p>
                    )}
                    {gameMessage && (
                      <p className="status-line" role="status">
                        {gameMessage}
                      </p>
                    )}

                    {gameState?.status === 'won' && (
                      <div className="result-card success">
                        <h4>Nice work! You matched:</h4>
                        <p className="result-company">
                          {gameState.revealedCompany}
                        </p>
                        {gameState.jobUrl && (
                          <a
                            className="button primary"
                            href={gameState.jobUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View job opening
                          </a>
                        )}
                      </div>
                    )}

                    {gameState?.status === 'lost' && (
                      <div className="result-card warning">
                        <h4>Good try! The company was:</h4>
                        <p className="result-company">
                          {gameState.revealedCompany}
                        </p>
                        {gameState.jobUrl && (
                          <a
                            className="button ghost"
                            href={gameState.jobUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Review the job opening
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="game-card"
                role="tabpanel"
                id="resume-formatter-panel"
                aria-labelledby="resume-formatter-tab"
                hidden={activeGame !== 'resume-formatter'}
              >
                <div className="game-header">
                  <div>
                    <h3>Resume Formatter</h3>
                    <p className="muted">
                      Upload a resume and generate polished formats ready to
                      download.
                    </p>
                  </div>
                  <span className={`status-badge ${formatterStatusClass}`}>
                    {formatterStatusLabel}
                  </span>
                </div>

                <div className="game-grid">
                  <div className="game-panel">
                    <label className="file-input">
                      <span>Resume upload</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleFormatterFileChange}
                      />
                    </label>
                    {formatterFile && (
                      <p className="file-meta">
                        Selected file: <strong>{formatterFile.name}</strong>
                      </p>
                    )}

                    <label className="file-input">
                      <span>Choose a format</span>
                      <select
                        className="select-input"
                        value={selectedFormat}
                        onChange={(event) => setSelectedFormat(event.target.value)}
                      >
                        {RESUME_FORMATS.map((format) => (
                          <option key={format.id} value={format.id}>
                            {format.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="note">
                      {selectedFormatMeta?.description ??
                        'Pick a format to preview and download.'}
                    </p>

                    {formatError && (
                      <p className="status-line error">{formatError}</p>
                    )}

                    <div className="game-actions">
                      <button
                        type="button"
                        className="button primary"
                        onClick={handleFormatResume}
                        disabled={isFormatting}
                      >
                        {isFormatting ? 'Formatting...' : 'Generate format'}
                      </button>
                      <button
                        type="button"
                        className="button ghost"
                        onClick={handleDownloadFormatted}
                        disabled={!formatResult}
                      >
                        Download
                      </button>
                    </div>
                    <p className="note">
                      Formatting is currently mocked with basic templates. Swap
                      in a richer parser or LLM-based formatting when ready.
                    </p>
                  </div>

                  <div className="game-panel">
                    <p className="label">Preview</p>
                    <div className="preview-box">
                      <pre>
                        {formatResult?.content ??
                          'Upload a resume and generate a format to preview.'}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="game-card placeholder"
                role="tabpanel"
                id="coming-soon-panel"
                aria-labelledby="coming-soon-tab"
                hidden={activeGame !== 'coming-soon'}
              >
                <h3>More games coming soon</h3>
                <p className="muted">
                  Ideas include interview prep challenges, system design
                  puzzles, and growth experiments.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="section contact">
          <div className="container contact-card">
            <div>
              <h2>Lets build something together</h2>
              <p>
                I am currently open to software engineering roles. If you are
                hiring, I would love to hear about the team and the problems you
                are solving.
              </p>
            </div>
            <div className="contact-actions">
              <a className="button primary" href="mailto:[you@email.com]">
                Email me
              </a>
              <a
                className="button ghost"
                href="[https://www.linkedin.com/in/your-handle]"
              >
                LinkedIn
              </a>
              <a className="button ghost" href="[https://github.com/your-handle]">
                GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-row">
          <p>
            Copyright {year} [Your Name]. All rights reserved.
          </p>
          <div className="footer-links">
            <a href="#top">Back to top</a>
            <a href="[resume.pdf]">Resume</a>
          </div>
        </div>
      </footer>
    </>
  )
}

export default App
