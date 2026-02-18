import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';
import './styles/toast.css';

const isLegacyQuillWarning = (args) => {
  return args && args.length > 0 && typeof args[0] === 'string' &&
    args[0].includes('findDOMNode is deprecated');
};

const originalConsoleError = console.error;
console.error = (...args) => {
  if (isLegacyQuillWarning(args)) return;
  originalConsoleError(...args);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

