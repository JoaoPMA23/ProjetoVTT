import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthContext';

function MasterView() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [system, setSystem] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [pdfs, setPdfs] = useState([]);
  const [images, setImages] = useState([]);
  const [uploadError, setUploadError] = useState('');

  const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';
  const { token, user } = useAuth() || {};
  const authHeaders = token ? { Authorization: 'Bearer ' + token } : {};

  async function fetchCampaigns() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(API + '/campaigns', { headers: authHeaders });
      if (!res.ok) throw new Error('Falha ao carregar campanhas');
      const data = await res.json();
      const mine = (user && user.id) ? data.filter((c) => c.createdBy === user.id) : [];
      setCampaigns(mine);
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'Não foi possível conectar à API. Verifique se o servidor está rodando.' : (e.message || 'Erro ao carregar'));
    } finally {
      setLoading(false);
    }
  }

  async function fetchPdfs() {
    try {
      const res = await fetch(API + '/pdfs', { headers: authHeaders });
      if (!res.ok) throw new Error('Falha ao carregar PDFs');
      const data = await res.json();
      setPdfs(data);
    } catch (e) {
      setUploadError(e.message || 'Erro ao carregar PDFs');
    }
  }

  async function fetchImages() {
    try {
      const res = await fetch(API + '/images', { headers: authHeaders });
      if (!res.ok) throw new Error('Falha ao carregar imagens');
      const data = await res.json();
      setImages(data);
    } catch (e) {
      setUploadError(e.message || 'Erro ao carregar imagens');
    }
  }

  useEffect(() => { fetchCampaigns(); fetchPdfs(); fetchImages(); }, [token, user && user.id]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Informe um nome para a campanha.');
    try {
      setSaving(true);
      setError('');
      setUploadError('');
      const res = await fetch(API + '/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ name, system, description, isPrivate })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Não foi possível salvar a campanha');
      }
      const created = await res.json();
      setCampaigns((list) => [created, ...list]);

      if (pdfFile) {
        try {
          const form = new FormData();
          form.append('file', pdfFile);
          form.append('campaignId', created.id);
          const up = await fetch(API + '/pdfs', { method: 'POST', headers: authHeaders, body: form });
          if (up.ok) {
            const meta = await up.json();
            setPdfs((list) => [meta, ...list]);
          } else {
            const err = await up.json().catch(() => ({}));
            setUploadError(err.error || 'Falha no upload do PDF');
          }
        } catch (e) {
          setUploadError(e.message || 'Erro no upload');
        }
      }

      if (imageFile) {
        try {
          const formImg = new FormData();
          formImg.append('file', imageFile);
          formImg.append('campaignId', created.id);
          const ui = await fetch(API + '/images', { method: 'POST', headers: authHeaders, body: formImg });
          if (ui.ok) {
            const metaImg = await ui.json();
            setImages((list) => [metaImg, ...list]);
          } else {
            const errI = await ui.json().catch(() => ({}));
            setUploadError(errI.error || 'Falha no upload da imagem');
          }
        } catch (e) { setUploadError(e.message || 'Erro no upload da imagem'); }
      }

      setName(''); setSystem(''); setDescription(''); setIsPrivate(false); setPdfFile(null); setImageFile(null);
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'Não foi possível conectar à API. Verifique se o servidor está rodando.' : (e.message || 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  }

  const materialsFor = (id) => pdfs.filter((p) => p.campaignId === id);
  const coverFor = (id) => { const item = images.find((i) => i.campaignId === id); return item ? (API + item.url) : null; };
  const initials = (s) => (s || '?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();

  // Horizontal drag-to-scroll + nav arrows + pager
  const scrollRef = useRef(null);
  const drag = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  const updateArrows = () => {
    const el = scrollRef.current; if (!el) return;
    setCanLeft(el.scrollLeft > 0);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    let gap = 16; try { const st = getComputedStyle(el); const g = parseInt(st.columnGap || st.gap || '16', 10); if (!isNaN(g)) gap = g; } catch {}
    const first = el.querySelector('.campaign-card');
    const w = first ? first.clientWidth + gap : el.clientWidth;
    const idx = Math.round(el.scrollLeft / Math.max(1, w));
    setPageIndex(idx);
  };

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    updateArrows();
    const onScroll = () => updateArrows();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => { el.removeEventListener('scroll', onScroll); window.removeEventListener('resize', updateArrows); };
  }, [campaigns.length]);

  const onMouseDown = (e) => { if (!scrollRef.current) return; drag.current = { isDown: true, startX: e.pageX, scrollLeft: scrollRef.current.scrollLeft }; scrollRef.current.classList.add('dragging'); };
  const endDrag = () => { if (!scrollRef.current) return; drag.current.isDown = false; scrollRef.current.classList.remove('dragging'); };
  const onMouseMove = (e) => { if (!scrollRef.current) return; if (!drag.current.isDown) return; const dx = e.pageX - drag.current.startX; scrollRef.current.scrollLeft = drag.current.scrollLeft - dx; };
  const onTouchStart = (e) => { if (!scrollRef.current) return; const t = e.touches[0]; drag.current = { isDown: true, startX: t.pageX, scrollLeft: scrollRef.current.scrollLeft }; };
  const onTouchMove = (e) => { if (!scrollRef.current) return; if (!drag.current.isDown) return; const t = e.touches[0]; const dx = t.pageX - drag.current.startX; scrollRef.current.scrollLeft = drag.current.scrollLeft - dx; };
  const onTouchEnd = () => { drag.current.isDown = false; };

  const scrollByTile = (dir) => {
    const el = scrollRef.current; if (!el) return;
    const first = el.querySelector('.campaign-card');
    let gap = 16; try { const st = getComputedStyle(el); const g = parseInt(st.columnGap || st.gap || '16', 10); if (!isNaN(g)) gap = g; } catch {}
    const w = first ? first.clientWidth : Math.round(el.clientWidth * 0.8);
    el.scrollBy({ left: dir * (w + gap), behavior: 'smooth' });
  };

  const scrollToIndex = (i) => {
    const el = scrollRef.current; if (!el) return;
    const first = el.querySelector('.campaign-card');
    let gap = 16; try { const st = getComputedStyle(el); const g = parseInt(st.columnGap || st.gap || '16', 10); if (!isNaN(g)) gap = g; } catch {}
    const w = first ? first.clientWidth : Math.round(el.clientWidth * 0.8);
    el.scrollTo({ left: i * (w + gap), behavior: 'smooth' });
  };

  return (
    <div className="view-container">
      <h2>Mestre</h2>
      <p>Cadastre e gerencie suas campanhas.</p>

      <section className="form-card" aria-labelledby="form-title">
        <h3 id="form-title">Nova campanha</h3>
        <form onSubmit={onSubmit} className="campaign-form">
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: A Maldição de Strahd" />
          </div>
          <div className="field">
            <label htmlFor="system">Sistema</label>
            <input id="system" value={system} onChange={(e) => setSystem(e.target.value)} placeholder="Ex.: D&D 5e, Tormenta, etc." />
          </div>
          <div className="field">
            <label htmlFor="description">Descrição</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Resumo da campanha" />
          </div>
          <div className="field">
            <label htmlFor="private">Privacidade</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input id="private" type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              <span className="muted small">Marque para tornar a campanha privada (somente por convite)</span>
            </div>
          </div>
          <div className="field">
            <label>Material (PDF) opcional</label>
            <div className="file-row">
              <label htmlFor="pdf" className="btn btn-secondary file-btn">Escolher PDF</label>
              <span className="muted small file-name">{pdfFile ? pdfFile.name : 'Nenhum arquivo selecionado'}</span>
              <input id="pdf" className="hidden-input" type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
            </div>
          </div>
          <div className="field">
            <label>Capa (imagem) opcional</label>
            <div className="file-row">
              <label htmlFor="image" className="btn btn-secondary file-btn">Escolher imagem</label>
              <span className="muted small file-name">{imageFile ? imageFile.name : 'Nenhuma imagem selecionada'}</span>
              <input id="image" className="hidden-input" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
            </div>
          </div>
          <div className="actions-row">
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar'}</button>
          </div>
        </form>
        {error && <p className="error-text" role="alert">{error}</p>}
        {uploadError && <p className="error-text" role="alert">{uploadError}</p>}
      </section>

      <section style={{ marginTop: 24 }} aria-labelledby="list-title">
        <h3 id="list-title">Campanhas</h3>
        {loading ? (
          <p>Carregando...</p>
        ) : campaigns.length === 0 ? (
          <p>Nenhuma campanha cadastrada ainda.</p>
        ) : (
          <div className="carousel-wrap">
            <button type="button" className="nav-btn prev" disabled={!canLeft} onClick={() => scrollByTile(-1)} aria-label="Anterior"></button>
            <div
              className="campaigns-scroller"
              ref={scrollRef}
              onMouseDown={onMouseDown}
              onMouseLeave={endDrag}
              onMouseUp={endDrag}
              onMouseMove={onMouseMove}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {campaigns.map((c) => {
                const mats = materialsFor(c.id);
                const cover = coverFor(c.id);
                return (
                  <article key={c.id} className="campaign-card campaign-card--tile" style={cover ? { backgroundImage: 'url(' + cover + ')' } : {}}>
                    <div className="tile-overlay">
                      <header className="card-head">
                        <div className="title">
                          <div className="avatar" aria-hidden>{initials(c.name)}</div>
                          <div className="title-block">
                            <div className="name-row">
                              <strong>{c.name}</strong>
                              {c.system && <span className="tag">{c.system}</span>}
                              {c.isPrivate ? (
                                <span className="tag" title="Campanha privada">Privada</span>
                              ) : (
                                <span className="tag" title="Campanha pública">Pública</span>
                              )}
                            </div>
                            <span className="muted small">Criada em {new Date(c.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </header>
                      {c.description && <p className="muted clamp-2 tile-desc">{c.description}</p>}
                      {mats.length > 0 && (
                        <div className="materials" aria-label="Materiais da campanha">
                          <span className="muted small">Materiais: {mats.length}</span>
                        </div>
                      )}
                      <div className="actions-row" style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <a className="btn btn-secondary" href={`/campaigns/${c.id}/lobby`}>
                          Abrir lobby
                        </a>
                        <a className="btn btn-primary" href={`/campaigns/${c.id}/tabletop`}>
                          Abrir mesa
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <button type="button" className="nav-btn next" disabled={!canRight} onClick={() => scrollByTile(1)} aria-label="Próximo"></button>
            <div className="carousel-pager">
              <div className="dots">
                {campaigns.map((_, i) => (
                  <button key={i} type="button" className={`dot ${pageIndex === i ? 'active' : ''}`} onClick={() => scrollToIndex(i)} aria-label={`Ir para card ${i + 1}`}></button>
                ))}
              </div>
              <span className="count small">{pageIndex + 1} / {campaigns.length}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default MasterView;
