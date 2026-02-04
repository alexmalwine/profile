const SiteFooter = ({ year }) => (
  <footer className="site-footer">
    <div className="container footer-row">
      <p>Copyright {year} Alex Alwine. All rights reserved.</p>
      <div className="footer-links">
        <a href="#top">Back to top</a>
        <a href="/resume.pdf" target="_blank" rel="noreferrer">
          Resume
        </a>
      </div>
    </div>
  </footer>
)

export default SiteFooter
