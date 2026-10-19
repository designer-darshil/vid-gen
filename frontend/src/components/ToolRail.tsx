import React from 'react';
import { Film, Music2, Type, Mountain, Sparkles, Wand2, Sliders } from 'lucide-react';

export type ToolTab = 'media' | 'lyrics' | 'typography' | 'backdrop' | 'motion' | 'effects' | 'ai';

interface ToolRailProps {
  activeTab: ToolTab | null;
  onSelectTab: (tab: ToolTab) => void;
}

export const ToolRail: React.FC<ToolRailProps> = ({ activeTab, onSelectTab }) => {
  const tools: { id: ToolTab; label: string; icon: React.ReactNode }[] = [
    { id: 'media', label: 'Media', icon: <Film size={18} /> },
    { id: 'lyrics', label: 'Lyrics', icon: <Music2 size={18} /> },
    { id: 'typography', label: 'Text', icon: <Type size={18} /> },
    { id: 'backdrop', label: 'Backdrop', icon: <Mountain size={18} /> },
    { id: 'motion', label: 'Motion', icon: <Sliders size={18} /> },
    { id: 'effects', label: 'Effects', icon: <Sparkles size={18} /> },
    { id: 'ai', label: 'AI Studio', icon: <Wand2 size={18} /> }
  ];

  return (
    <nav style={{
      width: '72px',
      background: 'var(--surface-primary)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 0',
      gap: '8px',
      flexShrink: 0,
      zIndex: 25
    }}>
      {tools.map((t) => {
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelectTab(t.id)}
            title={t.label}
            style={{
              width: '60px',
              height: '56px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: isActive ? 'rgba(182, 255, 59, 0.08)' : 'transparent',
              border: '1px solid',
              borderColor: isActive ? 'rgba(182, 255, 59, 0.35)' : 'transparent',
              borderRadius: 'var(--radius-md)',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              boxShadow: isActive ? '0 0 12px rgba(182, 255, 59, 0.12)' : 'none'
            }}
          >
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '14px',
                  bottom: '14px',
                  width: '3px',
                  background: 'var(--accent-primary)',
                  borderRadius: '0 2px 2px 0'
                }}
              />
            )}
            <div>{t.icon}</div>
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
