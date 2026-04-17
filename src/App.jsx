import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './components/Login'
import ProjectList from './components/ProjectList'
import ProjectDetail from './components/ProjectDetail'
import ArticleDetail from './components/ArticleDetail'
import QuoteImport from './components/QuoteImport'
import Archives from './components/Archives'
import TeamManager from './components/TeamManager'
import Settings from './components/Settings'
import { Spinner } from './components/ui'

export default function App() {
  const { currentWorker, isAdmin, loading, login, logout } = useAuth()
  const [activePage, setActivePage] = useState('projects')
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [selectedArticleId, setSelectedArticleId] = useState(null)

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!currentWorker) {
    return <Login onLogin={login} />
  }

  const navigate = (page) => {
    setActivePage(page)
    setSelectedProjectId(null)
    setSelectedArticleId(null)
  }

  const openProject = (projectId) => {
    setSelectedProjectId(projectId)
    setSelectedArticleId(null)
    setActivePage('project-detail')
  }

  const openArticle = (articleId) => {
    setSelectedArticleId(articleId)
    setActivePage('article-detail')
  }

  const goBackToProject = () => {
    setSelectedArticleId(null)
    if (selectedProjectId) {
      setActivePage('project-detail')
    } else {
      setActivePage('projects')
    }
  }

  const goBackToList = () => {
    setSelectedProjectId(null)
    setSelectedArticleId(null)
    setActivePage('projects')
  }

  const renderPage = () => {
    switch (activePage) {
      case 'projects':
        return <ProjectList onSelect={openProject} />

      case 'project-detail':
        return (
          <ProjectDetail
            projectId={selectedProjectId}
            currentWorker={currentWorker}
            onBack={goBackToList}
            onSelectArticle={openArticle}
          />
        )

      case 'article-detail':
        return (
          <ArticleDetail
            articleId={selectedArticleId}
            projectId={selectedProjectId}
            currentWorker={currentWorker}
            onBack={goBackToProject}
          />
        )

      case 'import':
        return <QuoteImport onNavigate={navigate} />

      case 'archives':
        return <Archives onSelectProject={openProject} />

      case 'team':
        return <TeamManager isAdmin={isAdmin} />

      case 'settings':
        return <Settings currentWorker={currentWorker} />

      default:
        return <ProjectList onSelect={openProject} />
    }
  }

  // Determine which nav tab is active
  const navPage = ['project-detail', 'article-detail'].includes(activePage) ? 'projects' : activePage

  return (
    <Layout
      activePage={navPage}
      onNavigate={navigate}
      currentWorker={currentWorker}
      onLogout={logout}
    >
      {renderPage()}
    </Layout>
  )
}
