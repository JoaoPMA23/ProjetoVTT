import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('vtt:token') || '');
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('vtt:user');
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => { token ? localStorage.setItem('vtt:token', token) : localStorage.removeItem('vtt:token'); }, [token]);
  useEffect(() => { user ? localStorage.setItem('vtt:user', JSON.stringify(user)) : localStorage.removeItem('vtt:user'); }, [user]);

  const login = async (email, password) => {
    const res = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || 'Falha no login');
    const data = await res.json();
    setToken(data.token || '');
    setUser(data.user || null);
  };

  const register = async (name, email, password) => {
    const res = await fetch(API + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
    if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || 'Falha no cadastro');
    const data = await res.json();
    setToken(data.token || '');
    setUser(data.user || null);
  };

  const logout = () => { setToken(''); setUser(null); };

  const forgot = async (email) => {
    const res = await fetch(API + '/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || 'Falha ao enviar reset');
    return true;
  };

  const reset = async (tokenStr, password) => {
    const res = await fetch(API + '/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tokenStr, password }) });
    if (!res.ok) throw new Error((await res.json().catch(()=>({}))).error || 'Falha ao redefinir');
    const data = await res.json();
    setToken(data.token || '');
    setUser(data.user || null);
  };

  return (
    <AuthCtx.Provider value={{ token, user, login, register, logout, forgot, reset }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() { return useContext(AuthCtx) || { token: '', user: null, login: async()=>{}, register: async()=>{}, logout: ()=>{} }; }
