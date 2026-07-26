import React, { useState } from 'react';
import { exportAllData, importData, clearStore } from '../db.js';
import ConfirmModal from './ConfirmModal';

export default function ExportImport({ books, refreshBooks, showToast }) {
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const handleExportJSON = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `philosophy-journal-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Export successful', 'success');
    } catch (err) {
      console.error(err);
      showToast('Export failed', 'error');
    }
  };

  const handleExportMarkdown = () => {
    try {
      let markdown = '# Philosophy Reading Notes\n\n';
      
      books.forEach(book => {
        markdown += `## Book: ${book.title} by ${book.author}\n\n`;
        if (book.notes && book.notes.length > 0) {
          book.notes.forEach(note => {
            markdown += `### ${note.chapter ? `Chapter: ${note.chapter}` : 'Note'}${note.page ? `, Page ${note.page}` : ''}\n`;
            if (note.type) markdown += `**[${note.type.charAt(0).toUpperCase() + note.type.slice(1)}]** `;
            markdown += `${note.content}\n\n`;
          });
        }
        markdown += '---\n\n';
      });

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `philosophy-notes-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Markdown export successful', 'success');
    } catch (err) {
      console.error(err);
      showToast('Markdown export failed', 'error');
    }
  };

  const handleImportJSON = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = evt.target.result;
        await importData(json);
        showToast('Data imported successfully', 'success');
        if (refreshBooks) refreshBooks();
      } catch (err) {
        console.error(err);
        showToast('Import failed. Invalid file format.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = async () => {
    try {
      await clearStore('books');
      await clearStore('sessions');
      await clearStore('artworks');
      showToast('All data cleared successfully', 'success');
      setIsClearConfirmOpen(false);
      if (refreshBooks) refreshBooks();
    } catch (err) {
      console.error(err);
      showToast('Failed to clear data', 'error');
    }
  };

  return (
    <div style={{ padding: '24px', color: '#e8e8e8', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 32px 0', fontSize: '24px', fontWeight: 600 }}>Export & Import</h2>

      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Export Data</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '16px', fontSize: '14px' }}>
          Download a backup of all your data (books, notes, artworks, etc.) or export your notes as a readable Markdown file.
        </p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button onClick={handleExportJSON} style={btnStylePrimary}>
            Export as JSON
          </button>
          <button onClick={handleExportMarkdown} style={btnStyleSecondary}>
            Export Notes as Markdown
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Import Data</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '8px', fontSize: '14px' }}>
          Upload a previously exported JSON backup file.
        </p>
        <p style={{ color: '#fbbf24', marginBottom: '16px', fontSize: '14px', background: 'rgba(251, 191, 36, 0.1)', padding: '8px', borderRadius: '4px' }}>
          Warning: This will merge imported items with your existing data.
        </p>
        <input 
          type="file" 
          accept=".json"
          onChange={handleImportJSON}
          style={{ color: '#e8e8e8' }}
        />
      </div>

      <div style={{ ...sectionStyle, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#ef4444' }}>Danger Zone</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '16px', fontSize: '14px' }}>
          Permanently delete all books, notes, reading sessions, and artworks. This action cannot be undone.
        </p>
        <button onClick={() => setIsClearConfirmOpen(true)} style={btnStyleDanger}>
          Clear All Data
        </button>
      </div>

      <ConfirmModal
        open={isClearConfirmOpen}
        title="Clear All Data"
        message="Are you absolutely sure you want to delete all data? This will permanently erase all books, notes, artworks, and reading sessions. This action cannot be undone."
        confirmLabel="Yes, Clear All Data"
        confirmDanger={true}
        onConfirm={handleClearData}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </div>
  );
}

const sectionStyle = {
  background: '#252525',
  border: '1px solid rgba(255,255,255,0.08)',
  padding: '24px',
  borderRadius: '8px',
  marginBottom: '24px'
};

const btnStylePrimary = {
  background: '#7c6aef', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500
};

const btnStyleSecondary = {
  background: 'transparent', color: '#e8e8e8', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer'
};

const btnStyleDanger = {
  background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500
};
