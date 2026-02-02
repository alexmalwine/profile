const SiteHeader = () => (
  <header className="site-header">
    <div className="container nav-row">
      <a className="logo" href="#top">
        Alex Alwine
      </a>
      <nav className="nav">
        <a href="#about">About</a>
        <a href="#work">Work</a>
        <a href="#projects">Projects</a>
        <a href="#skills">Skills</a>
        <a href="#games">Games and Stuff</a>
        <a href="#contact">Contact</a>
      </nav>
      <a className="button small" href="/resume.pdf">
        Resume
      </a>
    </div>
  </header>
)

export default SiteHeader
