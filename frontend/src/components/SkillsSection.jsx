const SkillsSection = () => (
  <section id="skills" className="section muted">
    <div className="container section-grid">
      <div>
        <h2>Skills and tools</h2>
        <p>
          Core strengths across TypeScript, Node.js/NestJS, React, SQL, and
          event-driven architecture, with a focus on reliability and
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
)

export default SkillsSection
