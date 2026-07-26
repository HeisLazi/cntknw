import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getAll, put, deleteItem, getPDFByBook, getAllByIndex } from '../db.js';

// Setup pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const PDFReader = ({ books, selectedBookId, showToast }) => {
  const [pdfData, setPdfData] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [isRendering, setIsRendering] = useState(false);
  const [notes, setNotes] = useState([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [showAddNote, setShowAddNote] = useState(false);

  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  
  // Annotation state
  const [tool, setTool] = useState('select'); // select, pen, highlight, eraser
  const [color, setColor] = useState('#ffff00');
  const [lineWidth, setLineWidth] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState(null);

  useEffect(() => {
    if (selectedBookId) {
      loadPDF(selectedBookId);
      loadNotes(selectedBookId);
    }
  }, [selectedBookId]);

  useEffect(() => {
    if (pdfData) {
      initPDF(pdfData);
    }
  }, [pdfData]);

  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNum);
      loadAnnotations(pageNum);
    }
  }, [pdfDoc, pageNum, scale]);

  const loadPDF = async (bookId) => {
    try {
      const pdfRecord = await getPDFByBook(bookId);
      if (pdfRecord) {
        setPdfData(pdfRecord.data);
      } else {
        setPdfData(null);
        setPdfDoc(null);
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading PDF', 'error');
    }
  };

  const loadNotes = async (bookId) => {
    try {
      const allNotes = await getAllByIndex('notes', 'bookId', bookId);
      setNotes(allNotes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      try {
        await put('pdfs', {
          id: `pdf_${Date.now()}`,
          bookId: selectedBookId,
          name: file.name,
          data: arrayBuffer,
          createdAt: new Date().toISOString()
        });
        setPdfData(arrayBuffer);
        showToast('PDF uploaded successfully', 'success');
      } catch (err) {
        console.error(err);
        showToast('Error saving PDF', 'error');
      }
    } else {
      showToast('Please select a valid PDF file', 'error');
    }
  };

  const initPDF = async (data) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setPageNum(1);
    } catch (err) {
      console.error(err);
      showToast('Error initializing PDF', 'error');
    }
  };

  const renderPage = async (num) => {
    if (!pdfDoc) return;
    setIsRendering(true);

    try {
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const overlay = overlayRef.current;
      overlay.height = viewport.height;
      overlay.width = viewport.width;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      drawAnnotations();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRendering(false);
    }
  };

  const changePage = (offset) => {
    setPageNum(prev => {
      const next = prev + offset;
      if (next >= 1 && next <= numPages) return next;
      return prev;
    });
  };

  const handleZoom = (newScale) => {
    setScale(newScale);
  };

  // Basic Annotation logic
  const getPointerPos = (e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (overlayRef.current.width / rect.width),
      y: (e.clientY - rect.top) * (overlayRef.current.height / rect.height)
    };
  };

  const handlePointerDown = (e) => {
    if (tool === 'select') return;
    setIsDrawing(true);
    const pos = getPointerPos(e);
    
    if (tool === 'eraser') {
      eraseAt(pos);
      return;
    }

    const newStroke = {
      tool,
      color: tool === 'highlight' ? color + '80' : color, // Add transparency for highlight
      lineWidth: tool === 'highlight' ? lineWidth * 4 : lineWidth,
      points: [pos]
    };
    setCurrentStroke(newStroke);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const pos = getPointerPos(e);

    if (tool === 'eraser') {
      eraseAt(pos);
      return;
    }

    if (currentStroke) {
      setCurrentStroke({
        ...currentStroke,
        points: [...currentStroke.points, pos]
      });
      drawAnnotations([...strokes, { ...currentStroke, points: [...currentStroke.points, pos] }]);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (tool === 'eraser') return;
    
    if (currentStroke && currentStroke.points.length > 0) {
      const newStrokes = [...strokes, currentStroke];
      setStrokes(newStrokes);
      saveAnnotations(newStrokes);
    }
    setCurrentStroke(null);
  };

  const eraseAt = (pos) => {
    const eraseRadius = 10;
    const newStrokes = strokes.filter(stroke => {
      return !stroke.points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < eraseRadius);
    });
    if (newStrokes.length !== strokes.length) {
      setStrokes(newStrokes);
      saveAnnotations(newStrokes);
      drawAnnotations(newStrokes);
    }
  };

  const drawAnnotations = (strokesToDraw = strokes) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    strokesToDraw.forEach(stroke => {
      if (!stroke.points || stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    });
  };

  const saveAnnotations = async (currentStrokes) => {
    if (!selectedBookId) return;
    const id = `annot_${selectedBookId}_${pageNum}`;
    try {
      await put('annotations', {
        id,
        bookId: selectedBookId,
        pageNum,
        strokes: currentStrokes
      });
    } catch (err) {
      console.error(err);
    }
  };

  const loadAnnotations = async (page) => {
    if (!selectedBookId) return;
    try {
      const allAnnots = await getAllByIndex('annotations', 'bookId', selectedBookId);
      const pageAnnot = allAnnots.find(a => a.pageNum === page);
      if (pageAnnot) {
        setStrokes(pageAnnot.strokes || []);
      } else {
        setStrokes([]);
      }
    } catch (err) {
      console.error(err);
      setStrokes([]);
    }
  };

  const clearAnnotations = () => {
    setStrokes([]);
    saveAnnotations([]);
    drawAnnotations([]);
  };

  const undoAnnotation = () => {
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    saveAnnotations(newStrokes);
    drawAnnotations(newStrokes);
  };

  const handleSaveNote = async () => {
    if (!newNoteContent.trim()) return;
    try {
      const note = {
        id: `note_${Date.now()}`,
        bookId: selectedBookId,
        content: newNoteContent,
        page: pageNum,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await put('notes', note);
      setNewNoteContent('');
      setShowAddNote(false);
      loadNotes(selectedBookId);
      showToast('Note added', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to save note', 'error');
    }
  };

  if (!selectedBookId) {
    return (
      <div className="flex items-center justify-center h-full text-[#a0a0a0]">
        Select a book to read its PDF.
      </div>
    );
  }

  if (!pdfData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#e8e8e8] p-8">
        <h2 className="text-xl mb-4">No PDF found for this book</h2>
        <div className="border-2 border-dashed border-[#a0a0a0] p-8 rounded-lg text-center cursor-pointer hover:border-[#7c6aef] transition-colors relative">
          <p className="mb-2">Drag and drop a PDF file here, or click to select</p>
          <input 
            type="file" 
            accept=".pdf" 
            onChange={handleFileUpload} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#191919] text-[#e8e8e8]">
      {/* Left: PDF Viewer */}
      <div className="w-[60%] flex flex-col border-r border-[rgba(255,255,255,0.08)] relative">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 bg-[#252525] border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2">
            <button onClick={() => changePage(-1)} disabled={pageNum <= 1} className="p-1 hover:text-[#7c6aef] disabled:opacity-50">Prev</button>
            <span className="text-sm">Page {pageNum} of {numPages}</span>
            <button onClick={() => changePage(1)} disabled={pageNum >= numPages} className="p-1 hover:text-[#7c6aef] disabled:opacity-50">Next</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleZoom(scale - 0.25)} className="p-1 hover:text-[#7c6aef]">-</button>
            <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => handleZoom(scale + 0.25)} className="p-1 hover:text-[#7c6aef]">+</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTool('select')} className={`p-1 px-2 text-sm rounded ${tool === 'select' ? 'bg-[#7c6aef] text-white' : 'hover:bg-[#2d2d2d]'}`}>Select</button>
            <button onClick={() => setTool('pen')} className={`p-1 px-2 text-sm rounded ${tool === 'pen' ? 'bg-[#7c6aef] text-white' : 'hover:bg-[#2d2d2d]'}`}>Pen</button>
            <button onClick={() => setTool('highlight')} className={`p-1 px-2 text-sm rounded ${tool === 'highlight' ? 'bg-[#7c6aef] text-white' : 'hover:bg-[#2d2d2d]'}`}>Highlight</button>
            <button onClick={() => setTool('eraser')} className={`p-1 px-2 text-sm rounded ${tool === 'eraser' ? 'bg-[#7c6aef] text-white' : 'hover:bg-[#2d2d2d]'}`}>Eraser</button>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 border-0 p-0" />
            <select value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className="bg-[#2d2d2d] text-sm border-0 rounded">
              <option value={1}>1px</option>
              <option value={2}>2px</option>
              <option value={3}>3px</option>
              <option value={5}>5px</option>
            </select>
            <button onClick={undoAnnotation} className="p-1 text-sm hover:text-[#7c6aef]">Undo</button>
            <button onClick={clearAnnotations} className="p-1 text-sm hover:text-[#ef4444]">Clear</button>
          </div>
        </div>

        {/* PDF Canvas Container */}
        <div className="flex-1 overflow-auto bg-[#1a1a1a] p-4 relative flex justify-center">
          <div className="relative shadow-lg" style={{ width: canvasRef.current?.width || 'auto', height: canvasRef.current?.height || 'auto' }}>
            <canvas ref={canvasRef} className="block" />
            <canvas 
              ref={overlayRef} 
              className={`absolute top-0 left-0 ${tool !== 'select' ? 'cursor-crosshair' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
            {isRendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white text-sm">
                Rendering...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Notes Panel */}
      <div className="w-[40%] flex flex-col bg-[#252525]">
        <div className="p-4 border-b border-[rgba(255,255,255,0.08)] flex justify-between items-center">
          <h3 className="font-semibold text-[#e8e8e8]">Notes (Page {pageNum})</h3>
          <button 
            onClick={() => setShowAddNote(!showAddNote)}
            className="px-3 py-1 bg-[#7c6aef] text-white text-sm rounded hover:bg-[#8b7cf0] transition-colors"
          >
            {showAddNote ? 'Cancel' : 'Add Note'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {showAddNote && (
            <div className="bg-[#2d2d2d] p-3 rounded-lg border border-[rgba(255,255,255,0.08)]">
              <textarea
                className="w-full bg-[#191919] text-[#e8e8e8] p-2 rounded border border-[rgba(255,255,255,0.08)] focus:outline-none focus:border-[#7c6aef] min-h-[100px] resize-y mb-2"
                placeholder="Write a note for this page..."
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
              />
              <div className="flex justify-end">
                <button 
                  onClick={handleSaveNote}
                  className="px-4 py-1.5 bg-[#4ade80] text-[#191919] text-sm font-medium rounded hover:opacity-90 transition-opacity"
                >
                  Save Note
                </button>
              </div>
            </div>
          )}

          {notes.filter(n => n.page === pageNum).length === 0 ? (
            <div className="text-[#a0a0a0] text-sm text-center py-8">
              No notes for this page yet.
            </div>
          ) : (
            notes.filter(n => n.page === pageNum).map(note => (
              <div key={note.id} className="bg-[#2d2d2d] p-4 rounded-lg border border-[rgba(255,255,255,0.08)]">
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <div className="text-xs text-[#a0a0a0] mt-2">
                  {new Date(note.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFReader;
