import { API_STATUS_LABELS } from './constants/gameConstants'
import AboutSection from './components/AboutSection'
import ApproachSection from './components/ApproachSection'
import ContactSection from './components/ContactSection'
import GamesSection from './components/GamesSection'
import HeroSection from './components/HeroSection'
import ProjectsSection from './components/ProjectsSection'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import SkillsSection from './components/SkillsSection'
import WorkSection from './components/WorkSection'
import { useApiStatus } from './hooks/useApiStatus'

function App() {
  const apiStatus = useApiStatus()
  const apiStatusLabel = API_STATUS_LABELS[apiStatus] ?? apiStatus
  const year = new Date().getFullYear()

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">
        <HeroSection apiStatusLabel={apiStatusLabel} />
        <AboutSection />
        <WorkSection />
        <ProjectsSection />
        <SkillsSection />
        <ApproachSection />
        <GamesSection apiStatus={apiStatus} apiStatusLabel={apiStatusLabel} />
        <ContactSection />
      </main>
      <SiteFooter year={year} />
    </>
  )
}

export default App
