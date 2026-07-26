import React, { useState, useEffect } from 'react';
import { getById, put, getNotesByBook, getSessionsByBook, getPDFByBook } from '../db.js';

const BookDetail = ({ bookId, refreshBooks, showToast }) => {
  const [book, setBook] = useState(null);
  const [notes, setNotes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [pdf, setPdf] = useState(null);

  const loadData = async () => {
    if (!bookId) return;
    try {
      const b = await getById('books', bookId);
      setBook(b);
      
      const n = await getNotesByBook(bookId);
      setNotes(n || []);
      const s = await getSessionsByBook(bookId);
      setSessions(s || []);
      const p = await getPDFByBook(bookId);
      setPdf(p || null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [bookId]);

  const handleUpdateProgress = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updatedBook = {
      ...book,
      currentPage: parseInt(formData.get('currentPage'), 10) || book.currentPage,
      currentChapter: formData.get('currentChapter') || book.currentChapter,
      updatedAt: new Date().toISOString()
    };
    await put('books', updatedBook);
    setBook(updatedBook);
    refreshBooks();
    showToast('Progress updated');
  };

  if (!bookId) return <div style={{ padding: '24px', color: '#666' }}>Select a book from the library.</div>;
  if (!book) return <div style={{ padding: '24px', color: '#e8e8e8' }}>Loading...</div>;

  return (
    <div style={{ padding: '32px', color: '#e8e8e8', maxWidth: '800px', margin: '0 auto', overflowY: 'auto', height: '100%', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', margin: '0 0 8px 0', fontFamily: 'Lora, serif' }}>{book.title}</h1>
        <div style={{ fontSize: '18px', color: '#a0a0a0', marginBottom: '8px' }}>{book.author} {book.publicationYear && `(${book.publicationYear})`}</div>
        {book.tags && book.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {book.tags.map(t => <span key={t} style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#2d2d2d', borderRadius: '12px', color: '#a0a0a0' }}>{t}</span>)}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#252525', padding: '24px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '16px' }}>Reading Progress</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{ flex: 1, height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}>
            <div style={{ width: `${book.totalPages ? (book.currentPage / book.totalPages) * 100 : 0}%`, height: '100%', backgroundColor: '#7c6aef', borderRadius: '4px' }} />
          </div>
          <span style={{ fontSize: '14px', color: '#a0a0a0' }}>{book.currentPage} / {book.totalPages}</span>
        </div>
        
        <form onSubmit={handleUpdateProgress} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Current Page</label>
            <input name="currentPage" type="number" defaultValue={book.currentPage} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Chapter</label>
            <input name="currentChapter" defaultValue={book.currentChapter} style={inputStyle} />
          </div>
          <button type="submit" style={{ padding: '8px 16px', height: '36px', backgroundColor: '#2d2d2d', color: '#e8e8e8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', cursor: 'pointer' }}>Update</button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <button style={actionButtonStyle}>⏱️ Start Reading Session</button>
        <button style={actionButtonStyle}>📝 Add Note</button>
        <button style={actionButtonStyle}>📄 {pdf ? `Open ${pdf.name}` : 'Attach PDF'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginBottom: '16px' }}>Recent Notes</h2>
          {notes.length === 0 ? <p style={{ color: '#666', fontSize: '14px' }}>No notes yet.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notes.slice(0, 5).map((n, i) => (
                <div key={i} style={{ padding: '12px', backgroundColor: '#252525', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#7c6aef' }}>{n.category || 'Note'}</span>
                    <span style={{ fontSize: '12px', color: '#666' }}>p. {n.page}</span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#a0a0a0' }}>{n.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 style={{ fontSize: '18px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginBottom: '16px' }}>Recent Sessions</h2>
          {sessions.length === 0 ? <p style={{ color: '#666', fontSize: '14px' }}>No sessions recorded.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sessions.slice(0, 3).map((s, i) => (
                <div key={i} style={{ padding: '12px', backgroundColor: '#252525', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px' }}>{new Date(s.date).toLocaleDateString()}</span>
                  <span style={{ fontSize: '14px', color: '#a0a0a0' }}>{s.duration} min • {s.pagesRead} pages</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const inputStyle = { width: '100%', padding: '8px', height: '36px', backgroundColor: '#191919', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#e8e8e8', boxSizing: 'border-box' };
const actionButtonStyle = { flex: 1, padding: '12px', backgroundColor: '#252525', color: '#e8e8e8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };

export default BookDetail;
