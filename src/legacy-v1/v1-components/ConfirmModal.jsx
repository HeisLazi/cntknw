import React, { useEffect } from 'react';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', confirmDanger = false, onConfirm, onCancel }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (open && e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const btnConfirmStyle = {
    background: confirmDanger ? '#ef4444' : '#7c6aef',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 500
  };

  const btnCancelStyle = {
    background: 'transparent',
    color: '#e8e8e8',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer'
  };

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
      }}
      onClick={onCancel}
    >
      <div 
        style={{
          background: 'rgba(37,37,37,0.95)', border: '1px solid rgba(255,255,255,0.08)',
          padding: '24px', borderRadius: '8px', width: '100%', maxWidth: '400px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', color: '#e8e8e8' }}>{title}</h3>
        <p style={{ margin: '0 0 24px 0', color: '#a0a0a0', fontSize: '14px', lineHeight: '1.5' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onCancel} style={btnCancelStyle}>Cancel</button>
          <button onClick={onConfirm} style={btnConfirmStyle}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
