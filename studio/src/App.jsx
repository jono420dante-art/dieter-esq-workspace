import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar'
import Footer from './components/Footer'

const Home = lazy(() => import('./pages/Home'))
const Generate = lazy(() => import('./pages/Generate'))
const Release = lazy(() => import('./pages/Release'))
const Status = lazy(() => import('./pages/Status'))

function RouteFallback() {
  return (
    <div
      style={{
        padding: '3rem 1.25rem',
        textAlign: 'center',
        color: 'var(--muted)',
      }}
    >
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/generate" element={<Generate />} />
          <Route path="/release" element={<Release />} />
          <Route path="/status" element={<Status />} />
        </Routes>
      </Suspense>
      <Footer />
    </BrowserRouter>
  )
}
