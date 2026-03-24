import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useTheme } from './context/ThemeContext';
import UniverseBackground from './components/UniverseBackground';
import Home from './pages/Home';
import MusicStudio from './pages/MusicStudio';
import VideoSuite from './pages/VideoSuite';
import GranularEngine from './pages/GranularEngine';
import Marketplace from './pages/Marketplace';
import SampleUniverse from './pages/SampleUniverse';
import MixerPro from './pages/MixerPro';
import ModelLibrary from './pages/ModelLibrary';
import './App.css';

const NAV = [
  { to: '/', icon: '🏠', label: 'Home' },
  { to: '/studio', icon: '🎵', label: 'Music Studio' },
  { to: '/granular', icon: '🔬', label: 'Granular Engine' },
  { to: '/mixer', icon: '🎛️', label: 'Mixer Pro' },
  { to: '/video', icon: '🎬', label: 'Video Suite' },
  { to: '/samples', icon: '🪐', label: 'Sample Universe' },
  { to: '/marketplace', icon: '🛒', label: 'Marketplace' },
  { to: '/models', icon: '🤖', label: 'Model Library' },
];

export default function App() {
  const { accent } = useTheme();
  const location = useLocation();

  return (
    <div className="app" data-accent={accent}>
      <UniverseBackground />

      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">D</div>
          <div>
            <div className="brand-name">DIETER PRO</div>
            <div className="brand-sub">AI PRODUCTION SUITE</div>
          </div>
        </div>

        <div className="sidebar-nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="unlimited-badge">
            <span className="pulse-dot" />
            UNLIMITED ACCESS
          </div>
          <div className="version">v2.0.0</div>
        </div>
      </nav>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            {NAV.find((n) => n.to === location.pathname)?.label || 'DIETER PRO'}
          </div>
          <div className="topbar-actions">
            <div className="status-dot online" />
            <span className="status-label">Engine Ready</span>
          </div>
        </header>

        <div className="page-container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/studio" element={<MusicStudio />} />
            <Route path="/granular" element={<GranularEngine />} />
            <Route path="/mixer" element={<MixerPro />} />
            <Route path="/video" element={<VideoSuite />} />
            <Route path="/samples" element={<SampleUniverse />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/models" element={<ModelLibrary />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
