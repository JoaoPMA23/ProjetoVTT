import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Tabletop.css";

function useRaf(callback) {
  const cb = useRef(callback);
  useEffect(() => {
    cb.current = callback;
  }, [callback]);
  useEffect(() => {
    let rafId;
    const loop = () => {
      cb.current();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);
}

export default function Tabletop() {
  // Canvas/state
  const canvasRef = useRef(null);
  const [gridSize, setGridSize] = useState(64);
  const [showGrid, setShowGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mapSrc, setMapSrc] = useState(null);
  const [mapDim, setMapDim] = useState({ w: 0, h: 0 });
  const [tokens, setTokens] = useState([]); // {id, name, src, w, h, x, y}
  const [selectedId, setSelectedId] = useState(null);
  const idCounter = useRef(1);

  // Interaction state
  const dragging = useRef({
    mode: null,
    id: null,
    offsetX: 0,
    offsetY: 0,
    lastX: 0,
    lastY: 0,
  });
  const measure = useRef({ active: false, start: null, end: null });

  // Dice roller
  const [diceRoll, setDiceRoll] = useState(null);
  const roll = (sides) =>
    setDiceRoll({ sides, v: 1 + Math.floor(Math.random() * sides) });

  // Load map
  const onLoadMap = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setMapDim({ w: img.width, h: img.height });
      setMapSrc(url);
      // center map
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = url;
  };

  // Add token
  const onAddToken = (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const id = idCounter.current++;
      const defaultCells = 1; // 1x1 cell token
      const w = gridSize * defaultCells;
      const h = (img.height / img.width) * w;
      const center = viewToWorld({
        x: canvasRef.current.width / 2,
        y: canvasRef.current.height / 2,
      });
      const newT = {
        id,
        name: `Token ${id}`,
        src: url,
        w,
        h,
        x: center.x - w / 2,
        y: center.y - h / 2,
      };
      setTokens((t) => [...t, newT]);
      setSelectedId(id);
    };
    img.src = url;
  };

  // Export / Import
  const exportScene = () => {
    const data = { gridSize, showGrid, snap, zoom, pan, mapSrc, mapDim, tokens };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scene-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importScene = (file) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(fr.result);
        setGridSize(data.gridSize ?? 64);
        setShowGrid(!!data.showGrid);
        setSnap(!!data.snap);
        setZoom(data.zoom ?? 1);
        setPan(data.pan ?? { x: 0, y: 0 });
        setMapSrc(data.mapSrc ?? null);
        setMapDim(data.mapDim ?? { w: 0, h: 0 });
        setTokens(Array.isArray(data.tokens) ? data.tokens : []);
        setSelectedId(null);
      } catch (e) {
        alert("Arquivo de cena inválido");
      }
    };
    fr.readAsText(file);
  };

  // Helpers: coords transforms
  const worldToView = (p) => ({
    x: (p.x + pan.x) * zoom,
    y: (p.y + pan.y) * zoom,
  });
  const viewToWorld = (p) => ({
    x: p.x / zoom - pan.x,
    y: p.y / zoom - pan.y,
  });

  const getCanvas = () => {
    const c = canvasRef.current;
    if (!c) return null;
    // handle DPR for crispness
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (
      c.width !== Math.floor(rect.width * dpr) ||
      c.height !== Math.floor(rect.height * dpr)
    ) {
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
    }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // normalize to CSS pixels
    return { c, ctx };
  };

  const pointerInToken = (pt, t) => {
    // simple bounding box hit test in WORLD coords
    return (
      pt.x >= t.x &&
      pt.x <= t.x + t.w &&
      pt.y >= t.y &&
      pt.y <= t.y + t.h
    );
  };

  // Rendering
  useRaf(() => {
    const env = getCanvas();
    if (!env) return;
    const { c, ctx } = env;
    // background
    ctx.clearRect(0, 0, c.width, c.height);

    // draw map
    if (mapSrc && mapDim.w > 0) {
      const img = new Image();
      img.src = mapSrc;
      const topLeft = worldToView({ x: 0, y: 0 });
      const br = worldToView({ x: mapDim.w, y: mapDim.h });
      const w = br.x - topLeft.x;
      const h = br.y - topLeft.y;
      ctx.globalAlpha = 1;
      ctx.drawImage(img, topLeft.x, topLeft.y, w, h);
    }

    // grid
    if (showGrid && gridSize > 6) {
      const cols = Math.ceil((canvasRef.current.width / zoom) / gridSize) + 2;
      const rows = Math.ceil((canvasRef.current.height / zoom) / gridSize) + 2;
      // top-left world cell origin
      const startWorld = viewToWorld({ x: 0, y: 0 });
      const startCol = Math.floor(startWorld.x / gridSize) - 1;
      const startRow = Math.floor(startWorld.y / gridSize) - 1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      for (let i = 0; i < cols; i++) {
        const x = (startCol + i) * gridSize;
        const v1 = worldToView({ x, y: startRow * gridSize });
        const v2 = worldToView({ x, y: (startRow + rows) * gridSize });
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.stroke();
      }
      for (let j = 0; j < rows; j++) {
        const y = (startRow + j) * gridSize;
        const v1 = worldToView({ x: startCol * gridSize, y });
        const v2 = worldToView({ x: (startCol + cols) * gridSize, y });
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.stroke();
      }
    }

    // tokens
    tokens.forEach((t) => {
      const img = new Image();
      img.src = t.src;
      const p = worldToView({ x: t.x, y: t.y });
      const size = worldToView({ x: t.x + t.w, y: t.y + t.h });
      const w = size.x - p.x;
      const h = size.y - p.y;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, p.x, p.y, w, h);
      // base
      ctx.strokeStyle = t.id === selectedId ? "#60a5fa" : "rgba(0,0,0,0.4)";
      ctx.lineWidth = t.id === selectedId ? 3 : 2;
      ctx.beginPath();
      ctx.rect(p.x, p.y, w, h);
      ctx.stroke();
    });

    // measuring
    if (measure.current.active && measure.current.start && measure.current.end) {
      const s = worldToView(measure.current.start);
      const e = worldToView(measure.current.end);
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      const dx = measure.current.end.x - measure.current.start.x;
      const dy = measure.current.end.y - measure.current.start.y;
      const distPx = Math.hypot(dx, dy);
      const distCells = distPx / gridSize;
      const mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
      const label = `${distCells.toFixed(2)} células`;
      ctx.fillStyle = "rgba(17,24,39,0.8)"; // slate-900 bg
      ctx.fillRect(
        mid.x - 6 - ctx.measureText(label).width / 2,
        mid.y - 20,
        ctx.measureText(label).width + 12,
        18
      );
      ctx.fillStyle = "#fff";
      ctx.font = "12px ui-sans-serif";
      ctx.fillText(label, mid.x - ctx.measureText(label).width / 2, mid.y - 7);
    }
  });

  // Mouse events
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onDown = (e) => {
      const rect = c.getBoundingClientRect();
      const viewPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const worldPt = viewToWorld(viewPt);
      if (e.shiftKey) {
        measure.current.active = true;
        measure.current.start = worldPt;
        measure.current.end = worldPt;
        return;
      }
      // token hit test (topmost)
      let hit = null;
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (pointerInToken(worldPt, tokens[i])) {
          hit = tokens[i];
          break;
        }
      }
      if (hit) {
        setSelectedId(hit.id);
        dragging.current = {
          mode: "token",
          id: hit.id,
          offsetX: worldPt.x - hit.x,
          offsetY: worldPt.y - hit.y,
        };
      } else {
        setSelectedId(null);
        dragging.current = {
          mode: "pan",
          id: null,
          lastX: e.clientX,
          lastY: e.clientY,
        };
      }
    };
    const onMove = (e) => {
      const rect = c.getBoundingClientRect();
      const viewPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const worldPt = viewToWorld(viewPt);
      if (measure.current.active) {
        measure.current.end = worldPt;
        return;
      }
      if (dragging.current.mode === "token" && dragging.current.id != null) {
        setTokens((arr) =>
          arr.map((t) => {
            if (t.id !== dragging.current.id) return t;
            let nx = worldPt.x - dragging.current.offsetX;
            let ny = worldPt.y - dragging.current.offsetY;
            if (snap) {
              nx = Math.round(nx / gridSize) * gridSize;
              ny = Math.round(ny / gridSize) * gridSize;
            }
            return { ...t, x: nx, y: ny };
          })
        );
      } else if (dragging.current.mode === "pan") {
        const dx = (e.clientX - dragging.current.lastX) / zoom;
        const dy = (e.clientY - dragging.current.lastY) / zoom;
        dragging.current.lastX = e.clientX;
        dragging.current.lastY = e.clientY;
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
    };
    const onUp = () => {
      dragging.current = { mode: null, id: null };
      measure.current.active = false;
    };
    const onLeave = () => {
      dragging.current = { mode: null, id: null };
    };
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = c.getBoundingClientRect();
      const viewPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const before = viewToWorld(viewPt);
      setZoom((z) => {
        const nz = Math.min(6, Math.max(0.2, z * delta));
        return nz;
      });
      // keep cursor point stable in world by adjusting pan after zoom change on next frame
      setTimeout(() => {
        const after = viewToWorld(viewPt);
        setPan((p) => ({ x: p.x + (before.x - after.x), y: p.y + (before.y - after.y) }));
      }, 0);
    };

    c.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    c.addEventListener("mouseleave", onLeave);
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      c.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      c.removeEventListener("mouseleave", onLeave);
      c.removeEventListener("wheel", onWheel);
    };
  }, [gridSize, snap, tokens, zoom]);

  const selected = useMemo(
    () => tokens.find((t) => t.id === selectedId) || null,
    [tokens, selectedId]
  );

  return (
    <div className="tabletop-root">
      <div className="tt-topbar">
        <span>VTT Starter</span>
        <label className="tt-btn">
          Map
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onLoadMap(e.target.files?.[0])} />
        </label>
        <label className="tt-btn">
          Add Token
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onAddToken(e.target.files?.[0])} />
        </label>
        <div className="tt-topbar-group">
          <button className="tt-btn" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}>Reset View</button>
          <button className="tt-btn" onClick={() => setShowGrid((v) => !v)}>{showGrid ? 'Hide Grid' : 'Show Grid'}</button>
          <button className="tt-btn" onClick={() => setSnap((v) => !v)}>{snap ? 'Snap ON' : 'Snap OFF'}</button>
        </div>
        <div className="tt-topbar-group right">
          <button className="tt-btn" onClick={() => roll(20)}>Roll d20</button>
          <button className="tt-btn" onClick={exportScene}>Export</button>
          <label className="tt-btn">
            Import
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => importScene(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      <div className="tt-main">
        <div className="tt-sidebar-left">
          <div className="tt-controls">
            <div>
              <div className="tt-section-label">Grid</div>
              <input type="range" min={24} max={160} value={gridSize} onChange={(e) => setGridSize(parseInt(e.target.value))} />
              <div className="tt-range-value">{gridSize}px / célula</div>
            </div>
            <div>
              <div className="tt-section-label">Zoom</div>
              <input type="range" min={0.2} max={6} step={0.1} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} />
              <div className="tt-range-value">{zoom.toFixed(2)}x</div>
            </div>
            <div>
              <div className="tt-section-label">Dica</div>
              <ul className="tt-hint-list">
                <li>Segure <kbd>Shift</kbd> para medir</li>
                <li>Arraste vazio para mover a câmera</li>
                <li>Roda do mouse para zoom</li>
                <li>"Snap ON" alinha tokens na grade</li>
              </ul>
            </div>
            {diceRoll && (
              <div className="tt-dice-roll">
                d{diceRoll.sides} → <span>{diceRoll.v}</span>
              </div>
            )}
          </div>
        </div>

        <div className="tt-canvas-wrap">
          <canvas ref={canvasRef} className="tt-canvas" />
          {!mapSrc && (
            <div className="tt-empty">
              <div>
                <div>Carregue um mapa para começar</div>
                <div>Depois adicione tokens (PNGs com fundo transparente ficam ótimos)</div>
              </div>
            </div>
          )}
        </div>

        <div className="tt-sidebar-right">
          <div>
            <div className="tt-section-label">Tokens</div>
            <div className="tt-token-list">
              {tokens.map((t) => (
                <div key={t.id} className={`tt-token-item ${selectedId === t.id ? 'selected' : ''}`}>
                  <div className="tt-token-row">
                    <div className="tt-token-thumb">
                      <img src={t.src} alt="token" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <input
                      value={t.name}
                      onChange={(e) => setTokens((arr) => arr.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))}
                      className="tt-token-name"
                    />
                    <button className="tt-token-del" onClick={() => setTokens((arr) => arr.filter((x) => x.id !== t.id))}>Del</button>
                  </div>
                </div>
              ))}
              {tokens.length === 0 && <div className="tt-range-value">Sem tokens ainda</div>}
            </div>
          </div>

          <div className="tt-selected">
            <div className="tt-section-label">Selecionado</div>
            {selected ? (
              <div className="tt-selected-panel">
                <div>{selected.name}</div>
                <div className="tt-selected-grid">
                  <label>
                    X
                    <input
                      type="number"
                      value={Math.round(selected.x)}
                      onChange={(e) =>
                        setTokens((arr) =>
                          arr.map((t) => (t.id === selected.id ? { ...t, x: parseFloat(e.target.value) } : t))
                        )
                      }
                    />
                  </label>
                  <label>
                    Y
                    <input
                      type="number"
                      value={Math.round(selected.y)}
                      onChange={(e) =>
                        setTokens((arr) =>
                          arr.map((t) => (t.id === selected.id ? { ...t, y: parseFloat(e.target.value) } : t))
                        )
                      }
                    />
                  </label>
                  <label>
                    W
                    <input
                      type="number"
                      value={Math.round(selected.w)}
                      onChange={(e) =>
                        setTokens((arr) =>
                          arr.map((t) => (t.id === selected.id ? { ...t, w: parseFloat(e.target.value) } : t))
                        )
                      }
                    />
                  </label>
                  <label>
                    H
                    <input
                      type="number"
                      value={Math.round(selected.h)}
                      onChange={(e) =>
                        setTokens((arr) =>
                          arr.map((t) => (t.id === selected.id ? { ...t, h: parseFloat(e.target.value) } : t))
                        )
                      }
                    />
                  </label>
                </div>
                <div className="tt-selected-actions">
                  <button
                    className="tt-btn"
                    onClick={() =>
                      setTokens((arr) =>
                        arr.map((t) =>
                          t.id === selected.id
                            ? {
                                ...t,
                                x: Math.round(t.x / gridSize) * gridSize,
                                y: Math.round(t.y / gridSize) * gridSize,
                              }
                            : t
                        )
                      )
                    }
                  >
                    Snap
                  </button>
                  <button
                    className="tt-btn"
                    onClick={() =>
                      setTokens((arr) =>
                        arr.map((t) =>
                          t.id === selected.id ? { ...t, w: gridSize, h: (t.h / t.w) * gridSize } : t
                        )
                      )
                    }
                  >
                    1×1
                  </button>
                </div>
              </div>
            ) : (
              <div className="tt-range-value">Nenhum token selecionado</div>
            )}
          </div>
        </div>
      </div>

      <div className="tt-footer">
        MVP VTT • Shift = régua • Export/Import cena • Expandir: chat, iniciativa, fog of war, iluminação, multiusuário
      </div>
    </div>
  );
}
