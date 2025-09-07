import React from 'react';
import './App.css'; // Arquivo de estilo dedicado

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Tabletop RPG App</h1>
        <p>Transforme suas campanhas de RPG com mapas interativos, criação de personagens e muito mais!</p>
        <button className="cta-button">Criar Nova Campanha</button>
      </header>

      <section className="features">
        <h2>Funcionalidades</h2>
        <div className="feature-item">
          <h3>Criação e Gestão de Campanhas</h3>
          <p>Organize suas campanhas com facilidade e acompanhe o progresso em tempo real.</p>
        </div>
        <div className="feature-item">
          <h3>Mapas Interativos</h3>
          <p>Edite e posicione personagens diretamente sobre mapas personalizados.</p>
        </div>
        <div className="feature-item">
          <h3>Criação de Personagens</h3>
          <p>Defina atributos, habilidades e mais para criar personagens únicos.</p>
        </div>
      </section>

      <footer className="App-footer">
        <p>© 2025 Tabletop RPG App - Todos os direitos reservados</p>
        <div className="social-links">
          <a href="#">Facebook</a>
          <a href="#">Instagram</a>
          <a href="#">Twitter</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
