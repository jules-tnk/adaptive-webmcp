import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { WebsiteRouter } from './app/router'
import './styles.css'

const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <StrictMode>
      <WebsiteRouter />
    </StrictMode>,
  )
}
