import { useState, useEffect, useCallback } from 'react';
import * as db from './db.js';
import Sidebar from './components/Sidebar.jsx';
import BookLibrary from './components/BookLibrary.jsx';
import BookDetail from './components/BookDetail.jsx';
import NoteSystem from './components/NoteSystem.jsx';
import PDFReader from './components/PDFReader.jsx';
import ArtGallery from './components/ArtGallery.jsx';
import Whiteboard from './components/Whiteboard.jsx';
import SessionTracker from './components/SessionTracker.jsx';
import ExportImport from './components/ExportImport.jsx';
import Settings from './components/Settings.jsx';
import Toast from './components/Toast.jsx';

export default function App() {
  const [view, setView] = useState('library');
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [books, setBooks] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  const loadBooks = useCallback(async () => {
    try {
      const allBooks = await db.getActiveBooks();
      setBooks(allBooks);
    } catch (err) {
      console.error("Failed to load books", err);
      showToast("Failed to load books", "error");
    }
  }, [showToast]);

  useEffect(() => {
    async function init() {
      await loadBooks();
      const lastView = await db.getState('lastView');
      const lastSelectedBook = await db.getState('lastSelectedBook');
      if (lastView) setView(lastView);
      if (lastSelectedBook) setSelectedBookId(lastSelectedBook);
    }
    init();
  }, [loadBooks]);

  useEffect(() => {
    db.setState('lastView', view);
  }, [view]);

  useEffect(() => {
    db.setState('lastSelectedBook', selectedBookId);
  }, [selectedBookId]);

  const handleSelectBook = useCallback((id) => {
    setSelectedBookId(id);
    setView('book-detail');
  }, []);

  const handleViewChange = useCallback((newView) => {
    setView(newView);
  }, []);
  
  const refreshBooks = useCallback(() => {
    loadBooks();
  }, [loadBooks]);

  const renderView = () => {
    switch (view) {
      case 'library':
        return <BookLibrary books={books} onSelectBook={handleSelectBook} refreshBooks={refreshBooks} showToast={showToast} />;
      case 'book-detail':
        return <BookDetail bookId={selectedBookId} books={books} onBack={() => setView('library')} showToast={showToast} refreshBooks={refreshBooks} setView={setView} />;
      case 'notes':
        return <NoteSystem bookId={selectedBookId} books={books} showToast={showToast} />;
      case 'pdf-reader':
        return <PDFReader bookId={selectedBookId} books={books} showToast={showToast} refreshBooks={refreshBooks} />;
      case 'art-gallery':
        return <ArtGallery showToast={showToast} />;
      case 'whiteboard':
        return <Whiteboard showToast={showToast} />;
      case 'sessions':
        return <SessionTracker showToast={showToast} />;
      case 'export':
        return <ExportImport showToast={showToast} refreshBooks={refreshBooks} />;
      case 'settings':
        return <Settings showToast={showToast} />;
      default:
        return <BookLibrary books={books} onSelectBook={handleSelectBook} refreshBooks={refreshBooks} showToast={showToast} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar 
        view={view}
        setView={handleViewChange}
        books={books}
        selectedBookId={selectedBookId}
        onSelectBook={handleSelectBook}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="main-content">
        <div className="view-container" key={view}>
          {renderView()}
        </div>
      </main>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </div>
  );
}
