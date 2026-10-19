import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Play / Pause playback' },
    { key: '← / →', desc: 'Seek 1 second backward / forward' },
    { key: 'Shift + ← / →', desc: 'Seek 5 seconds backward / forward' },
    { key: 'Home / 0', desc: 'Jump to beginning of timeline' },
    { key: 'M', desc: 'Mute / unmute audio' },
    { key: 'Cmd / Ctrl + S', desc: 'Save project immediately' },
    { key: 'Delete / Backspace', desc: 'Delete selected clip' },
    { key: 'Esc', desc: 'Deselect active layer / clip' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 11, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--ls-bg-surface-1)',
          border: '1px solid var(--ls-border-subtle)',
          borderRadius: 'var(--ls-radius-lg)',
          boxShadow: 'var(--ls-shadow-xl)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--ls-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--ls-bg-surface-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(182, 255, 59, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ls-accent)',
              }}
            >
              <Keyboard size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ls-text-primary)' }}>
                Keyboard Shortcuts
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--ls-text-muted)' }}>
                Desktop timeline navigation & editing
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ls-text-muted)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 'var(--ls-radius-md)',
                backgroundColor: 'var(--ls-bg-surface-2)',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--ls-text-secondary)' }}>{s.desc}</span>
              <kbd
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--ls-bg-surface-3)',
                  border: '1px solid var(--ls-border-subtle)',
                  color: 'var(--ls-accent)',
                }}
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
