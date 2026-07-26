import React from 'react';

const Sidebar = ({ view, setView, books, selectedBookId, onSelectBook, collapsed, onToggleCollapse }) => {
  const navItems = [
    { id: 'library', label: 'Library', icon: '📚' },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'pdf-reader', label: 'PDF Reader', icon: '📄' },
    { id: 'art-gallery', label: 'Art Gallery', icon: '🖼️' },
    { id: 'whiteboard', label: 'Whiteboard', icon: '🎨' },
    { id: 'sessions', label: 'Sessions', icon: '⏱️' },
    { id: 'export', label: 'Export / Import', icon: '📤' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  const activeBooks = books ? books.filter(b => !b.archived).slice(0, 5) : [];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={{ 
      width: collapsed ? '60px' : '240px', 
      transition: 'width 0.2s', 
      backgroundColor: '#191919', 
      borderRight: '1px solid rgba(255,255,255,0.08)', 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      padding: '16px 0' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: collapsed ? 0 : 1, transition: 'opacity 0.2s', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span>📖</span>
          <h1 style={{ fontSize: '16px', margin: 0, color: '#e8e8e8', fontFamily: 'Inter, sans-serif' }}>Philosophy Journal</h1>
        </div>
        <button onClick={onToggleCollapse} style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', padding: '4px' }}>
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <div style={{ padding: '0 16px', marginBottom: '16px' }}>
        <button 
          onClick={() => setView('library')}
          style={{ width: '100%', padding: '8px', backgroundColor: '#7c6aef', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: '8px' }}
        >
          <span>+</span>
          {!collapsed && <span>New Book</span>}
        </button>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 8px', flex: 1, overflowY: 'auto' }}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: view === item.id ? 'rgba(255,255,255,0.08)' : 'transparent', color: view === item.id ? '#e8e8e8' : '#a0a0a0', border: 'none', borderRadius: '4px', cursor: 'pointer', textAlign: 'left', justifyContent: collapsed ? 'center' : 'flex-start' }}
            title={collapsed ? item.label : ''}
          >
            <span>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}

        {!collapsed && activeBooks.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h2 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#666', marginBottom: '8px', padding: '0 12px' }}>Currently Reading</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {activeBooks.map(book => {
                const progress = book.totalPages ? (book.currentPage / book.totalPages) * 100 : 0;
                return (
                  <div
                    key={book.id}
                    onClick={() => {
                        onSelectBook(book.id);
                        // Optional: switch to detail view, or library if preferred
                    }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '4px', background: selectedBookId === book.id ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                  >
                    <div style={{ color: '#e8e8e8', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title}</div>
                    <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '4px' }}>
                      <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#7c6aef', borderRadius: '2px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '12px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <span>🔒</span>
        {!collapsed && <span>All data stored locally</span>}
      </div>
    </aside>
  );
};

export default Sidebar;
