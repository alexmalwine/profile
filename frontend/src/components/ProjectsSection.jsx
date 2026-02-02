const ProjectsSection = () => (
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
            Built a new matching experience with a React UI and Node.js/NestJS APIs
            backed by OpenSearch to improve search and responsiveness.
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
            Implemented Go-based data sink services consuming Debezium CDC via
            Kafka Connect to keep OpenSearch indexes fresh.
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
            Consolidated iOS and Android apps into a unified React Native codebase
            to accelerate delivery.
          </p>
          <div className="project-metrics">
            <span className="metric">Impact: 2x delivery speed</span>
            <span className="metric">Stack: React Native</span>
          </div>
        </article>
      </div>
    </div>
  </section>
)

export default ProjectsSection
