import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Forgot() {
  const { forgot } = useAuth();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const valid = /.+@.+\..+/.test(email);

  const onSubmit = async (e) => {
    e.preventDefault(); setErr(''); setMsg(''); setLoading(true);
    try { await forgot(email); setMsg('Se o email existir, você receberá instruções.'); }
    catch (e) { setErr(e.message || 'Falha ao enviar'); }
    finally { setLoading(false); }
  };

  return (
    <div className="view-container" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <form onSubmit={onSubmit} className="form-card" style={{ width: 360 }}>
        <h3>Esqueci minha senha</h3>
        <div className="field"><label htmlFor="email">Email</label><input id="email" value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
        {msg && <p className="small" style={{ color: '#34d399' }}>{msg}</p>}
        {err && <p className="error-text" role="alert">{err}</p>}
        <div className="actions-row">
          <button className="btn btn-primary" type="submit" disabled={!valid || loading}>{loading ? 'Enviando...' : 'Enviar link'}</button>
          <Link className="btn btn-secondary" to="/login">Voltar</Link>
        </div>
      </form>
    </div>
  );
}

