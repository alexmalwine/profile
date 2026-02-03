import { useState } from 'react'
import {
  GAME_TABS,
  LETTERS,
  MAX_GUESSES,
  RESUME_FORMATS,
} from '../constants/gameConstants'
import { useResumeFormatter } from '../hooks/useResumeFormatter'
import { useUnemployedleGame } from '../hooks/useUnemployedleGame'

const GamesSection = ({ apiStatus, apiStatusLabel }) => {
  const [activeGame, setActiveGame] = useState('unemployedle')
  const {
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
  } = useUnemployedleGame()
  const {
    formatterFile,
    selectedFormat,
    setSelectedFormat,
    formatResult,
    formatError,
    isFormatting,
    handleFormatterFileChange,
    handleFormatResume,
    handleDownloadFormatted,
  } = useResumeFormatter()
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
    (format) => format.id === selectedFormat,
  )

  return (
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
                  Upload your resume, then guess the company name for a curated
                  job match.
                </p>
              </div>
              <span
                className={`status-badge ${gameState?.status ?? 'ready'}`}
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
                {startError && <p className="status-line error">{startError}</p>}
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
                  Job matching is powered by ChatGPT and live job board queries
                  based on your resume.
                </p>
                {jobsError && <p className="status-line error">{jobsError}</p>}

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
                    {topJobsSummary && <p className="note">{topJobsSummary}</p>}
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
                            <span className="pill">Rating {job.rating}</span>
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
                {gameState?.hint && (
                  <p className="note">
                    Hint: {gameState.hint}
                  </p>
                )}

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
                    <p className="result-company">{gameState.revealedCompany}</p>
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
                    <p className="result-company">{gameState.revealedCompany}</p>
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
                  Upload a resume and generate polished formats ready to download.
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
                  Formatting is currently mocked with basic templates. Swap in a
                  richer parser or LLM-based formatting when ready.
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
              Ideas include interview prep challenges, system design puzzles, and
              growth experiments.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default GamesSection
