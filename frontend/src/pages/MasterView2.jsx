import React, { useEffect, useState } from 'react';
import { FiMessageCircle, FiMap, FiLock, FiGlobe, FiFileText, FiImage, FiType, FiBookOpen, FiPlusCircle, FiList } from 'react-icons/fi';

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

  async function fetchCampaigns() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(API + '/campaigns');
      if (!res.ok) throw new Error('Falha ao carregar campanhas');
      const data = await res.json();
      setCampaigns(data);
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'Não foi possível conectar à API. Verifique se o servidor está rodando.' : (e.message || 'Erro ao carregar'));
    } finally {
      setLoading(false);
    }
  }

  async function fetchPdfs() {
    try {
      const res = await fetch(API + '/pdfs');
      if (!res.ok) throw new Error('Falha ao carregar PDFs');
      const data = await res.json();
      setPdfs(data);
    } catch (e) {
      setUploadError(e.message || 'Erro ao carregar PDFs');
    }
  }

  async function fetchImages() {
    try {
      const res = await fetch(API + '/images');
      if (!res.ok) throw new Error('Falha ao carregar imagens');
      const data = await res.json();
      setImages(data);
    } catch (e) {
      setUploadError(e.message || 'Erro ao carregar imagens');
    }
  }

  useEffect(() => { fetchCampaigns(); fetchPdfs(); fetchImages(); }, []);

  async function onSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Informe um nome para a campanha.');
    try {
      setSaving(true);
      setError('');
      setUploadError('');
      const res = await fetch(API + '/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          const up = await fetch(API + '/pdfs', { method: 'POST', body: form });
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
          const ui = await fetch(API + '/images', { method: 'POST', body: formImg });
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
  const [view, setView] = useState('choose'); // 'choose' | 'create' | 'list'

  const CreateForm = (
    <section className="form-card" aria-labelledby="form-title">
      <h3 id="form-title">Nova campanha</h3>
          <form onSubmit={onSubmit} className="campaign-form">
            <div className="field">
              <label htmlFor="name"><FiType style={{ marginRight: 6 }} />Nome</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: A Maldição de Strahd" />
            </div>
            <div className="field">
              <label htmlFor="system"><FiBookOpen style={{ marginRight: 6 }} />Sistema</label>
              <input id="system" value={system} onChange={(e) => setSystem(e.target.value)} placeholder="Ex.: D&D 5e, Tormenta, etc." />
            </div>
            <div className="field">
              <label htmlFor="description"><FiType style={{ marginRight: 6 }} />Descrição</label>
              <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Resumo da campanha" />
            </div>
            <div className="field">
              <label htmlFor="private">{isPrivate ? <FiLock style={{ marginRight: 6 }} /> : <FiGlobe style={{ marginRight: 6 }} />}Privacidade</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input id="private" type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
                <span className="muted small">Marque para tornar a campanha privada (somente por convite)</span>
              </div>
            </div>
            <div className="field">
              <label><FiFileText style={{ marginRight: 6 }} />Material (PDF) opcional</label>
              <div className="file-row">
                <label htmlFor="pdf" className="btn btn-secondary file-btn">Escolher PDF</label>
                <span className="muted small file-name">{pdfFile ? pdfFile.name : 'Nenhum arquivo selecionado'}</span>
                <input id="pdf" className="hidden-input" type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
              </div>
            </div>
            <div className="field">
              <label><FiImage style={{ marginRight: 6 }} />Capa (imagem) opcional</label>
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
  );

  const ListPanel = (
    <div className="panel-card" aria-labelledby="list-title">
      <h3 id="list-title">Campanhas</h3>
      {loading ? (
        <p className="muted">Carregando...</p>
      ) : campaigns.length === 0 ? (
        <p className="muted">Nenhuma campanha cadastrada ainda.</p>
      ) : (
        <ul className="campaign-menu" role="list">
          {campaigns.map((c) => {
            const mats = materialsFor(c.id);
            const cover = coverFor(c.id);
            return (
              <li key={c.id} className="campaign-menu-item">
                <a className="menu-item-main-link" href={`/campaigns/${c.id}/lobby`}>
                  <div className="menu-item-main">
                    <div className="avatar-sm" aria-hidden>{initials(c.name)}</div>
                    <div className="menu-item-text">
                      <div className="menu-title">
                        <strong>{c.name}</strong>
                        {c.system && <span className="tag tag--alt">{c.system}</span>}
                        {c.isPrivate ? (
                          <span className="tag tag--private" title="Campanha privada"><FiLock style={{ marginRight: 4 }} />Privada</span>
                        ) : (
                          <span className="tag tag--public" title="Campanha pública"><FiGlobe style={{ marginRight: 4 }} />Pública</span>
                        )}
                      </div>
                      <span className="muted small">Criada em {new Date(c.createdAt).toLocaleString()}</span>
                      {cover && <span className="small muted">Capa adicionada</span>}
                      {mats.length > 0 && <span className="small muted"> • Materiais: {mats.length}</span>}
                    </div>
                  </div>
                </a>
                <div className="menu-item-actions">
                  <a className="btn btn-secondary btn-sm btn-pill" href={`/campaigns/${c.id}/lobby`}>
                    <FiMessageCircle style={{ marginRight: 6 }} /> Lobby
                  </a>
                  <a className="btn btn-primary btn-sm btn-pill" href={`/campaigns/${c.id}/tabletop`}>
                    <FiMap style={{ marginRight: 6 }} /> Mesa
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const Tabs = (
    <div className="tab-strip">
      <button type="button" className={`tab ${view === 'create' ? 'tab-active' : ''}`} onClick={() => setView('create')}><FiPlusCircle style={{ marginRight: 6 }} /> Nova campanha</button>
      <button type="button" className={`tab ${view === 'list' ? 'tab-active' : ''}`} onClick={() => setView('list')}><FiList style={{ marginRight: 6 }} /> Campanhas</button>
    </div>
  );

  if (view === 'choose') {
    return (
      <div className="view-container container mx-auto px-4 lg:px-8">
        <h2 className="text-xl font-semibold">Mestre</h2>
        <p className="text-[var(--muted)]">Escolha uma opção para começar.</p>
        <div className="choice-grid">
          <button type="button" className="choice-card" onClick={() => setView('create')}>
            <FiPlusCircle className="choice-icon" />
            <div className="choice-title">Nova campanha</div>
            <div className="choice-desc">Crie uma nova campanha e defina sistema, descrição e privacidade.</div>
          </button>
          <button type="button" className="choice-card" onClick={() => setView('list')}>
            <FiList className="choice-icon" />
            <div className="choice-title">Campanhas</div>
            <div className="choice-desc">Veja e acesse suas campanhas existentes, lobby e mesa.</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-container container mx-auto px-4 lg:px-8 space-y-3">
      <h2 className="text-xl font-semibold">Mestre</h2>
      {Tabs}
      {view === 'create' ? CreateForm : ListPanel}
    </div>
  );
}

export default MasterView;
