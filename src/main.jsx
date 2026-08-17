// Import React library.
import React from 'react';
// Import ReactDOM client library for mounting in React 18+.
import ReactDOM from 'react-dom/client';
// Import root application component.
import App from './App';
// Import master design system stylesheet.
import './index.css';

// Mount React application into the root DOM element.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
