import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { SidePanelApp } from './SidePanelApp'
const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <StrictMode>
      <SidePanelApp />
    </StrictMode>,
  )
}
