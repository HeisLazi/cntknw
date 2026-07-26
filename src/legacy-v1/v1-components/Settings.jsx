import React, { useState, useEffect } from 'react';

export default function Settings({ showToast }) {
  const [storageUsage, setStorageUsage] = useState({ usage: 0, quota: 0 });

  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        setStorageUsage({ usage, quota });
      });
    }
  }, []);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: '24px', color: '#e8e8e8', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 32px 0', fontSize: '24px', fontWeight: 600 }}>Settings</h2>

      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Appearance</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#191919', borderRadius: '6px' }}>
          <div>
            <div style={{ fontWeight: 500 }}>Theme</div>
            <div style={{ color: '#a0a0a0', fontSize: '14px' }}>Currently locked to Dark Mode for the best philosophical contemplation.</div>
          </div>
          <div style={{ background: '#252525', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
            Dark Mode
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Storage Info</h3>
        <p style={{ color: '#a0a0a0', marginBottom: '16px', fontSize: '14px' }}>
          All data is stored locally in your browser's IndexedDB. Your data never leaves your device unless you export it.
        </p>
        <div style={{ background: '#191919', padding: '16px', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#a0a0a0' }}>Estimated Usage:</span>
            <span style={{ fontWeight: 500 }}>{formatBytes(storageUsage.usage)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#a0a0a0' }}>Available Quota:</span>
            <span>{formatBytes(storageUsage.quota)}</span>
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Keyboard Shortcuts</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <ShortcutRow label="Close Modals" keys={['Esc']} />
          {/* Add more shortcuts if implemented elsewhere */}
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>About</h3>
        <div style={{ color: '#a0a0a0', fontSize: '14px', lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 8px 0' }}><strong>Philosophy Reading Journal</strong> v1.0.0</p>
          <p style={{ margin: 0 }}>A dedicated space for deep reading, note-taking, and philosophical reflection.</p>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ label, keys }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#191919', borderRadius: '6px' }}>
      <span style={{ color: '#a0a0a0' }}>{label}</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {keys.map(k => (
          <kbd key={k} style={{ 
            background: '#252525', padding: '4px 8px', borderRadius: '4px', 
            border: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace'
          }}>
            {k}
          </kbd>
        ))}
      </div>
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
