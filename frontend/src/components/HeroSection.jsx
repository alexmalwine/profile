const HeroSection = ({ apiStatusLabel }) => (
  <section id="top" className="hero">
    <div className="container hero-grid">
      <div className="hero-content">
        <p className="eyebrow">Senior Software Engineer</p>
        <h1>Senior software engineer building high-impact SaaS products.</h1>
        <p className="lead">
          Senior software engineer with 10 years of experience building
          product-facing SaaS applications. I ship TypeScript across the stack,
          design Node.js/NestJS APIs, and deliver customer-facing experiences
          with React and React Native.
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
            <p className="value">TypeScript, Node.js/NestJS, React, AWS, Kafka</p>
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
            <img className="avatar-image" src="/me.jpg" alt="Alex Alwine" />
          </div>
          <div>
            <p className="name">Alex Alwine</p>
            <p className="role">Senior Software Engineer</p>
            <p className="meta">St. Louis Park, MN | Open to new opportunities</p>
          </div>
          <div className="contact-list">
            <a href="mailto:alex.m.alwine@gmail.com">alex.m.alwine@gmail.com</a>
            <a href="tel:+16309814594">630-981-4594</a>
            <a href="https://www.linkedin.com/in/alex-alwine">LinkedIn</a>
          </div>
        </div>
        <div className="availability">
          <p className="label">Availability</p>
          <p className="value">Open to new senior software roles</p>
        </div>
      </div>
    </div>
  </section>
)

export default HeroSection
