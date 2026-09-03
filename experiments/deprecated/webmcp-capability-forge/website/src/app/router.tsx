import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { HomePage } from '../pages/HomePage'
import { HowItWorksPage } from '../pages/HowItWorksPage'
import { InstallPage } from '../pages/InstallPage'
import { LabGuidePage } from '../pages/LabGuidePage'
import { WorkflowPage } from '../pages/WorkflowPage'
import { RouteResultPage } from '../pages/RouteResultPage'
import { EvidencePage } from '../pages/EvidencePage'
import { PrivacyPage } from '../pages/PrivacyPage'
import { SupportPage } from '../pages/SupportPage'
import { TermsPage } from '../pages/TermsPage'
import { SiteRoute } from './site-route'

export function WebsiteRouter() {
  return (
    <BrowserRouter>
      <SiteHeader />
      <Routes>
        <Route path={SiteRoute.Home} element={<HomePage />} />
        <Route path={SiteRoute.HowItWorks} element={<HowItWorksPage />} />
        <Route path={SiteRoute.Install} element={<InstallPage />} />
        <Route path={SiteRoute.LabGuide} element={<LabGuidePage />} />
        <Route path={SiteRoute.LabWorkflow} element={<WorkflowPage />} />
        <Route path={SiteRoute.LabResults} element={<RouteResultPage />} />
        <Route path={SiteRoute.LabEvidence} element={<EvidencePage />} />
        <Route path={SiteRoute.Privacy} element={<PrivacyPage />} />
        <Route path={SiteRoute.Terms} element={<TermsPage />} />
        <Route path={SiteRoute.Support} element={<SupportPage />} />
        <Route path="*" element={<Navigate to={SiteRoute.Home} replace />} />
      </Routes>
      <SiteFooter />
    </BrowserRouter>
  )
}
