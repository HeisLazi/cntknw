import React, { useState, useEffect, useRef } from 'react';
import { getAll, put, deleteItem } from '../db.js';

const Whiteboard = ({ books, selectedBookId, showToast }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [drawings, setDrawings] = useState([]);
  const [currentDrawingId, setCurrentDrawingId] = useState(null);
  const [drawingName, setDrawingName] = useState('Untitled Drawing');
  
  const [tool, setTool] = useState('pen'); // pen, eraser, line, rect, circle, text
  const [color, setColor] = useState('#e8e8e8');
  const [lineWidth, setLineWidth] = useState(2);
  const [fill, setFill] = useState(false);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    loadDrawings();
    initCanvas();
    
    const handleResize = () => {
      initCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas && container) {
      // Save content
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      if (canvas.width > 0) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1a1a1a'; // Dark background
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Restore content
      if (tempCanvas.width > 0) {
        ctx.drawImage(tempCanvas, 0, 0);
      } else {
        saveState();
      }
    }
  };

  const loadDrawings = async () => {
    try {
      const allDrawings = await getAll('drawings');
      setDrawings(allDrawings.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch (err) {
      console.error(err);
    }
  };

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL();
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(dataURL);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      restoreState(history[historyStep - 1]);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      restoreState(history[historyStep + 1]);
    }
  };

  const restoreState = (dataURL) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = dataURL;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  };

  const getPointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e) => {
    const pos = getPointerPos(e);
    setIsDrawing(true);
    setStartX(pos.x);
    setStartY(pos.y);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));
    
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 3 : lineWidth;
    ctx.strokeStyle = tool === 'eraser' ? '#1a1a1a' : color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (tool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        ctx.font = `${lineWidth * 5 + 10}px Inter`;
        ctx.fillText(text, pos.x, pos.y);
        saveState();
      }
      setIsDrawing(false);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || tool === 'text') return;
    const pos = getPointerPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      // Shape tools
      ctx.putImageData(snapshot, 0, 0);
      ctx.beginPath();
      if (tool === 'line') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(pos.x, pos.y);
      } else if (tool === 'rect') {
        const width = pos.x - startX;
        const height = pos.y - startY;
        ctx.rect(startX, startY, width, height);
      } else if (tool === 'circle') {
        const radius = Math.hypot(pos.x - startX, pos.y - startY);
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
      }
      
      if (fill && tool !== 'line') {
        ctx.fill();
      }
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (tool !== 'text') {
      saveState();
    }
  };

  const saveDrawing = async () => {
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL('image/png');
    const id = currentDrawingId || `draw_${Date.now()}`;
    
    const drawing = {
      id,
      name: drawingName,
      bookId: selectedBookId,
      canvasData: dataURL,
      width: canvas.width,
      height: canvas.height,
      createdAt: currentDrawingId ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      await put('drawings', drawing);
      setCurrentDrawingId(id);
      loadDrawings();
      showToast('Drawing saved', 'success');
    } catch (err) {
      console.error(err);
      showToast('Error saving drawing', 'error');
    }
  };

  const loadDrawing = (drawing) => {
    setCurrentDrawingId(drawing.id);
    setDrawingName(drawing.name);
    restoreState(drawing.canvasData);
    setHistory([drawing.canvasData]);
    setHistoryStep(0);
  };

  const newDrawing = () => {
    setCurrentDrawingId(null);
    setDrawingName('Untitled Drawing');
    clearCanvas();
  };

  const deleteDrawing = async (id) => {
    if (confirm('Delete this drawing?')) {
      try {
        await deleteItem('drawings', id);
        if (currentDrawingId === id) {
          newDrawing();
        }
        loadDrawings();
        showToast('Drawing deleted', 'info');
      } catch (err) {
        console.error(err);
      }
    }
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${drawingName.replace(/\s+/g, '_')}.png`;
    link.href = dataURL;
    link.click();
  };

  return (
    <div className="flex h-full bg-[#191919] text-[#e8e8e8]">
      {/* Sidebar: Drawings List */}
      <div className="w-64 bg-[#252525] border-r border-[rgba(255,255,255,0.08)] flex flex-col">
        <div className="p-4 border-b border-[rgba(255,255,255,0.08)] flex justify-between items-center">
          <h2 className="font-semibold">Sketches</h2>
          <button onClick={newDrawing} className="p-1 hover:text-[#7c6aef]" title="New Sketch">+</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {drawings.map(d => (
            <div 
              key={d.id} 
              className={`p-2 rounded cursor-pointer group flex items-center justify-between ${currentDrawingId === d.id ? 'bg-[#2d2d2d] border border-[#7c6aef]' : 'hover:bg-[#2d2d2d]'}`}
              onClick={() => loadDrawing(d)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <img src={d.canvasData} alt={d.name} className="w-8 h-8 object-cover bg-white rounded" />
                <span className="text-sm truncate">{d.name}</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteDrawing(d.id); }}
                className="opacity-0 group-hover:opacity-100 text-[#ef4444] text-xs px-2"
              >
                Del
              </button>
            </div>
          ))}
          {drawings.length === 0 && (
            <div className="text-center text-sm text-[#a0a0a0] py-4">No sketches yet.</div>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Toolbar */}
        <div className="h-14 bg-[#252525] border-b border-[rgba(255,255,255,0.08)] flex items-center px-4 gap-4 overflow-x-auto">
          <input 
            type="text" 
            value={drawingName}
            onChange={(e) => setDrawingName(e.target.value)}
            className="bg-transparent border-b border-transparent hover:border-[rgba(255,255,255,0.2)] focus:border-[#7c6aef] outline-none font-semibold w-40"
          />
          <div className="w-px h-6 bg-[rgba(255,255,255,0.1)]"></div>
          
          <button onClick={saveDrawing} className="text-sm bg-[#7c6aef] text-white px-3 py-1 rounded hover:bg-[#8b7cf0]">Save</button>
          <button onClick={exportPNG} className="text-sm hover:text-[#7c6aef]">Export</button>
          
          <div className="w-px h-6 bg-[rgba(255,255,255,0.1)]"></div>

          <button onClick={() => setTool('pen')} className={`p-1 px-2 text-sm rounded ${tool === 'pen' ? 'bg-[#7c6aef]' : 'hover:bg-[#2d2d2d]'}`}>Pen</button>
          <button onClick={() => setTool('eraser')} className={`p-1 px-2 text-sm rounded ${tool === 'eraser' ? 'bg-[#7c6aef]' : 'hover:bg-[#2d2d2d]'}`}>Eraser</button>
          <button onClick={() => setTool('line')} className={`p-1 px-2 text-sm rounded ${tool === 'line' ? 'bg-[#7c6aef]' : 'hover:bg-[#2d2d2d]'}`}>Line</button>
          <button onClick={() => setTool('rect')} className={`p-1 px-2 text-sm rounded ${tool === 'rect' ? 'bg-[#7c6aef]' : 'hover:bg-[#2d2d2d]'}`}>Rect</button>
          <button onClick={() => setTool('circle')} className={`p-1 px-2 text-sm rounded ${tool === 'circle' ? 'bg-[#7c6aef]' : 'hover:bg-[#2d2d2d]'}`}>Circle</button>
          <button onClick={() => setTool('text')} className={`p-1 px-2 text-sm rounded ${tool === 'text' ? 'bg-[#7c6aef]' : 'hover:bg-[#2d2d2d]'}`}>Text</button>
          
          <div className="w-px h-6 bg-[rgba(255,255,255,0.1)]"></div>

          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 border-0 p-0 rounded cursor-pointer" />
          <select value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className="bg-[#2d2d2d] text-sm border-0 rounded p-1 outline-none">
            <option value={1}>1px</option>
            <option value={2}>2px</option>
            <option value={3}>3px</option>
            <option value={5}>5px</option>
            <option value={8}>8px</option>
          </select>
          <label className="flex items-center gap-1 text-sm cursor-pointer">
            <input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} className="accent-[#7c6aef]" /> Fill
          </label>
          
          <div className="w-px h-6 bg-[rgba(255,255,255,0.1)]"></div>
          
          <button onClick={undo} disabled={historyStep <= 0} className="p-1 hover:text-[#7c6aef] disabled:opacity-50">Undo</button>
          <button onClick={redo} disabled={historyStep >= history.length - 1} className="p-1 hover:text-[#7c6aef] disabled:opacity-50">Redo</button>
          <button onClick={clearCanvas} className="p-1 hover:text-[#ef4444] text-sm ml-auto">Clear</button>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 overflow-hidden relative cursor-crosshair">
          <canvas 
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="absolute top-0 left-0 touch-none"
          />
        </div>
      </div>
    </div>
  );
};

export default Whiteboard;
