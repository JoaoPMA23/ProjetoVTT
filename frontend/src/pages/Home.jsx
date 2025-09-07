import React from 'react';
import { Link } from 'react-router-dom';
import { GiWizardFace, GiBroadsword } from 'react-icons/gi';

function Home() {
  return (
    <main className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>ProjetoVTT</h1>
          <p>Gerencie suas aventuras de RPG de mesa com fluidez, mapas interativos e ferramentas para Mestres e Jogadores.</p>
          <div className="cta-group">
            <Link className="btn btn-primary" to="/mestre">
              <GiWizardFace className="icon" />
              Visão do Mestre
            </Link>
            <Link className="btn btn-secondary" to="/jogador">
              <GiBroadsword className="icon" />
              Visão do Jogador
            </Link>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="feature-card">
          <h3>Mapas Interativos</h3>
          <p>Crie, edite e compartilhe mapas táticos com sua mesa.</p>
        </div>
        <div className="feature-card">
          <h3>Personagens</h3>
          <p>Crie fichas, gerencie atributos e acompanhe o progresso.</p>
        </div>
        <div className="feature-card">
          <h3>Campanhas</h3>
          <p>Organize sessões, registre anotações e compartilhe recursos.</p>
        </div>
      </section>
    </main>
  );
}

export default Home;
