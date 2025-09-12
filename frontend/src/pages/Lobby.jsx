import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function Lobby() {
  const { id } = useParams();
  const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [name, setName] = useState(() => localStorage.getItem('vtt:name') || '');
  const socketRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function fetchCampaignById() {
      // Try direct endpoint; fallback to listing (compat with older API)
      const direct = await fetch(`${API}/campaigns/${id}`);
      if (direct.ok) return direct.json();
      const list = await fetch(`${API}/campaigns`);
      if (list.ok) {
        const arr = await list.json();
        return arr.find((c) => String(c.id) === String(id)) || null;
      }
      return null;
    }
    async function load() {
      try {
        setLoading(true);
        const [c, mRes] = await Promise.all([
          fetchCampaignById(),
          fetch(`${API}/lobbies/${id}/messages?limit=100`),
        ]);
        if (!c) throw new Error('Campanha não encontrada');
        const m = mRes.ok ? await mRes.json() : [];
        if (!mounted) return;
        setCampaign(c);
        setMessages(m);
        setError('');
      } catch (e) {
        if (!mounted) return;
        setError(e.message || 'Falha ao carregar lobby');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [API, id]);

  useEffect(() => {
    const s = io(API, { transports: ['websocket'], autoConnect: true });
    socketRef.current = s;
    s.on('connect', () => {
      s.emit('join', { campaignId: id, name: name || 'Anônimo' });
    });
    s.on('chat:new', (msg) => {
      if (String(msg.campaignId) !== String(id)) return;
      setMessages((arr) => [...arr, msg]);
    });
    s.on('campaign:updated', (c) => {
      if (String(c.id) === String(id)) setCampaign(c);
    });
    return () => { s.disconnect(); };
  }, [API, id, name]);

  const send = () => {
    if (!input.trim()) return;
    const s = socketRef.current;
    if (!s) return;
    s.emit('chat:send', { campaignId: id, author: name || 'Anônimo', text: input.trim() });
    setInput('');
  };

  const saveName = () => { localStorage.setItem('vtt:name', name || ''); };

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const [edit, setEdit] = useState(null);
  useEffect(() => { if (campaign) setEdit({ name: campaign.name || '', system: campaign.system || '', description: campaign.description || '', isPrivate: !!campaign.isPrivate }); }, [campaign]);

  const updateCampaign = async () => {
    if (!edit) return;
    try {
      const res = await fetch(`${API}/campaigns/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit)
      });
      if (!res.ok) throw new Error('Falha ao salvar campanha');
      // Socket server also broadcasts, but we update locally for responsiveness
      const next = await res.json();
      setCampaign(next);
      const s = socketRef.current; if (s) s.emit('campaign:update', { id, ...edit });
    } catch (e) { alert(e.message || 'Erro ao salvar'); }
  };

  if (loading) return <div className="layout"><div style={{ padding: 16 }}>Carregando lobby...</div></div>;
  if (error) return <div className="layout"><div style={{ padding: 16, color: 'salmon' }}>{error}</div></div>;
  if (!campaign) return null;

  return (
    <div className="layout" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: '100%' }}>
      <header className="site-header">
        <div className="brand">Lobby — {campaign.name}</div>
        <div className="header-actions" style={{ gap: 12 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            placeholder="Seu nome"
            aria-label="Seu nome no chat"
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)' }}
          />
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, padding: 16 }}>
        <section style={{ display: 'grid', gridTemplateRows: '1fr auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}>
          <div id="chat" style={{ overflowY: 'auto', padding: 12 }}>
            {messages.length === 0 ? (
              <div className="muted">Nenhuma mensagem ainda.</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} style={{ marginBottom: 8 }}>
                  <span className="muted small">[{new Date(m.ts).toLocaleTimeString()}]</span>{' '}
                  <strong>{m.author}:</strong> {m.text}
                </div>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Escreva uma mensagem e pressione Enter"
              rows={2}
              style={{ flex: 1, resize: 'none', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', padding: '8px 10px' }}
            />
            <button className="btn btn-primary" onClick={send}>Enviar</button>
          </div>
        </section>
        <aside className="form-card" style={{ alignSelf: 'start' }}>
          <h3>Configurações da campanha</h3>
          {edit && (
            <div className="campaign-form">
              <div className="field">
                <label htmlFor="name">Nome</label>
                <input id="name" value={edit.name} onChange={(e) => setEdit((v) => ({ ...v, name: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="system">Sistema</label>
                <input id="system" value={edit.system} onChange={(e) => setEdit((v) => ({ ...v, system: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="description">Descrição</label>
                <textarea id="description" rows={3} value={edit.description} onChange={(e) => setEdit((v) => ({ ...v, description: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="priv">Privacidade</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input id="priv" type="checkbox" checked={!!edit.isPrivate} onChange={(e) => setEdit((v) => ({ ...v, isPrivate: e.target.checked }))} />
                  <span className="muted small">Privada (apenas via convite)</span>
                </div>
              </div>
              <div className="actions-row">
                <button className="btn btn-primary" onClick={updateCampaign}>Salvar</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
