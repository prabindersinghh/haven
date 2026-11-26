import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/baloo-2';
import '@fontsource-variable/baloo-paaji-2';
import '@fontsource/mukta/400.css';
import '@fontsource/mukta/500.css';
import '@fontsource/mukta/600.css';
import '@fontsource/mukta/700.css';
import '@fontsource/mukta-mahee/400.css';
import '@fontsource/mukta-mahee/600.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
