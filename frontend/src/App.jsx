import { useEffect, useState } from 'react'

const API_STATUS_LABELS = {
  checking: 'Checking...',
  online: 'Connected',
  offline: 'Offline',
}

const GAME_TABS = [
  { id: 'unemployedle', label: 'Unemployedle' },
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
  const [activeGame, setActiveGame] = useState('unemployedle')
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
            Alex Alwine
          </a>
          <nav className="nav">
            <a href="#about">About</a>
            <a href="#work">Work</a>
            <a href="#projects">Projects</a>
            <a href="#skills">Skills</a>
            <a href="#games">Games and Stuff</a>
            <a href="#contact">Contact</a>
          </nav>
          <a className="button small" href="/resume.pdf">
            Resume
          </a>
        </div>
      </header>

      <main id="main">
        <section id="top" className="hero">
          <div className="container hero-grid">
            <div className="hero-content">
              <p className="eyebrow">Senior Software Engineer</p>
              <h1>Senior software engineer building high-impact SaaS products.</h1>
              <p className="lead">
                Senior software engineer with 10 years of experience building
                product-facing SaaS applications. I ship TypeScript across the
                stack, design Node.js/NestJS APIs, and deliver customer-facing
                experiences with React and React Native.
              </p>
              <div className="cta">
                <a className="button primary" href="#contact">
                  Let's talk
                </a>
                <a className="button ghost" href="#projects">
                  View projects
                </a>
              </div>
              <div className="hero-highlights">
                <div className="highlight-card">
                  <p className="label">Focus</p>
                  <p className="value">
                    SaaS platforms, matching/search, reliability and observability
                  </p>
                </div>
                <div className="highlight-card">
                  <p className="label">Stack</p>
                  <p className="value">
                    TypeScript, Node.js/NestJS, React, AWS, Kafka
                  </p>
                </div>
                <div className="highlight-card">
                  <p className="label">Impact</p>
                  <p className="value">
                    70% faster pages, $8M revenue, 2x mobile delivery speed
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
                <div className="avatar">
                  <img
                    className="avatar-image"
                    src="/me.jpg"
                    alt="Alex Alwine"
                  />
                </div>
                <div>
                  <p className="name">Alex Alwine</p>
                  <p className="role">Senior Software Engineer</p>
                  <p className="meta">
                    St. Louis Park, MN | Open to new opportunities
                  </p>
                </div>
                <div className="contact-list">
                  <a href="mailto:alex.m.alwine@gmail.com">
                    alex.m.alwine@gmail.com
                  </a>
                  <a href="tel:+16309814594">630-981-4594</a>
                  <a href="https://www.linkedin.com/in/alex-alwine">
                    LinkedIn
                  </a>
                </div>
              </div>
              <div className="availability">
                <p className="label">Availability</p>
                <p className="value">Open to new senior software roles</p>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="section">
          <div className="container section-grid">
            <div>
              <h2>Context and goal</h2>
              <p>
                I build product-facing SaaS applications with a strong emphasis
                on TypeScript across the stack. I design and ship Node.js/NestJS
                backend services, and deliver customer-facing interfaces with
                React and React Native.
              </p>
              <p>
                I am known for modernizing legacy systems, building scalable
                event-driven integrations, improving reliability and
                observability, and partnering closely with product and design to
                ship high-impact features.
              </p>
              <div className="pill-row">
                <span className="pill">Product SaaS platforms</span>
                <span className="pill">Event-driven integrations</span>
                <span className="pill">Observability & reliability</span>
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
                  <p className="role">Field Nation - Senior Software Engineer</p>
                  <p className="time">2021 - 2026</p>
                </div>
                <div className="timeline-content">
                  <p className="summary">
                    Led high-impact product initiatives across TypeScript,
                    Node.js/NestJS, React, and OpenSearch to improve matching
                    and search experiences.
                  </p>
                  <ul>
                    <li>
                      Led a new matching experience with React UI and
                      Node.js/NestJS APIs backed by OpenSearch, reducing page
                      load time by 70%.
                    </li>
                    <li>
                      Built Go-based data sink services consuming Debezium CDC
                      via Kafka Connect to keep search indexes fresh.
                    </li>
                    <li>
                      Unified iOS/Android apps into a single React Native
                      codebase, doubling feature delivery speed.
                    </li>
                    <li>
                      Delivered core features for a subscription product line,
                      generating $8M in annual revenue.
                    </li>
                  </ul>
                </div>
              </article>

              <article className="timeline-item">
                <div className="timeline-meta">
                  <p className="role">Field Nation - Software Engineer</p>
                  <p className="time">2019 - 2021</p>
                </div>
                <div className="timeline-content">
                  <p className="summary">
                    Built core buyer/provider workflows and scalable platform
                    capabilities in Node.js and TypeScript.
                  </p>
                  <ul>
                    <li>
                      Built and maintained backend endpoints for buyer and
                      provider workflows.
                    </li>
                    <li>
                      Delivered private network capabilities and scheduling
                      experiences to assign work to providers.
                    </li>
                    <li>
                      Implemented assignment routing to provider companies,
                      simplifying coordination.
                    </li>
                    <li>
                      Created 1099 reporting tools that reduced support toil.
                    </li>
                  </ul>
                </div>
              </article>

              <article className="timeline-item">
                <div className="timeline-meta">
                  <p className="role">Field Nation - Associate Software Engineer</p>
                  <p className="time">2016 - 2019</p>
                </div>
                <div className="timeline-content">
                  <p className="summary">
                    Built internal tools and automation to improve support
                    workflows and data quality.
                  </p>
                  <ul>
                    <li>
                      Built scripts to track notification ticket root causes,
                      improving response and resolution times.
                    </li>
                    <li>
                      Automated merging of duplicate location records to reduce
                      long-standing data quality issues.
                    </li>
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
                <p>Highlights from recent product and platform work.</p>
              </div>
            </div>
            <div className="card-grid">
              <article className="project-card">
                <div className="project-top">
                  <h3>Matching Experience & Search</h3>
                  <span className="tag">Full Stack Engineer</span>
                </div>
                <p>
                  Built a new matching experience with a React UI and
                  Node.js/NestJS APIs backed by OpenSearch to improve search and
                  responsiveness.
                </p>
                <div className="project-metrics">
                  <span className="metric">Impact: 70% faster load times</span>
                  <span className="metric">Stack: React, NestJS, OpenSearch</span>
                </div>
              </article>

              <article className="project-card">
                <div className="project-top">
                  <h3>Event-driven Search Indexing</h3>
                  <span className="tag">Backend Engineer</span>
                </div>
                <p>
                  Implemented Go-based data sink services consuming Debezium CDC
                  via Kafka Connect to keep OpenSearch indexes fresh.
                </p>
                <div className="project-metrics">
                  <span className="metric">Focus: Fresh search data</span>
                  <span className="metric">Stack: Go, Kafka, Debezium</span>
                </div>
              </article>

              <article className="project-card">
                <div className="project-top">
                  <h3>Mobile Modernization</h3>
                  <span className="tag">Mobile Lead</span>
                </div>
                <p>
                  Consolidated iOS and Android apps into a unified React Native
                  codebase to accelerate delivery.
                </p>
                <div className="project-metrics">
                  <span className="metric">Impact: 2x delivery speed</span>
                  <span className="metric">Stack: React Native</span>
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
                Core strengths across TypeScript, Node.js/NestJS, React, SQL,
                and event-driven architecture, with a focus on reliability and
                customer-facing SaaS platforms.
              </p>
              <div className="pill-row">
                <span className="pill">TypeScript</span>
                <span className="pill">Node.js/NestJS</span>
                <span className="pill">React & React Native</span>
                <span className="pill">Kafka & event-driven systems</span>
                <span className="pill">Search & OpenSearch</span>
                <span className="pill">Observability</span>
              </div>
            </div>
            <div className="card">
              <h3>Technology stack</h3>
              <div className="columns">
                <ul>
                  <li>TypeScript</li>
                  <li>Node.js</li>
                  <li>NestJS</li>
                  <li>React</li>
                  <li>React Native</li>
                </ul>
                <ul>
                  <li>SQL / MySQL</li>
                  <li>Kafka</li>
                  <li>OpenSearch</li>
                  <li>Redis</li>
                  <li>AWS</li>
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
                Outcomes I am proud of from recent product and platform work.
              </p>
              <div className="impact-grid">
                <div className="impact-card">
                  <p className="impact-label">Performance</p>
                  <p className="impact-value">Reduced page load time by 70%</p>
                </div>
                <div className="impact-card">
                  <p className="impact-label">Revenue</p>
                  <p className="impact-value">$8M annual revenue impact</p>
                </div>
                <div className="impact-card">
                  <p className="impact-label">Delivery</p>
                  <p className="impact-value">Doubled mobile delivery speed</p>
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
                id="unemployedle-panel"
                aria-labelledby="unemployedle-tab"
                hidden={activeGame !== 'unemployedle'}
              >
                <div className="game-header">
                  <div>
                    <h3>Unemployedle</h3>
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
                      <button
                        type="button"
                        className="button ghost"
                        onClick={handleFetchTopJobs}
                        disabled={isListing}
                      >
                        {isListing ? 'Loading...' : 'Get top 10 jobs'}
                      </button>
                      {(gameState || topJobs.length > 0) && (
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
                      Job matching is powered by ChatGPT and live job board
                      queries based on your resume.
                    </p>
                    {jobsError && (
                      <p className="status-line error">{jobsError}</p>
                    )}

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

                    {topJobs.length > 0 && (
                      <div className="job-card">
                        <p className="label">Top 10 matches</p>
                        {topJobsSummary && (
                          <p className="note">{topJobsSummary}</p>
                        )}
                        <div className="job-list">
                          {topJobs.map((job) => (
                            <div key={job.id} className="job-list-item">
                              <div>
                                <p className="job-title">{job.title}</p>
                                <p className="muted">
                                  {job.company} · {job.location}
                                </p>
                              </div>
                              <div className="job-badges">
                                <span className="pill">
                                  Match {job.matchScore}%
                                </span>
                                <span className="pill">
                                  Rating {job.rating}
                                </span>
                                <span className="pill">{job.source}</span>
                              </div>
                              <a
                                className="button ghost"
                                href={job.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View opening
                              </a>
                            </div>
                          ))}
                        </div>
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
              <h2>Let's build something together</h2>
              <p>
                I am currently open to senior software engineering roles. If you
                are hiring, I would love to hear about the team and the problems
                you are solving.
              </p>
            </div>
            <div className="contact-actions">
              <a
                className="button primary"
                href="mailto:alex.m.alwine@gmail.com"
              >
                Email me
              </a>
              <a
                className="button ghost"
                href="https://www.linkedin.com/in/alex-alwine"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-row">
          <p>Copyright {year} Alex Alwine. All rights reserved.</p>
          <div className="footer-links">
            <a href="#top">Back to top</a>
            <a href="/resume.pdf">Resume</a>
          </div>
        </div>
      </footer>
    </>
  )
}

export default App
