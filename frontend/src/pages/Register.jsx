import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const emailOk = useMemo(() => /.+@.+\..+/.test(email), [email]);
  const nameOk = name.trim().length >= 2;
  const passOk = password.length >= 6;

  const onSubmit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try { await register(name, email, password); nav('/mestre'); } catch (e) { setErr(e.message || 'Falha no cadastro'); } finally { setLoading(false); }
  };

  return (
    <div className="view-container" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <form onSubmit={onSubmit} className="form-card" style={{ width: 360 }}>
        <h3>Cadastrar</h3>
        <div className="field"><label htmlFor="name">Nome</label><input id="name" value={name} onChange={(e)=>setName(e.target.value)} aria-invalid={!nameOk} /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" value={email} onChange={(e)=>setEmail(e.target.value)} aria-invalid={!emailOk} /></div>
        <div className="field"><label htmlFor="pass">Senha</label><input id="pass" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} aria-invalid={!passOk} /></div>
        {err && <p className="error-text" role="alert">{err}</p>}
        <div className="actions-row">
          <button className="btn btn-primary" type="submit" disabled={loading || !nameOk || !emailOk || !passOk}>{loading ? 'Cadastrando...' : 'Cadastrar'}</button>
          <Link className="btn btn-secondary" to="/login">Entrar</Link>
        </div>
      </form>
    </div>
  );
}
