import React from 'react'
import ProvidersPage from './pages/Providers'
import ProjectsPage from './pages/Projects'
import ProjectFilesPage from './pages/ProjectFiles'
import { HashRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import FileUnitsPage from './pages/FileUnits'
import Layout from './components/Layout'
import JobsPage from './pages/Jobs'

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id/files" element={<ProjectFilesPage />} />
          <Route path="/files/:fileId/units" element={<FileUnitsPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/jobs" element={<JobsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
