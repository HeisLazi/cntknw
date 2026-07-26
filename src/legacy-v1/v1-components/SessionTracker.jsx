import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getAll, put, deleteItem, getSessionsByBook } from '../db.js';

const COLORS = {
  bg: '#191919',
  surface: '#252525',
  elevated: '#2d2d2d',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#e8e8e8',
  textSecondary: '#a0a0a0',
  textMuted: '#666',
  accent: '#7c6aef',
  accentHover: '#8b7cf0',
  success: '#4ade80',
  warning: '#fbbf24',
  danger: '#ef4444',
};

const formatTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export default function SessionTracker({ books = [], selectedBookId, showToast }) {
  const [sessions, setSessions] = useState([]);
  
  // Active session state
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  
  const [sessionData, setSessionData] = useState({
    bookId: selectedBookId || '',
    startPage: '',
    endPage: '',
    notes: ''
  });

  const timerRef = useRef(null);

  useEffect(() => {
    loadSessions();
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (selectedBookId && !isTracking) {
      setSessionData(prev => ({ ...prev, bookId: selectedBookId }));
    }
  }, [selectedBookId, isTracking]);

  const loadSessions = async () => {
    try {
      const allSessions = await getAll('sessions');
      setSessions(allSessions || []);
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Failed to load sessions', 'error');
    }
  };

  const startSession = () => {
    if (!sessionData.bookId) {
      if (showToast) showToast('Please select a book first', 'warning');
      return;
    }
    setIsTracking(true);
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
  };

  const pauseSession = () => {
    if (isPaused) {
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      setIsPaused(true);
      clearInterval(timerRef.current);
    }
  };

  const stopSession = async () => {
    clearInterval(timerRef.current);
    
    if (elapsed === 0) {
      setIsTracking(false);
      setIsPaused(false);
      return;
    }

    const newSession = {
      id: crypto.randomUUID(),
      bookId: sessionData.bookId,
      startPage: sessionData.startPage ? Number(sessionData.startPage) : null,
      endPage: sessionData.endPage ? Number(sessionData.endPage) : null,
      duration: elapsed,
      notes: sessionData.notes.trim(),
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    try {
      await put('sessions', newSession);
      await loadSessions();
      if (showToast) showToast('Session saved', 'success');
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Failed to save session', 'error');
    }

    // Reset
    setIsTracking(false);
    setIsPaused(false);
    setElapsed(0);
    setSessionData({
      bookId: sessionData.bookId,
      startPage: '',
      endPage: '',
      notes: ''
    });
  };

  const handleDeleteSession = async (id) => {
    if (!window.confirm('Delete this reading session?')) return;
    try {
      await deleteItem('sessions', id);
      await loadSessions();
      if (showToast) showToast('Session deleted', 'success');
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Failed to delete session', 'error');
    }
  };

  const getBookTitle = (id) => {
    const book = books.find(b => b.id === id);
    return book ? book.title : 'Unknown Book';
  };

  // Stats
  const stats = useMemo(() => {
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    let totalPages = 0;
    
    const byBook = {};

    sessions.forEach(s => {
      const p = (s.endPage && s.startPage && s.endPage >= s.startPage) ? (s.endPage - s.startPage) : 0;
      totalPages += p;

      if (!byBook[s.bookId]) {
        byBook[s.bookId] = { time: 0, pages: 0, count: 0 };
      }
      byBook[s.bookId].time += s.duration;
      byBook[s.bookId].pages += p;
      byBook[s.bookId].count += 1;
    });

    const avgSession = sessions.length ? Math.floor(totalDuration / sessions.length) : 0;

    return { totalDuration, totalPages, avgSession, byBook };
  }, [sessions]);

  // Grouped History
  const historyByBook = useMemo(() => {
    const grouped = {};
    sessions.forEach(s => {
      if (!grouped[s.bookId]) grouped[s.bookId] = [];
      grouped[s.bookId].push(s);
    });
    
    // Sort within groups
    Object.keys(grouped).forEach(k => {
      grouped[k].sort((a, b) => new Date(b.date) - new Date(a.date));
    });
    return grouped;
  }, [sessions]);

  return (
    <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif", color: COLORS.textPrimary }}>
      <h1 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: 600 }}>Reading Session</h1>

      {/* Active Session Panel */}
      <div style={{
        background: COLORS.surface, borderRadius: '12px', padding: '24px', marginBottom: '32px',
        border: `1px solid ${COLORS.border}`, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
          
          <div style={{ flex: '1 1 300px' }}>
            <select 
              value={sessionData.bookId}
              onChange={e => setSessionData({...sessionData, bookId: e.target.value})}
              disabled={isTracking}
              style={{ width: '100%', padding: '12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary, marginBottom: '16px' }}
            >
              <option value="" disabled>Select a book to read</option>
              {books.map(b => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: COLORS.textSecondary, marginBottom: '4px' }}>Start Page</label>
                <input 
                  type="number" 
                  value={sessionData.startPage}
                  onChange={e => setSessionData({...sessionData, startPage: e.target.value})}
                  disabled={isTracking && elapsed > 0 && !isPaused}
                  style={{ width: '100%', padding: '10px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '12px', color: COLORS.textSecondary, marginBottom: '4px' }}>End Page</label>
                <input 
                  type="number" 
                  value={sessionData.endPage}
                  onChange={e => setSessionData({...sessionData, endPage: e.target.value})}
                  style={{ width: '100%', padding: '10px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <textarea 
              placeholder="Quick session notes..." 
              value={sessionData.notes}
              onChange={e => setSessionData({...sessionData, notes: e.target.value})}
              rows={3}
              style={{ width: '100%', padding: '10px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: COLORS.bg, padding: '32px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: '48px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: isPaused ? COLORS.warning : COLORS.accent, marginBottom: '24px', letterSpacing: '2px' }}>
              {formatTime(elapsed)}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {!isTracking ? (
                <button onClick={startSession} style={{ padding: '12px 24px', background: COLORS.success, color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '16px' }}>Start Reading</button>
              ) : (
                <>
                  <button onClick={pauseSession} style={{ padding: '12px 24px', background: COLORS.warning, color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '16px' }}>
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button onClick={stopSession} style={{ padding: '12px 24px', background: COLORS.danger, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '16px' }}>Stop & Save</button>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
        {/* Stats Panel */}
        <div style={{ flex: '1 1 300px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Reading Stats</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: COLORS.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: '12px', color: COLORS.textSecondary, marginBottom: '8px' }}>Total Time</div>
              <div style={{ fontSize: '24px', fontWeight: 600 }}>{formatTime(stats.totalDuration)}</div>
            </div>
            <div style={{ background: COLORS.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: '12px', color: COLORS.textSecondary, marginBottom: '8px' }}>Total Pages</div>
              <div style={{ fontSize: '24px', fontWeight: 600 }}>{stats.totalPages}</div>
            </div>
            <div style={{ background: COLORS.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, gridColumn: 'span 2' }}>
              <div style={{ fontSize: '12px', color: COLORS.textSecondary, marginBottom: '8px' }}>Avg Session Length</div>
              <div style={{ fontSize: '20px', fontWeight: 600 }}>{formatTime(stats.avgSession)}</div>
            </div>
          </div>
          
          {Object.keys(stats.byBook).length > 0 && (
            <div style={{ background: COLORS.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
              <h3 style={{ fontSize: '14px', margin: '0 0 12px 0', color: COLORS.textSecondary }}>Per Book Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(stats.byBook).map(([id, data]) => (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: COLORS.textPrimary, maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getBookTitle(id)}</span>
                    <span style={{ color: COLORS.textSecondary }}>{formatTime(data.time)} • {data.pages}p</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* History Panel */}
        <div style={{ flex: '2 1 400px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Session History</h2>
          
          {sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', background: COLORS.surface, borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
              <p style={{ color: COLORS.textSecondary }}>No reading sessions yet — start your first session!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {Object.entries(historyByBook).map(([bookId, bookSessions]) => (
                <div key={bookId}>
                  <h3 style={{ fontSize: '14px', margin: '0 0 12px 0', color: COLORS.textSecondary, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '8px' }}>
                    {getBookTitle(bookId)}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {bookSessions.map(session => (
                      <div key={session.id} style={{
                        background: COLORS.surface, borderRadius: '8px', border: `1px solid ${COLORS.border}`, padding: '16px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: COLORS.accent, fontFamily: "'JetBrains Mono', monospace" }}>{formatTime(session.duration)}</span>
                            <span style={{ fontSize: '12px', color: COLORS.textSecondary }}>{new Date(session.date).toLocaleDateString()}</span>
                          </div>
                          <div style={{ fontSize: '13px', color: COLORS.textPrimary }}>
                            {session.startPage && session.endPage ? `Pages ${session.startPage} - ${session.endPage}` : 'No page range recorded'}
                          </div>
                          {session.notes && (
                            <div style={{ fontSize: '12px', color: COLORS.textSecondary, marginTop: '8px', fontStyle: 'italic' }}>
                              "{session.notes.length > 60 ? session.notes.substring(0, 60) + '...' : session.notes}"
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => handleDeleteSession(session.id)}
                          style={{ background: 'transparent', border: 'none', color: COLORS.danger, cursor: 'pointer', padding: '8px' }}
                          title="Delete session"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
