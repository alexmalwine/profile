const AboutSection = () => (
  <section id="about" className="section">
    <div className="container section-grid">
      <div>
        <h2>Context and goal</h2>
        <p>
          I build product-facing SaaS applications with a strong emphasis on
          TypeScript across the stack. I design and ship Node.js/NestJS backend
          services, and deliver customer-facing interfaces with React and React
          Native.
        </p>
        <p>
          I am known for modernizing legacy systems, building scalable
          event-driven integrations, improving reliability and observability,
          and partnering closely with product and design to ship high-impact
          features.
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
)

export default AboutSection
