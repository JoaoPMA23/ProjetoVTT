import React, { useMemo, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Reset() {
  const { reset } = useAuth();
  const q = useQuery();
  const token = q.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const valid = password.length >= 6 && password === confirm && token;

  const onSubmit = async (e) => {
    e.preventDefault(); setErr(''); setOk(''); setLoading(true);
    try { await reset(token, password); setOk('Senha redefinida com sucesso!'); setTimeout(()=>nav('/mestre'), 600); }
    catch (e) { setErr(e.message || 'Falha ao redefinir'); }
    finally { setLoading(false); }
  };

  return (
    <div className="view-container" style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      <form onSubmit={onSubmit} className="form-card" style={{ width: 360 }}>
        <h3>Redefinir senha</h3>
        <div className="field"><label htmlFor="pass">Nova senha</label><input id="pass" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
        <div className="field"><label htmlFor="conf">Confirmar</label><input id="conf" type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} /></div>
        {ok && <p className="small" style={{ color: '#34d399' }}>{ok}</p>}
        {err && <p className="error-text" role="alert">{err}</p>}
        <div className="actions-row">
          <button className="btn btn-primary" type="submit" disabled={!valid || loading}>{loading ? 'Salvando...' : 'Redefinir'}</button>
          <Link className="btn btn-secondary" to="/login">Cancelar</Link>
        </div>
      </form>
    </div>
  );
}

