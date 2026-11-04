import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './theme/fonts.css';
import './theme/tokens.css';
import './theme/base.css';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('index.html must contain <div id="root">.');
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
