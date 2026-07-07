// index.js
// Entry point padrão de Create React App / Vite. Não executado nesta fase
// (sem package.json instalado/build configurado) — incluído apenas para
// deixar o scaffold coerente com um projeto React real.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
