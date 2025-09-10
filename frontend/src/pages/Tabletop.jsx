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

