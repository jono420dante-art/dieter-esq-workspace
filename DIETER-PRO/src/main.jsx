import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { StudioProvider } from './context/StudioContext';
import { AudioEngineProvider } from './context/AudioEngineContext';
import { GranularProvider } from './context/GranularContext';
import { VideoProvider } from './context/VideoContext';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <StudioProvider>
          <AudioEngineProvider>
            <GranularProvider>
              <VideoProvider>
                <App />
              </VideoProvider>
            </GranularProvider>
          </AudioEngineProvider>
        </StudioProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
