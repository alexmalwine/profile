import { useEffect, useState } from 'react'

const API_STATUS_LABELS = {
  checking: 'Checking...',
  online: 'Connected',
  offline: 'Offline',
}

function App() {
  const [apiStatus, setApiStatus] = useState('checking')
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
