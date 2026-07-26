import React, { useState } from 'react';
import { getAll, put, deleteItem, getActiveBooks } from '../db.js';

const BookLibrary = ({ books, selectedBookId, onSelectBook, refreshBooks, showToast }) => {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  
  const filteredBooks = (books || [])
    .filter(b => showArchived ? true : !b.archived)
    .filter(b => b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase()));

  const handleAddEdit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const bookData = {
      id: editingBook ? editingBook.id : crypto.randomUUID(),
      title: formData.get('title'),
      author: formData.get('author'),
      publicationYear: formData.get('publicationYear'),
      totalPages: parseInt(formData.get('totalPages'), 10) || 0,
      currentChapter: formData.get('currentChapter'),
      currentPage: parseInt(formData.get('currentPage'), 10) || 0,
      tags: formData.get('tags').split(',').map(t => t.trim()).filter(Boolean),
      coverUrl: formData.get('coverUrl'),
      archived: editingBook ? editingBook.archived : false,
      createdAt: editingBook ? editingBook.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await put('books', bookData);
    setIsModalOpen(false);
    setEditingBook(null);
    refreshBooks();
    showToast(editingBook ? 'Book updated' : 'Book added');
  };

  const handleArchive = async (book) => {
    await put('books', { ...book, archived: !book.archived, updatedAt: new Date().toISOString() });
    refreshBooks();
    showToast(book.archived ? 'Book unarchived' : 'Book archived');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this book?')) {
      await deleteItem('books', id);
      refreshBooks();
      showToast('Book deleted');
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e8e8e8', height: '100%', overflowY: 'auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>My Library</h1>
        <button onClick={() => { setEditingBook(null); setIsModalOpen(true); }} style={{ backgroundColor: '#7c6aef', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>+ Add Book</button>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Search books..." 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', backgroundColor: '#2d2d2d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#e8e8e8' }}
        />
        <button onClick={() => setShowArchived(!showArchived)} style={{ padding: '8px 16px', backgroundColor: showArchived ? '#2d2d2d' : 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e8e8', borderRadius: '4px', cursor: 'pointer' }}>
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </button>
      </div>

      {filteredBooks.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#666', marginTop: '48px' }}>
          <p>No books yet — add your first philosophy book</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '24px' }}>
          {filteredBooks.map(book => (
            <div key={book.id} style={{ backgroundColor: '#252525', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px', opacity: book.archived ? 0.6 : 1, position: 'relative' }}>
              <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px' }}>
                <button onClick={() => { setEditingBook(book); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => handleArchive(book)} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer' }}>{book.archived ? 'Unarchive' : 'Archive'}</button>
                <button onClick={() => handleDelete(book.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>Del</button>
              </div>
              <div onClick={() => onSelectBook(book.id)} style={{ cursor: 'pointer', marginTop: '24px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontFamily: 'Lora, serif' }}>{book.title}</h3>
                <p style={{ margin: '0 0 16px 0', color: '#a0a0a0', fontSize: '14px' }}>{book.author}</p>
                <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginBottom: '8px' }}>
                   <div style={{ width: `${book.totalPages ? (book.currentPage / book.totalPages) * 100 : 0}%`, height: '100%', backgroundColor: '#7c6aef', borderRadius: '3px' }} />
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>{book.currentPage} / {book.totalPages} pages</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(37,37,37,0.95)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleAddEdit} style={{ backgroundColor: '#191919', padding: '24px', borderRadius: '8px', width: '400px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px' }}>{editingBook ? 'Edit Book' : 'Add Book'}</h2>
            <input name="title" defaultValue={editingBook?.title} placeholder="Title" required style={inputStyle} />
            <input name="author" defaultValue={editingBook?.author} placeholder="Author" required style={inputStyle} />
            <input name="publicationYear" defaultValue={editingBook?.publicationYear} placeholder="Publication Year" style={inputStyle} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <input name="currentPage" type="number" defaultValue={editingBook?.currentPage || 0} placeholder="Current Page" style={inputStyle} />
              <input name="totalPages" type="number" defaultValue={editingBook?.totalPages || 0} placeholder="Total Pages" style={inputStyle} />
            </div>
            <input name="currentChapter" defaultValue={editingBook?.currentChapter} placeholder="Current Chapter" style={inputStyle} />
            <input name="tags" defaultValue={editingBook?.tags?.join(', ')} placeholder="Tags (comma separated)" style={inputStyle} />
            <input name="coverUrl" defaultValue={editingBook?.coverUrl} placeholder="Cover Image URL" style={inputStyle} />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', background: 'transparent', color: '#a0a0a0', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#7c6aef', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const inputStyle = { width: '100%', padding: '8px', marginBottom: '12px', backgroundColor: '#2d2d2d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#e8e8e8', boxSizing: 'border-box' };

export default BookLibrary;
