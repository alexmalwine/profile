import { useState } from 'react'
import {
  GAME_TABS,
  LETTERS,
  MAX_GUESSES,
  MAX_TRADING_CARD_COMBINATIONS,
  TRADING_CARD_ART_STYLES,
} from '../constants/gameConstants'
import { useCustomTradingCards } from '../hooks/useCustomTradingCards'
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
  } = useUnemployedleGame()
  const {
    cardTitlesInput,
    prefixesInput,
    theme,
    artStyle,
    referenceImages,
    isGenerating: isGeneratingCards,
    error: cardsError,
    downloadUrl,
    downloadName,
    cardTitles,
    prefixCount,
    totalCombinations,
    handleCardTitlesChange,
    handlePrefixesChange,
    handleThemeChange,
    handleArtStyleChange,
    handleReferenceImagesChange,
    handleGenerateCards,
    handleReset: handleResetCards,
  } = useCustomTradingCards()
  const isGenerating = isStarting || isListing
  const isShowingTopJobs = isListing || topJobs.length > 0
  const canRunJobs = Boolean(resumeFile) && !isGenerating
  const totalJobCount = topJobs.length
  const topJobsLabel =
    totalJobCount > 0
      ? `Top job matches (${totalJobCount})`
      : 'Top job matches'
  const visibleTopJobs = topJobs.slice(0, topJobsVisibleCount)
  const canShowMoreJobs = visibleTopJobs.length < topJobs.length
  const generationLabel = isStarting
    ? 'Generating your game'
    : isListing
      ? 'Generating your top jobs'
      : ''
  const isGameActive = gameState?.status === 'in_progress'
  const gameStatusLabel = isGenerating
    ? 'Generating'
    : gameState?.status === 'won'
      ? 'You won'
      : gameState?.status === 'lost'
        ? 'Game over'
        : isGameActive
          ? 'In progress'
          : 'Ready'
  const gameStatusClass = isGenerating
    ? 'loading'
    : gameState?.status ?? 'ready'
  const cardsStatusClass = isGeneratingCards
    ? 'loading'
    : downloadUrl
      ? 'formatted'
      : 'ready'
  const cardsStatusLabel = isGeneratingCards
    ? 'Generating'
    : downloadUrl
      ? 'Zip ready'
      : 'Ready'
  const cardTitleCount = cardTitles.length
  const isOverCardLimit =
    totalCombinations > MAX_TRADING_CARD_COMBINATIONS
  const cardsSummary = totalCombinations
    ? `${totalCombinations} card${totalCombinations === 1 ? '' : 's'}`
    : 'No cards yet'
  const selectedArtStyle = TRADING_CARD_ART_STYLES.find(
    (style) => style.id === artStyle,
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
            className={`game-card${isGenerating ? ' is-loading' : ''}`}
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
                className={`status-badge ${gameStatusClass}`}
              >
                {gameStatusLabel}
              </span>
            </div>

            {isGenerating && (
              <div className="loading-banner" role="status" aria-live="polite">
                <span className="loading-spinner" aria-hidden="true" />
                <div>
                  <p className="loading-title">{generationLabel}</p>
                  <p className="loading-subtitle">
                    This can take a bit. We are searching live job boards and
                    ranking matches.
                  </p>
                </div>
              </div>
            )}

            {isShowingTopJobs ? (
              <div className="game-grid jobs-only">
                <div className="game-panel job-panel full">
                  <div className="job-panel-header">
                    <div>
                      <p className="label">{topJobsLabel}</p>
                      {resumeFile && (
                        <p className="file-meta compact">
                          Using {resumeFile.name}
                        </p>
                      )}
                    </div>
                    <div className="job-panel-actions">
                      <button
                        type="button"
                        className="button ghost"
                        onClick={handleStartGame}
                        disabled={!canRunJobs}
                      >
                        Start game
                      </button>
                      <button
                        type="button"
                        className="button primary"
                        onClick={handleFetchTopJobs}
                        disabled={!canRunJobs}
                      >
                        {isListing ? 'Loading...' : 'Get top jobs'}
                      </button>
                      <button
                        type="button"
                        className="button ghost"
                        onClick={handleResetGame}
                        disabled={isGenerating}
                      >
                        New search
                      </button>
                    </div>
                  </div>
                  {jobsError && <p className="status-line error">{jobsError}</p>}
                  {!isListing && topJobsSummary && (
                    <p className="note">{topJobsSummary}</p>
                  )}
                  {!isListing && visibleTopJobs.length > 0 && (
                    <>
                      <div className="job-list expanded">
                        {visibleTopJobs.map((job) => (
                          <div key={job.id} className="job-list-item">
                            <div>
                              <p className="job-title">{job.title}</p>
                              <p className="muted">
                                {job.company} · {job.location}
                              </p>
                            </div>
                            <div className="job-badges">
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
                      {canShowMoreJobs && (
                        <div className="pagination-controls">
                          <button
                            type="button"
                            className="button ghost small"
                            onClick={handleShowMoreJobs}
                            disabled={isGenerating}
                          >
                            Show more jobs
                          </button>
                          <span className="pagination-status">
                            Showing {visibleTopJobs.length} of {topJobs.length}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="game-grid">
                <div className="game-panel">
                  <label className="file-input">
                    <span>Resume upload</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleResumeChange}
                      disabled={isGenerating}
                    />
                  </label>
                  {resumeFile && (
                    <p className="file-meta">
                      Selected file: <strong>{resumeFile.name}</strong>
                    </p>
                  )}
                  <div className="form-group">
                    <p className="label">Desired Job Title (optional)</p>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Senior Full Stack Engineer"
                      value={desiredJobTitle}
                      disabled={isGenerating}
                      onChange={(event) =>
                        setDesiredJobTitle(event.target.value)
                      }
                    />
                    <p className="note">
                      Narrow your search further by telling us the title you want
                      for your next job
                    </p>
                  </div>
                  <div className="form-group">
                    <p className="label">Job location filters</p>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={locationPreferences.includeRemote}
                        disabled={isGenerating}
                        onChange={(event) =>
                          setLocationPreferences((previous) => ({
                            ...previous,
                            includeRemote: event.target.checked,
                          }))
                        }
                      />
                      <span>Remote</span>
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={locationPreferences.includeLocal}
                        disabled={isGenerating}
                        onChange={(event) =>
                          setLocationPreferences((previous) => ({
                            ...previous,
                            includeLocal: event.target.checked,
                          }))
                        }
                      />
                      <span>Local (near resume location)</span>
                    </label>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={locationPreferences.includeSpecific}
                        disabled={isGenerating}
                        onChange={(event) =>
                          setLocationPreferences((previous) => ({
                            ...previous,
                            includeSpecific: event.target.checked,
                          }))
                        }
                      />
                      <span>Specific location</span>
                    </label>
                    {locationPreferences.includeSpecific && (
                      <input
                        type="text"
                        className="text-input"
                        placeholder="City, State or Country"
                        value={locationPreferences.specificLocation}
                        disabled={isGenerating}
                        onChange={(event) =>
                          setLocationPreferences((previous) => ({
                            ...previous,
                            specificLocation: event.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                  {startError && <p className="status-line error">{startError}</p>}
                  <div className="game-actions">
                    <button
                      type="button"
                      className="button primary"
                      onClick={handleStartGame}
                      disabled={isGenerating}
                    >
                      {isStarting ? 'Starting...' : 'Start game'}
                    </button>
                    <button
                      type="button"
                      className="button ghost"
                      onClick={handleFetchTopJobs}
                      disabled={isGenerating}
                    >
                      {isListing ? 'Loading...' : 'Get top jobs'}
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
            )}
          </div>

          <div
            className={`game-card${isGeneratingCards ? ' is-loading' : ''}`}
            role="tabpanel"
            id="custom-trading-cards-panel"
            aria-labelledby="custom-trading-cards-tab"
            hidden={activeGame !== 'custom-trading-cards'}
          >
            <div className="game-header">
              <div>
                <h3>Custom Trading Cards</h3>
                <p className="muted">
                  Generate a full trading card set in one batch using an
                  affordable AI image model.
                </p>
              </div>
              <span className={`status-badge ${cardsStatusClass}`}>
                {cardsStatusLabel}
              </span>
            </div>

            {isGeneratingCards && (
              <div className="loading-banner compact" role="status" aria-live="polite">
                <span className="loading-spinner" aria-hidden="true" />
                <div>
                  <p className="loading-title">Generating your cards</p>
                  <p className="loading-subtitle">
                    We are rendering each card with the selected art style.
                  </p>
                </div>
              </div>
            )}

            <div className="game-grid">
              <div className="game-panel">
                <div className="form-group">
                  <p className="label">Card titles</p>
                  <textarea
                    className="text-input text-area"
                    placeholder="Charizard&#10;Pikachu&#10;Mewtwo"
                    rows={4}
                    value={cardTitlesInput}
                    disabled={isGeneratingCards}
                    onChange={handleCardTitlesChange}
                  />
                  <p className="note">
                    Add one title per line. Every prefix combined with every
                    title becomes a card.
                  </p>
                </div>

                <div className="form-group">
                  <p className="label">Optional prefixes</p>
                  <textarea
                    className="text-input text-area"
                    placeholder="Shiny&#10;Mega"
                    rows={3}
                    value={prefixesInput}
                    disabled={isGeneratingCards}
                    onChange={handlePrefixesChange}
                  />
                  <p className="note">
                    Leave blank if you only want the base titles.
                  </p>
                </div>

                <div className="form-group">
                  <p className="label">Theme</p>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Neon cyber city with storm clouds"
                    value={theme}
                    disabled={isGeneratingCards}
                    onChange={handleThemeChange}
                  />
                  <p className="note">
                    Themes help the AI keep the imagery consistent across the set.
                  </p>
                </div>

                <div className="form-group">
                  <p className="label">Art style</p>
                  <select
                    className="select-input"
                    value={artStyle}
                    disabled={isGeneratingCards}
                    onChange={handleArtStyleChange}
                  >
                    {TRADING_CARD_ART_STYLES.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.label}
                      </option>
                    ))}
                  </select>
                  {selectedArtStyle?.description && (
                    <p className="note">{selectedArtStyle.description}</p>
                  )}
                </div>

                <label className="file-input">
                  <span>Reference images (optional)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isGeneratingCards}
                    onChange={handleReferenceImagesChange}
                  />
                </label>
                {referenceImages.length > 0 && (
                  <p className="file-meta">
                    Selected files: {referenceImages.map((file) => file.name).join(', ')}
                  </p>
                )}
                <p className="note">
                  File names must match card titles (ex: "Charizard.png").
                </p>

                {cardsError && <p className="status-line error">{cardsError}</p>}

                <div className="game-actions">
                  <button
                    type="button"
                    className="button primary"
                    onClick={handleGenerateCards}
                    disabled={
                      isGeneratingCards ||
                      isOverCardLimit ||
                      cardTitleCount === 0 ||
                      !theme.trim()
                    }
                  >
                    {isGeneratingCards ? 'Generating...' : 'Generate cards'}
                  </button>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={handleResetCards}
                    disabled={isGeneratingCards}
                  >
                    Reset
                  </button>
                  {downloadUrl && (
                    <a
                      className="button ghost"
                      href={downloadUrl}
                      download={downloadName || 'custom-trading-cards.zip'}
                    >
                      Download zip
                    </a>
                  )}
                </div>
                <p className="note">
                  Limit each request to {MAX_TRADING_CARD_COMBINATIONS} cards to
                  keep AI costs low.
                </p>
              </div>

              <div className="game-panel">
                <p className="label">Generation summary</p>
                <div className="game-meta">
                  <div className="meta-item">
                    <span className="label">Titles</span>
                    <span className="value">{cardTitleCount}</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">Prefixes</span>
                    <span className="value">{prefixCount}</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">Total cards</span>
                    <span className="value">{totalCombinations || 0}</span>
                  </div>
                  <div className="meta-item">
                    <span className="label">Reference images</span>
                    <span className="value">{referenceImages.length}</span>
                  </div>
                </div>
                <p className="note">
                  {cardsSummary} will be generated using the {selectedArtStyle?.label ?? 'selected'} style.
                </p>
                {isOverCardLimit && (
                  <p className="status-line error">
                    Too many combinations. Reduce titles or prefixes to stay
                    under {MAX_TRADING_CARD_COMBINATIONS}.
                  </p>
                )}
                {downloadUrl && (
                  <div className="result-card success">
                    <h4>Cards ready!</h4>
                    <p className="note">
                      Your zip download should start automatically. Use the
                      download button to grab it again.
                    </p>
                  </div>
                )}
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
