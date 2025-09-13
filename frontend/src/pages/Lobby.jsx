import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../AuthContext';

export default function Lobby() {
  const { id } = useParams();
  const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const { token, user } = useAuth() || {};

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [name, setName] = useState(() => localStorage.getItem('vtt:name') || '');
  const socketRef = useRef(null);

  const [pdfs, setPdfs] = useState([]);
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState({ pdf: false, image: false });
  const [viewer, setViewer] = useState({ type: null, url: null, open: false });
  const [viewerKey, setViewerKey] = useState(0); // used to trigger cross-fade when content changes
  const openViewer = (type, url) => {
    setViewerKey((k) => k + 1);
    setViewer({ type, url, open: true });
  };
  const closeViewer = () => {
    setViewer((v) => (v && v.url ? { ...v, open: false } : v));
    setTimeout(() => setViewer({ type: null, url: null, open: false }), 220);
  };

  // ESC to close and lock body scroll when modal open
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && viewer.open) closeViewer(); };
    document.addEventListener('keydown', onKey);
    if (viewer.open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [viewer.open]);

  useEffect(() => {
    let mounted = true;
    async function fetchCampaignById() {
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

  // Prefill nickname from authenticated user, if available
  useEffect(() => {
    if (user && user.name && !name) {
      setName(user.name);
      try { localStorage.setItem('vtt:name', user.name); } catch {}
    }
  }, [user, name]);

  // Load materials
  useEffect(() => {
    async function fetchPdfs() {
      try {
        const res = await fetch(`${API}/pdfs?campaignId=${id}`);
        if (res.ok) setPdfs(await res.json()); else setPdfs([]);
      } catch { setPdfs([]); }
    }
    async function fetchImages() {
      try {
        const res = await fetch(`${API}/images?campaignId=${id}`);
        if (res.ok) setImages(await res.json()); else setImages([]);
      } catch { setImages([]); }
    }
    fetchPdfs();
    fetchImages();
  }, [API, id]);

  // Socket
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

  const [edit, setEdit] = useState(null); // kept for compatibility; not used directly
  const updateCampaign = async () => {
    if (!campaign) return;
    try {
      const res = await fetch(`${API}/campaigns/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({
          name: campaign.name || '',
          system: campaign.system || '',
          description: campaign.description || '',
          isPrivate: !!campaign.isPrivate,
        })
      });
      if (!res.ok) throw new Error('Falha ao salvar campanha');
      const next = await res.json();
      setCampaign(next);
      const s = socketRef.current; if (s) s.emit('campaign:update', { id, ...next });
    } catch (e) { alert(e.message || 'Erro ao salvar'); }
  };

  const onUploadPdf = async (file) => {
    if (!file) return;
    try {
      setUploading((u) => ({ ...u, pdf: true }));
      const form = new FormData();
      form.append('file', file);
      form.append('campaignId', id);
      const res = await fetch(`${API}/pdfs`, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : undefined, body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha no upload do PDF');
      }
      const meta = await res.json();
      setPdfs((list) => [meta, ...list]);
    } catch (e) {
      alert(e.message || 'Erro no upload do PDF');
    } finally {
      setUploading((u) => ({ ...u, pdf: false }));
    }
  };

  const onUploadImage = async (file) => {
    if (!file) return;
    try {
      setUploading((u) => ({ ...u, image: true }));
      const form = new FormData();
      form.append('file', file);
      form.append('campaignId', id);
      const res = await fetch(`${API}/images`, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : undefined, body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha no upload da imagem');
      }
      const meta = await res.json();
      setImages((list) => [meta, ...list]);
    } catch (e) {
      alert(e.message || 'Erro no upload da imagem');
    } finally {
      setUploading((u) => ({ ...u, image: false }));
    }
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
        <section style={{ display: 'grid', gridTemplateRows: '1fr auto auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)' }}>
          <div id="chat" style={{ overflowY: 'auto', padding: 12 }}>
            {messages.length === 0 ? (
              <div className="muted">Nenhuma mensagem ainda.</div>
            ) : (
              messages.map((m) => (
                <div key={m.id} style={{ marginBottom: 8 }}>
                  <span className="muted small">[{new Date(m.ts).toLocaleString()}]</span>{' '}
                  <strong>{m.author}:</strong> {m.text}
                </div>
              ))
            )}
          </div>
          {viewer.url && (
            <div className={`modal-overlay ${viewer.open ? 'modal-show' : 'modal-hide'}`} onClick={closeViewer}>
              <div className={`modal-dialog ${viewer.open ? 'modal-show' : 'modal-hide'} ${viewer.type === 'pdf' ? 'modal-full' : ''}`} onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                  <strong>Visualização</strong>
                  <button className="btn btn-secondary" onClick={closeViewer}>Fechar</button>
                </div>
                <div className="modal-body">
                  <div key={viewerKey} className="modal-content cross-fade">
                    {viewer.type === 'pdf' ? (
                      <iframe title="PDF" src={`${API}${viewer.url}`} className="modal-iframe" />
                    ) : (
                      <div className="modal-img-wrap">
                        <img alt="imagem" src={`${API}${viewer.url}`} className="modal-img" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
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
          {campaign && (
            <div className="campaign-form">
              <div className="field">
                <label htmlFor="name">Nome</label>
                <input id="name" value={campaign.name} onChange={(e) => setCampaign((v) => ({ ...v, name: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="system">Sistema</label>
                <input id="system" value={campaign.system || ''} onChange={(e) => setCampaign((v) => ({ ...v, system: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="description">Descrição</label>
                <textarea id="description" rows={3} value={campaign.description || ''} onChange={(e) => setCampaign((v) => ({ ...v, description: e.target.value }))} />
              </div>
              <div className="field">
                <label htmlFor="priv">Privacidade</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input id="priv" type="checkbox" checked={!!campaign.isPrivate} onChange={(e) => setCampaign((v) => ({ ...v, isPrivate: e.target.checked }))} />
                  <span className="muted small">Privada (apenas via convite)</span>
                </div>
              </div>
              <div className="actions-row">
                <button className="btn btn-primary" onClick={() => setEdit(campaign) || updateCampaign()}>Salvar</button>
              </div>
            </div>
          )}
          <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
          <div className="field">
            <label>Materiais (PDF)</label>
            <div className="file-row">
              <label htmlFor="pdfUp" className="btn btn-secondary file-btn">Upload PDF</label>
              <input id="pdfUp" className="hidden-input" type="file" accept="application/pdf" onChange={(e) => onUploadPdf(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
              <span className="muted small">{uploading.pdf ? 'Enviando...' : ' '}</span>
            </div>
            <ul className="materials-list" style={{ marginTop: 8 }}>
              {pdfs.map((p) => (
                <li key={p.id}>
                  <span className="small">{p.originalName}</span>
                  <div className="actions-row" style={{ justifyContent: 'flex-end' }}>
                    <a className="btn btn-secondary btn-sm" href={`${API}${p.url}`} target="_blank" rel="noreferrer">Abrir</a>
                    <a className="btn btn-primary btn-sm" href={`${API}${p.url}`} download>Baixar</a>
                    <button className="btn btn-secondary btn-sm" onClick={() => openViewer('pdf', p.url)}>Visualizar</button>
                  </div>
                </li>
              ))}
              {pdfs.length === 0 && <li className="small muted">Nenhum PDF ainda.</li>}
            </ul>
          </div>
          <div className="field">
            <label>Imagens</label>
            <div className="file-row">
              <label htmlFor="imgUp" className="btn btn-secondary file-btn">Upload imagem</label>
              <input id="imgUp" className="hidden-input" type="file" accept="image/*" onChange={(e) => onUploadImage(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
              <span className="muted small">{uploading.image ? 'Enviando...' : ' '}</span>
            </div>
            <ul className="materials-list" style={{ marginTop: 8 }}>
              {images.map((im) => {
                const isCover = (campaign && (campaign.coverImageId === im.id || campaign.coverImageUrl === im.url));
                return (
                  <li key={im.id}>
                    <span className="small">{im.originalName}</span>
                    {isCover && <span className="tag tag--public" style={{ marginLeft: 8 }}>Capa</span>}
                    <div className="actions-row" style={{ justifyContent: 'flex-end' }}>
                      <a className="btn btn-secondary btn-sm" href={`${API}${im.url}`} target="_blank" rel="noreferrer">Abrir</a>
                      <a className="btn btn-primary btn-sm" href={`${API}${im.url}`} download>Baixar</a>
                      <button className="btn btn-secondary btn-sm" onClick={() => openViewer('image', im.url)}>Visualizar</button>
                      {!isCover && (
                        <button className="btn btn-primary btn-sm" onClick={async () => {
                          try {
                        const res = await fetch(`${API}/campaigns/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ coverImageId: im.id, coverImageUrl: im.url }) });
                            if (!res.ok) throw new Error('Falha ao definir capa');
                            const next = await res.json();
                            setCampaign(next);
                          } catch (e) { alert(e.message || 'Erro ao definir capa'); }
                        }}>Definir como capa</button>
                      )}
                    </div>
                  </li>
                );
              })}
              {images.length === 0 && <li className="small muted">Nenhuma imagem ainda.</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
