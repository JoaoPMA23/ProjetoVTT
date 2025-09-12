import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const emailOk = useMemo(() => /.+@.+\..+/.test(email), [email]);
  const passOk = password.length >= 6;

  const onSubmit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try { await login(email, password, remember); nav('/mestre'); } catch (e) { setErr(e.message || 'Falha no login'); } finally { setLoading(false); }
  };

  return (
    <div className="view-container" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <form onSubmit={onSubmit} className="form-card" style={{ width: 360 }}>
        <h3>Entrar</h3>
        <div className="field"><label htmlFor="email">Email</label><input id="email" value={email} onChange={(e)=>setEmail(e.target.value)} aria-invalid={!emailOk} /></div>
        <div className="field"><label htmlFor="pass">Senha</label><input id="pass" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} aria-invalid={!passOk} /></div>
        <div className="field"><label><input type="checkbox" checked={remember} onChange={(e)=>setRemember(e.target.checked)} /> Manter-me conectado</label></div>
        {err && <p className="error-text" role="alert">{err}</p>}
        <div className="actions-row">
          <button className="btn btn-primary" type="submit" disabled={loading || !emailOk || !passOk}>{loading ? 'Entrando...' : 'Entrar'}</button>
          <Link className="btn btn-secondary" to="/register">Cadastrar</Link>
        </div>
        <div className="actions-row"><Link className="small" to="/forgot">Esqueci minha senha</Link></div>
      </form>
    </div>
  );
}
