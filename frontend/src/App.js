import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { GiWizardFace, GiBroadsword } from 'react-icons/gi';
import { FiMoon, FiSun, FiMenu, FiX } from 'react-icons/fi';
import './App.css';
import Home from './pages/Home';
import MasterView from './pages/MasterView';
import PlayerView from './pages/PlayerView';
import Tabletop from './pages/Tabletop';
import Lobby from './pages/Lobby';

function App() {
  const getInitialTheme = () => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  };

  const [theme, setTheme] = useState(getInitialTheme);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <BrowserRouter>
      <div className="layout">
        <header className="site-header">
          <Link to="/" className="brand">ProjetoVTT</Link>
          <nav className="nav" aria-label="Navegação principal">
            <Link to="/mestre" className="nav-link" aria-label="Ir para visão do Mestre">
              <GiWizardFace className="icon" />
              Mestre
            </Link>
            <Link to="/jogador" className="nav-link" aria-label="Ir para visão do Jogador">
              <GiBroadsword className="icon" />
              Jogador
            </Link>
            {/* Tabletop removido do menu principal; aberto por campanha */}
          </nav>
          <div className="header-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              aria-pressed={theme === 'dark' ? 'true' : 'false'}
              title={theme === 'dark' ? 'Tema: Escuro' : 'Tema: Claro'}
            >
              {theme === 'dark' ? <FiSun /> : <FiMoon />}
            </button>
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-controls="mobile-nav"
              aria-expanded={menuOpen ? 'true' : 'false'}
            >
              {menuOpen ? <FiX /> : <FiMenu />}
            </button>
          </div>
        </header>

        {menuOpen && (
          <div className="backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
        )}
        <div
          className={`mobile-nav ${menuOpen ? 'open' : ''}`}
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
        >
          <nav className="mobile-nav-content" aria-label="Navegação principal móvel">
            <button
              type="button"
              className="close-btn"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
            >
              <FiX />
            </button>
            <Link to="/mestre" className="mobile-link" onClick={() => setMenuOpen(false)}>
              <GiWizardFace className="icon" /> Mestre
            </Link>
            <Link to="/jogador" className="mobile-link" onClick={() => setMenuOpen(false)}>
              <GiBroadsword className="icon" /> Jogador
            </Link>
            {/* Tabletop removido do menu mobile; aberto por campanha */}
          </nav>
        </div>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mestre" element={<MasterView />} />
          <Route path="/jogador" element={<PlayerView />} />
          <Route path="/campaigns/:id/lobby" element={<Lobby />} />
          <Route path="/campaigns/:id/tabletop" element={<Tabletop />} />
        </Routes>

        <footer className="site-footer">
          <p>© 2025 ProjetoVTT — Todos os direitos reservados</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;

