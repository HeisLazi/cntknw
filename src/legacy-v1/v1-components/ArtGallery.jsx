import React, { useState, useEffect, useRef } from 'react';
import { getAll, put, deleteItem } from '../db.js';
import ConfirmModal from './ConfirmModal';

export default function ArtGallery({ showToast }) {
  const [artworks, setArtworks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingArtwork, setEditingArtwork] = useState(null);
  
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [currentArtworkIndex, setCurrentArtworkIndex] = useState(0);
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [artworkToDelete, setArtworkToDelete] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    period: '',
    medium: '',
    source: '',
    imageData: ''
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadArtworks();
  }, []);

  const loadArtworks = async () => {
    try {
      const data = await getAll('artworks');
      setArtworks(data || []);
    } catch (err) {
      console.error('Error loading artworks', err);
      showToast('Error loading artworks', 'error');
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      title: '',
      artist: '',
      period: '',
      medium: '',
      source: '',
      imageData: ''
    });
    setEditingArtwork(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (e, art) => {
    e.stopPropagation();
    setFormData({
      title: art.title || '',
      artist: art.artist || '',
      period: art.period || '',
      medium: art.medium || '',
      source: art.source || '',
      imageData: art.imageData || ''
    });
    setEditingArtwork(art);
    setIsAddModalOpen(true);
  };

  const handleDeleteClick = (e, art) => {
    e.stopPropagation();
    setArtworkToDelete(art);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!artworkToDelete) return;
    try {
      await deleteItem('artworks', artworkToDelete.id);
      showToast('Artwork deleted successfully', 'success');
      setDeleteConfirmOpen(false);
      setArtworkToDelete(null);
      loadArtworks();
    } catch (err) {
      console.error(err);
      showToast('Error deleting artwork', 'error');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, imageData: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveArtwork = async (e) => {
    e.preventDefault();
    const isEditing = !!editingArtwork;
    
    const artData = {
      ...formData,
      id: isEditing ? editingArtwork.id : crypto.randomUUID(),
      analysis: isEditing ? editingArtwork.analysis : {
        description: '',
        interpretation: '',
        evaluation: '',
        context: ''
      },
      annotations: isEditing ? editingArtwork.annotations : null,
      tags: isEditing ? editingArtwork.tags : [],
      createdAt: isEditing ? editingArtwork.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await put('artworks', artData);
      showToast(isEditing ? 'Artwork updated' : 'Artwork added', 'success');
      setIsAddModalOpen(false);
      loadArtworks();
    } catch (err) {
      console.error(err);
      showToast('Error saving artwork', 'error');
    }
  };

  const openViewer = (index) => {
    setCurrentArtworkIndex(index);
    setIsViewerOpen(true);
  };
  
  const closeViewer = () => {
    setIsViewerOpen(false);
  };

  const nextArtwork = () => {
    setCurrentArtworkIndex((prev) => (prev + 1) % filteredArtworks.length);
  };

  const prevArtwork = () => {
    setCurrentArtworkIndex((prev) => (prev - 1 + filteredArtworks.length) % filteredArtworks.length);
  };

  const handleAnalysisChange = (field, value) => {
    const art = filteredArtworks[currentArtworkIndex];
    if (!art) return;
    
    const updated = {
      ...art,
      analysis: {
        ...art.analysis,
        [field]: value
      },
      updatedAt: new Date().toISOString()
    };
    
    saveViewerData(updated);
  };

  const saveViewerData = async (updatedArt) => {
    try {
      await put('artworks', updatedArt);
      // update local state
      setArtworks(artworks.map(a => a.id === updatedArt.id ? updatedArt : a));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredArtworks = artworks.filter(art => {
    const matchesSearch = (art.title + ' ' + art.artist).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPeriod = filterPeriod === '' || art.period === filterPeriod;
    return matchesSearch && matchesPeriod;
  });

  const uniquePeriods = [...new Set(artworks.map(a => a.period).filter(Boolean))];

  return (
    <div style={{ padding: '24px', color: '#e8e8e8' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>Art Gallery</h2>
        <button 
          onClick={handleOpenAdd}
          style={{ 
            background: '#7c6aef', color: '#fff', border: 'none', 
            padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
            fontWeight: 500
          }}>
          + Add Artwork
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Search by title or artist..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            padding: '8px 12px', borderRadius: '6px', 
            background: '#252525', border: '1px solid rgba(255,255,255,0.08)',
            color: '#e8e8e8', flex: 1
          }}
        />
        <select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          style={{ 
            padding: '8px 12px', borderRadius: '6px', 
            background: '#252525', border: '1px solid rgba(255,255,255,0.08)',
            color: '#e8e8e8'
          }}
        >
          <option value="">All Periods</option>
          {uniquePeriods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {filteredArtworks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#a0a0a0' }}>
          No artworks yet — start building your philosophical art collection
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
          {filteredArtworks.map((art, idx) => (
            <div 
              key={art.id}
              onClick={() => openViewer(idx)}
              style={{
                background: '#252525',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'transform 150ms'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ height: '200px', backgroundColor: '#191919', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {art.imageData ? (
                  <img src={art.imageData} alt={art.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#666' }}>No Image</span>
                )}
              </div>
              <div style={{ padding: '12px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{art.title || 'Untitled'}</div>
                <div style={{ color: '#a0a0a0', fontSize: '14px', marginBottom: '4px' }}>{art.artist || 'Unknown Artist'}</div>
                <div style={{ color: '#666', fontSize: '12px' }}>{art.period}</div>
              </div>
              <div 
                className="artwork-actions"
                style={{
                  position: 'absolute', top: '8px', right: '8px',
                  display: 'flex', gap: '4px',
                  background: 'rgba(37,37,37,0.8)', padding: '4px', borderRadius: '4px',
                  backdropFilter: 'blur(4px)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={(e) => handleOpenEdit(e, art)} style={{ background: 'transparent', border: 'none', color: '#e8e8e8', cursor: 'pointer', padding: '4px' }}>✎</button>
                <button onClick={(e) => handleDeleteClick(e, art)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'rgba(37,37,37,0.95)', border: '1px solid rgba(255,255,255,0.08)',
            padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '500px',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>{editingArtwork ? 'Edit Artwork' : 'Add Artwork'}</h3>
            <form onSubmit={handleSaveArtwork} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a0a0a0', fontSize: '14px' }}>Title</label>
                <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a0a0a0', fontSize: '14px' }}>Artist</label>
                <input value={formData.artist} onChange={e => setFormData({...formData, artist: e.target.value})} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#a0a0a0', fontSize: '14px' }}>Period / Era</label>
                  <input value={formData.period} onChange={e => setFormData({...formData, period: e.target.value})} placeholder="e.g. Renaissance" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#a0a0a0', fontSize: '14px' }}>Medium</label>
                  <input value={formData.medium} onChange={e => setFormData({...formData, medium: e.target.value})} placeholder="e.g. Oil on canvas" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a0a0a0', fontSize: '14px' }}>Source / Location</label>
                <input value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#a0a0a0', fontSize: '14px' }}>Image</label>
                {formData.imageData && (
                  <div style={{ marginBottom: '8px' }}>
                    <img src={formData.imageData} alt="preview" style={{ maxHeight: '150px', borderRadius: '4px' }} />
                  </div>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ color: '#e8e8e8' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={btnStyleSecondary}>Cancel</button>
                <button type="submit" style={btnStylePrimary}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Art Viewer Modal */}
      {isViewerOpen && filteredArtworks[currentArtworkIndex] && (() => {
        const art = filteredArtworks[currentArtworkIndex];
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(25,25,25,0.98)',
            display: 'flex', zIndex: 1100
          }}>
            {/* Left side - Image */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '24px' }}>
              <button onClick={closeViewer} style={{ position: 'absolute', top: '24px', left: '24px', background: 'rgba(37,37,37,0.8)', border: 'none', color: '#e8e8e8', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', zIndex: 10 }}>Close</button>
              <button onClick={prevArtwork} style={navBtnStyle({ left: '24px' })}>‹</button>
              <img 
                src={art.imageData} 
                alt={art.title} 
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transition: 'transform 0.2s ease', cursor: 'zoom-in' }} 
                onClick={(e) => {
                  const currentScale = e.currentTarget.style.transform === 'scale(1.5)' ? 'scale(1)' : 'scale(1.5)';
                  e.currentTarget.style.transform = currentScale;
                }}
              />
              <button onClick={nextArtwork} style={navBtnStyle({ right: '24px' })}>›</button>
            </div>
            
            {/* Right side - Analysis */}
            <div style={{ 
              width: '400px', background: '#252525', borderLeft: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', flexDirection: 'column', overflowY: 'auto'
            }}>
              <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>{art.title}</h2>
                <div style={{ color: '#a0a0a0' }}>{art.artist} {art.period ? `— ${art.period}` : ''}</div>
              </div>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', color: '#e8e8e8', fontWeight: 600, marginBottom: '8px' }}>Description</label>
                  <div style={{ color: '#a0a0a0', fontSize: '12px', marginBottom: '8px' }}>What do you see?</div>
                  <textarea 
                    value={art.analysis?.description || ''} 
                    onChange={e => handleAnalysisChange('description', e.target.value)}
                    style={textareaStyle} rows={4}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#e8e8e8', fontWeight: 600, marginBottom: '8px' }}>Interpretation</label>
                  <div style={{ color: '#a0a0a0', fontSize: '12px', marginBottom: '8px' }}>What does it mean?</div>
                  <textarea 
                    value={art.analysis?.interpretation || ''} 
                    onChange={e => handleAnalysisChange('interpretation', e.target.value)}
                    style={textareaStyle} rows={4}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#e8e8e8', fontWeight: 600, marginBottom: '8px' }}>Evaluation</label>
                  <div style={{ color: '#a0a0a0', fontSize: '12px', marginBottom: '8px' }}>Is it successful? Why?</div>
                  <textarea 
                    value={art.analysis?.evaluation || ''} 
                    onChange={e => handleAnalysisChange('evaluation', e.target.value)}
                    style={textareaStyle} rows={4}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#e8e8e8', fontWeight: 600, marginBottom: '8px' }}>Context</label>
                  <div style={{ color: '#a0a0a0', fontSize: '12px', marginBottom: '8px' }}>Historical/philosophical context</div>
                  <textarea 
                    value={art.analysis?.context || ''} 
                    onChange={e => handleAnalysisChange('context', e.target.value)}
                    style={textareaStyle} rows={4}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <ConfirmModal 
        open={deleteConfirmOpen}
        title="Delete Artwork"
        message={`Are you sure you want to delete "${artworkToDelete?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        confirmDanger={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '6px',
  background: '#191919', border: '1px solid rgba(255,255,255,0.08)',
  color: '#e8e8e8', boxSizing: 'border-box'
};

const textareaStyle = {
  ...inputStyle, resize: 'vertical', minHeight: '80px', fontFamily: 'inherit'
};

const btnStylePrimary = {
  background: '#7c6aef', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 500
};

const btnStyleSecondary = {
  background: 'transparent', color: '#e8e8e8', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer'
};

const navBtnStyle = (pos) => ({
  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
  background: 'rgba(37,37,37,0.8)', border: 'none', color: '#e8e8e8',
  width: '48px', height: '48px', borderRadius: '24px', cursor: 'pointer',
  fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 10, ...pos
});
