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

function VTTStarter() {
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

    <div className="w-full h-full flex flex-col bg-slate-900 text-slate-100">
      {/* Top bar */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800 sticky top-0 z-10">
        <span className="font-semibold text-lg">VTT Starter</span>
        <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer text-sm">
          Map
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onLoadMap(e.target.files?.[0])}
          />
        </label>
        <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer text-sm">
          Add Token
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onAddToken(e.target.files?.[0])}
          />
        </label>
        <div className="hidden sm:flex items-center gap-2 ml-2">
          <button
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm"
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setZoom(1);
            }}
          >
            Reset View
          </button>
          <button
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm"
            onClick={() => setShowGrid((v) => !v)}
          >
            {showGrid ? "Hide Grid" : "Show Grid"}
          </button>
          <button
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm"
            onClick={() => setSnap((v) => !v)}
          >
            {snap ? "Snap ON" : "Snap OFF"}
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm"
            onClick={() => roll(20)}
          >
            Roll d20
          </button>
          <button
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm"
            onClick={exportScene}
          >
            Export
          </button>
          <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer text-sm">
            Import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => importScene(e.target.files?.[0])}
            />
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

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Left controls */}
        <div className="w-64 p-3 border-r border-slate-800 hidden md:block">
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                Grid
              </div>
              <input
                type="range"
                min={24}
                max={160}
                value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-sm mt-1">{gridSize}px / célula</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                Zoom
              </div>
              <input
                type="range"
                min={0.2}
                max={6}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="text-sm mt-1">{zoom.toFixed(2)}x</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                Dica
              </div>
              <ul className="text-sm list-disc pl-4 space-y-1 text-slate-300">
                <li>
                  Segure <kbd className="px-1 rounded bg-slate-800">Shift</kbd> para medir
                </li>
                <li>Arraste vazio para mover a câmera</li>
                <li>Roda do mouse para zoom</li>
                <li>"Snap ON" alinha tokens na grade</li>
              </ul>
            </div>
            {diceRoll && (
              <div className="tt-dice-roll">
                d{diceRoll.sides} → <span>{diceRoll.v}</span>
              <div className="rounded-xl bg-slate-800 p-3">
                <div className="text-sm">
                  d{diceRoll.sides} → <span className="font-semibold text-lime-400">{diceRoll.v}</span>
                </div>
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

        {/* Canvas */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />
          {!mapSrc && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-slate-400">
                <div className="text-xl font-semibold">Carregue um mapa para começar</div>
                <div className="text-sm">
                  Depois adicione tokens (PNGs com fundo transparente ficam ótimos)
                </div>
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

        {/* Right panel */}
        <div className="w-72 p-3 border-l border-slate-800 hidden lg:flex flex-col gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Tokens</div>
            <div className="space-y-2 max-h-[40vh] overflow-auto pr-1">
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className={`p-2 rounded-xl border ${
                    selectedId === t.id
                      ? "border-blue-400 bg-blue-500/10"
                      : "border-slate-800 bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded overflow-hidden bg-slate-700 flex items-center justify-center">
                      <img
                        src={t.src}
                        alt="token"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <input
                      value={t.name}
                      onChange={(e) =>
                        setTokens((arr) =>
                          arr.map((x) =>
                            x.id === t.id
                              ? { ...x, name: e.target.value }
                              : x
                          )
                        )
                      }
                      className="flex-1 bg-transparent outline-none text-sm"
                    />
                    <button
                      className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-red-600"
                      onClick={() =>
                        setTokens((arr) => arr.filter((x) => x.id !== t.id))
                      }
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
              {tokens.length === 0 && (
                <div className="text-sm text-slate-400">Sem tokens ainda</div>
              )}
            </div>
          </div>

          <div className="mt-auto">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">
              Selecionado
            </div>
            {selected ? (
              <div className="space-y-2 p-3 rounded-xl bg-slate-800/60 border border-slate-800">
                <div className="text-sm font-medium">{selected.name}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex flex-col">
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

                          arr.map((t) =>
                            t.id === selected.id
                              ? { ...t, x: parseFloat(e.target.value) }
                              : t
                          )
                        )
                      }
                      className="bg-slate-900 rounded px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col">
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
                          arr.map((t) =>
                            t.id === selected.id
                              ? { ...t, y: parseFloat(e.target.value) }
                              : t
                          )
                        )
                      }
                      className="bg-slate-900 rounded px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col">
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
                          arr.map((t) =>
                            t.id === selected.id
                              ? { ...t, w: parseFloat(e.target.value) }
                              : t
                          )
                        )
                      }
                      className="bg-slate-900 rounded px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col">
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

                          arr.map((t) =>
                            t.id === selected.id
                              ? { ...t, h: parseFloat(e.target.value) }
                              : t
                          )
                        )
                      }
                      className="bg-slate-900 rounded px-2 py-1"
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
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
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                    onClick={() =>
                      setTokens((arr) =>
                        arr.map((t) =>
                          t.id === selected.id
                            ? {
                                ...t,
                                w: gridSize,
                                h: (t.h / t.w) * gridSize,
                              }
                            : t
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
              <div className="text-sm text-slate-400">
                Nenhum token selecionado
              </div>
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
      {/* Footer */}
      <div className="p-2 text-center text-xs text-slate-400 border-t border-slate-800">
        MVP VTT • Shift = régua • Export/Import cena • Expandir: chat, iniciativa, fog of war, iluminação, multiusuário
      </div>

import React, { useRef, useState, useEffect } from 'react';

function VTTStarter() {
  const canvasRef = useRef(null);
  const [mapImage, setMapImage] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureStart, setMeasureStart] = useState(null);
  const [measureEnd, setMeasureEnd] = useState(null);

  const drawTokens = (ctx) => {
    tokens.forEach((t) => {
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const drawMeasurement = (ctx) => {
    if (measureStart && measureEnd) {
      ctx.strokeStyle = 'yellow';
      ctx.beginPath();
      ctx.moveTo(measureStart.x, measureStart.y);
      ctx.lineTo(measureEnd.x, measureEnd.y);
      ctx.stroke();
      const dist = Math.hypot(
        measureEnd.x - measureStart.x,
        measureEnd.y - measureStart.y
      ).toFixed(1);
      ctx.fillStyle = 'yellow';
      ctx.fillText(
        dist,
        (measureStart.x + measureEnd.x) / 2,
        (measureStart.y + measureEnd.y) / 2
      );
    }
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mapImage) {
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        drawTokens(ctx);
        drawMeasurement(ctx);
      };
      img.src = mapImage;
    } else {
      drawTokens(ctx);
      drawMeasurement(ctx);
    }
  };

  useEffect(redraw, [mapImage, tokens, measureStart, measureEnd]);

  const onCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (measureMode) {
      if (!measureStart) setMeasureStart({ x, y });
      else if (!measureEnd) setMeasureEnd({ x, y });
      else {
        setMeasureStart({ x, y });
        setMeasureEnd(null);
      }
    } else {
      setTokens((ts) => [...ts, { id: Date.now(), x, y }]);
    }
  };

  const loadMap = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setMapImage(reader.result);
    reader.readAsDataURL(file);
  };

  const exportScene = () => {
    const data = JSON.stringify({ mapImage, tokens });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importScene = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setMapImage(data.mapImage || null);
        setTokens(Array.isArray(data.tokens) ? data.tokens : []);
      } catch {
        // arquivo inválido
      }
    };
    reader.readAsText(file);
  };

  const toggleMeasure = () => {
    setMeasureMode((m) => !m);
    setMeasureStart(null);
    setMeasureEnd(null);
  };

  const clearMeasure = () => {
    setMeasureStart(null);
    setMeasureEnd(null);
  };

  return (
    <div className="vtt-starter">
      <div className="controls">
        <label>
          Mapa: <input type="file" accept="image/*" onChange={loadMap} />
        </label>
        <button type="button" onClick={toggleMeasure}>
          {measureMode ? 'Adicionar Tokens' : 'Medir Distância'}
        </button>
        {measureStart && measureEnd && (
          <button type="button" onClick={clearMeasure}>
            Limpar Medida
          </button>
        )}
        <button type="button" onClick={exportScene}>
          Exportar Cena
        </button>
        <label style={{ marginLeft: '0.5rem' }}>
          Importar Cena: <input type="file" accept="application/json" onChange={importScene} />
        </label>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onClick={onCanvasClick}
        style={{ border: '1px solid #ccc', marginTop: '10px' }}
      />

    </div>
  );
}

export default function Tabletop() {
  return <VTTStarter />;
}

