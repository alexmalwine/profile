const ApproachSection = () => (
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
        <p>Outcomes I am proud of from recent product and platform work.</p>
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
)

export default ApproachSection
