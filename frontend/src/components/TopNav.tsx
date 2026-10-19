import React, { useState } from 'react';
import { ArrowLeft, Undo2, Redo2, HelpCircle, Download, Check, RefreshCw } from 'lucide-react';
import { Project } from '../types';

interface TopNavProps {
  project: Project;
  saving: boolean;
  onUpdateTitle: (title: string) => void;
  onUpdateAspectRatio: (aspect: '16:9' | '9:16' | '1:1' | '4:5') => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
  onOpenShortcuts: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  project,
  saving,
  onUpdateTitle,
  onUpdateAspectRatio,
  onUndo,
  onRedo,
  onOpenExport,
  onOpenShortcuts
}) => {
  const [title, setTitle] = useState(project.title);

  return (
    <header className="top-nav" style={{
      height: '56px',
      background: 'var(--surface-primary)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      gap: '12px',
      zIndex: 30,
      flexShrink: 0
    }}>
      {/* Left: Brand & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <a
          href="/dashboard"
          className="btn-icon"
          title="Back to Dashboard"
          style={{ textDecoration: 'none' }}
        >
          <ArrowLeft size={18} />
        </a>

        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#0C1A2B" stroke="#B6FF3B" strokeWidth="1.4" />
            <path d="M8 19V13M12 23V9M16 26V6M20 21V11M24 18V14" stroke="#B6FF3B" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            LyricStudio
          </span>
        </div>

        {/* Editable Title */}
        <div style={{ position: 'relative', minWidth: '140px', maxWidth: '280px' }}>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              onUpdateTitle(e.target.value);
            }}
            placeholder="Untitled Project"
            className="form-control"
            style={{
              height: '32px',
              padding: '0 10px',
              fontWeight: 500,
              fontSize: '14px',
              background: 'transparent',
              borderColor: 'transparent'
            }}
            onFocus={(e) => (e.target.style.background = 'var(--surface-elevated)')}
            onBlur={(e) => (e.target.style.background = 'transparent')}
          />
        </div>

        {/* Autosave Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
          {saving ? (
            <>
              <RefreshCw size={13} className="spin" style={{ color: 'var(--accent-primary)' }} />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check size={13} style={{ color: 'var(--color-success)' }} />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Aspect Ratio & Undo/Redo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <select
          value={project.aspect_ratio}
          onChange={(e) => onUpdateAspectRatio(e.target.value as '16:9' | '9:16' | '1:1' | '4:5')}
          className="form-control"
          style={{ height: '34px', padding: '0 10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          <option value="16:9">16:9 Widescreen (YouTube, Cinema)</option>
          <option value="9:16">9:16 Vertical (Reels, TikTok, Shorts)</option>
          <option value="1:1">1:1 Square (Instagram Feed)</option>
          <option value="4:5">4:5 Social Portrait</option>
        </select>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)' }} />

        <button className="btn-icon" title="Undo (Cmd+Z)" onClick={onUndo}>
          <Undo2 size={16} />
        </button>
        <button className="btn-icon" title="Redo (Cmd+Y)" onClick={onRedo}>
          <Redo2 size={16} />
        </button>
      </div>

      {/* Right: Shortcuts & Primary Export CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button className="btn-icon" title="Keyboard Shortcuts (?)" onClick={onOpenShortcuts}>
          <HelpCircle size={18} />
        </button>

        <button className="btn btn-primary" onClick={onOpenExport} style={{ height: '36px', padding: '0 18px', fontWeight: 700 }}>
          <Download size={16} />
          <span>Export Video</span>
        </button>
      </div>
    </header>
  );
};
