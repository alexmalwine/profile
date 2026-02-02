const WorkSection = () => (
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
              Led high-impact product initiatives across TypeScript, Node.js/NestJS,
              React, and OpenSearch to improve matching and search experiences.
            </p>
            <ul>
              <li>
                Led a new matching experience with React UI and Node.js/NestJS APIs
                backed by OpenSearch, reducing page load time by 70%.
              </li>
              <li>
                Built Go-based data sink services consuming Debezium CDC via Kafka
                Connect to keep search indexes fresh.
              </li>
              <li>
                Unified iOS/Android apps into a single React Native codebase,
                doubling feature delivery speed.
              </li>
              <li>
                Delivered core features for a subscription product line, generating
                $8M in annual revenue.
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
              Built core buyer/provider workflows and scalable platform capabilities
              in Node.js and TypeScript.
            </p>
            <ul>
              <li>
                Built and maintained backend endpoints for buyer and provider
                workflows.
              </li>
              <li>
                Delivered private network capabilities and scheduling experiences
                to assign work to providers.
              </li>
              <li>
                Implemented assignment routing to provider companies, simplifying
                coordination.
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
              Built internal tools and automation to improve support workflows and
              data quality.
            </p>
            <ul>
              <li>
                Built scripts to track notification ticket root causes, improving
                response and resolution times.
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
)

export default WorkSection
