import React, { useState, useEffect, useMemo } from 'react';
import { getAll, put, deleteItem } from '../db.js';

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
  modalBg: 'rgba(37,37,37,0.95)',
};

const CATEGORIES = ['claim', 'argument', 'objection', 'definition', 'question', 'reflection'];

const CATEGORY_COLORS = {
  claim: '#3b82f6', // blue
  argument: COLORS.success,
  objection: COLORS.danger,
  definition: COLORS.warning,
  question: '#a855f7', // purple
  reflection: '#f97316' // orange
};

export default function NoteSystem({ books = [], selectedBookId, showToast }) {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [filterBook, setFilterBook] = useState(selectedBookId || 'all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    bookId: selectedBookId || '',
    category: 'claim',
    title: '',
    text: '',
    chapter: '',
    page: '',
    tags: ''
  });

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    if (selectedBookId) {
      setFilterBook(selectedBookId);
      setFormData(prev => ({ ...prev, bookId: selectedBookId }));
    }
  }, [selectedBookId]);

  const loadNotes = async () => {
    try {
      const allNotes = await getAll('notes');
      setNotes(allNotes || []);
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Failed to load notes', 'error');
    }
  };

  const filteredAndSortedNotes = useMemo(() => {
    let result = [...notes];

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(n => (n.title || '').toLowerCase().includes(s) || (n.text || '').toLowerCase().includes(s));
    }

    if (filterBook !== 'all') {
      result = result.filter(n => n.bookId === filterBook);
    }

    if (filterCategory !== 'all') {
      result = result.filter(n => n.category === filterCategory);
    }

    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'page') return (Number(a.page) || 0) - (Number(b.page) || 0);
      return 0;
    });

    return result;
  }, [notes, search, filterBook, filterCategory, sortBy]);

  const handleOpenModal = (note = null) => {
    if (note) {
      setEditingNote(note);
      setFormData({
        bookId: note.bookId,
        category: note.category,
        title: note.title || '',
        text: note.text,
        chapter: note.chapter || '',
        page: note.page || '',
        tags: note.tags ? note.tags.join(', ') : ''
      });
    } else {
      setEditingNote(null);
      setFormData({
        bookId: filterBook !== 'all' ? filterBook : (books[0]?.id || ''),
        category: 'claim',
        title: '',
        text: '',
        chapter: '',
        page: '',
        tags: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingNote(null);
  };

  const handleSaveNote = async () => {
    if (!formData.bookId || !formData.text.trim()) {
      if (showToast) showToast('Book and Note text are required.', 'error');
      return;
    }

    const noteToSave = {
      id: editingNote ? editingNote.id : crypto.randomUUID(),
      bookId: formData.bookId,
      category: formData.category,
      title: formData.title.trim(),
      text: formData.text.trim(),
      chapter: formData.chapter.trim(),
      page: formData.page ? Number(formData.page) : null,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: editingNote ? editingNote.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await put('notes', noteToSave);
      await loadNotes();
      handleCloseModal();
      if (showToast) showToast(`Note ${editingNote ? 'updated' : 'added'} successfully`, 'success');
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Failed to save note', 'error');
    }
  };

  const handleDeleteNote = async (id) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await deleteItem('notes', id);
      await loadNotes();
      if (showToast) showToast('Note deleted', 'success');
    } catch (err) {
      console.error(err);
      if (showToast) showToast('Failed to delete note', 'error');
    }
  };

  const getBookTitle = (id) => {
    const book = books.find(b => b.id === id);
    return book ? book.title : 'Unknown Book';
  };

  return (
    <div style={{ padding: '24px', fontFamily: "'Inter', sans-serif", color: COLORS.textPrimary }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Philosophy Notes</h1>
        <button 
          onClick={() => handleOpenModal()}
          style={{
            background: COLORS.accent,
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'background 0.2s'
          }}
        >
          + New Note
        </button>
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px',
        background: COLORS.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}`
      }}>
        <input 
          type="text" 
          placeholder="Search notes..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 200px', padding: '8px 12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary }}
        />
        
        <select 
          value={filterBook} 
          onChange={e => setFilterBook(e.target.value)}
          style={{ padding: '8px 12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary }}
        >
          <option value="all">All Books</option>
          {books.map(b => (
            <option key={b.id} value={b.id}>{b.title}</option>
          ))}
        </select>

        <select 
          value={filterCategory} 
          onChange={e => setFilterCategory(e.target.value)}
          style={{ padding: '8px 12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary }}
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>

        <select 
          value={sortBy} 
          onChange={e => setSortBy(e.target.value)}
          style={{ padding: '8px 12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary }}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="page">By Page Number</option>
        </select>
      </div>

      <div style={{ marginBottom: '16px', fontSize: '14px', color: COLORS.textSecondary }}>
        {filteredAndSortedNotes.length} notes across {new Set(filteredAndSortedNotes.map(n => n.bookId)).size} books
      </div>

      {filteredAndSortedNotes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', background: COLORS.surface, borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
          <p style={{ color: COLORS.textSecondary }}>No notes yet — start reading and taking notes!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {filteredAndSortedNotes.map(note => (
            <div key={note.id} style={{
              background: COLORS.surface,
              borderRadius: '8px',
              border: `1px solid ${COLORS.border}`,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span style={{
                  background: `${CATEGORY_COLORS[note.category]}22`,
                  color: CATEGORY_COLORS[note.category],
                  padding: '4px 8px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'capitalize'
                }}>
                  {note.category}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleOpenModal(note)} style={{ background: 'transparent', border: 'none', color: COLORS.textSecondary, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => handleDeleteNote(note.id)} style={{ background: 'transparent', border: 'none', color: COLORS.danger, cursor: 'pointer' }}>Del</button>
                </div>
              </div>

              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, fontFamily: "'Lora', serif" }}>
                {note.title || (note.text.length > 50 ? note.text.substring(0, 50) + '...' : note.text)}
              </h3>
              
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: COLORS.textSecondary, flex: 1, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {note.text}
              </p>

              <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: '12px', fontSize: '12px', color: COLORS.textMuted }}>
                <div style={{ marginBottom: '4px', color: COLORS.textSecondary }}>
                  <strong>{getBookTitle(note.bookId)}</strong>
                  {(note.chapter || note.page) && ' • '}
                  {note.chapter && `Ch: ${note.chapter} `}
                  {note.page && `p.${note.page}`}
                </div>
                <div>{new Date(note.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: COLORS.modalBg,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${COLORS.border}`,
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>{editingNote ? 'Edit Note' : 'New Note'}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <select 
                value={formData.bookId}
                onChange={e => setFormData({...formData, bookId: e.target.value})}
                style={{ padding: '10px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary }}
              >
                <option value="" disabled>Select a book</option>
                {books.map(b => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </select>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setFormData({...formData, category: c})}
                    style={{
                      background: formData.category === c ? `${CATEGORY_COLORS[c]}33` : COLORS.bg,
                      color: formData.category === c ? CATEGORY_COLORS[c] : COLORS.textSecondary,
                      border: `1px solid ${formData.category === c ? CATEGORY_COLORS[c] : COLORS.border}`,
                      padding: '6px 12px',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      textTransform: 'capitalize',
                      transition: 'all 0.2s'
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <input 
                  type="text" 
                  placeholder="Chapter" 
                  value={formData.chapter}
                  onChange={e => setFormData({...formData, chapter: e.target.value})}
                  style={{ flex: 1, padding: '10px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary }}
                />
                <input 
                  type="number" 
                  placeholder="Page" 
                  value={formData.page}
                  onChange={e => setFormData({...formData, page: e.target.value})}
                  style={{ flex: 1, padding: '10px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary }}
                />
              </div>

              <input 
                type="text" 
                placeholder="Title (optional)" 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                style={{ padding: '10px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary, fontFamily: "'Lora', serif" }}
              />

              <textarea 
                placeholder="Your note..." 
                value={formData.text}
                onChange={e => setFormData({...formData, text: e.target.value})}
                rows={8}
                style={{ padding: '10px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary, resize: 'vertical', fontFamily: "'Inter', sans-serif" }}
              />

              <input 
                type="text" 
                placeholder="Tags (comma-separated)" 
                value={formData.tags}
                onChange={e => setFormData({...formData, tags: e.target.value})}
                style={{ padding: '10px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '6px', color: COLORS.textPrimary }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button 
                  onClick={handleCloseModal}
                  style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary, borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveNote}
                  style={{ padding: '8px 16px', background: COLORS.accent, border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
