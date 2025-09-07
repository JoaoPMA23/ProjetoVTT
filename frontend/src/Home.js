import React, { useState } from 'react';

function Home() {
  const [message, setMessage] = useState('');

  const handleStart = () => {
    setMessage('Carregando mesa virtual...');
  };

  const handleAbout = () => {
    setMessage('ProjetoVTT — gerencie aventuras com facilidade.');
  };


import React from 'react';

function Home() {
  return (
    <div className="home">
      <header className="home-header">
        <h1>ProjetoVTT</h1>
        <p>Gerencie suas aventuras de RPG de mesa</p>
        <div className="actions">
          <button onClick={handleStart}>Começar</button>
          <button onClick={handleAbout}>Sobre</button>
        </div>
        {message && <p className="message">{message}</p>}

        <button>Começar</button>
      </header>
    </div>
  );
}

export default Home;
