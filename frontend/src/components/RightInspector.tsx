import React, { useState } from 'react';
import { ChevronRight, Sliders, Film, Mountain, Layers, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { Project, TemplateConfig } from '../types';

interface RightInspectorProps {
  project: Project;
  onUpdateTemplate: (updates: Partial<TemplateConfig>) => void;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

export const RightInspector: React.FC<RightInspectorProps> = ({
  project,
  onUpdateTemplate,
  isOpen,
  onToggle
}) => {
  const [tab, setTab] = useState<'layer' | 'motion' | 'backdrop' | 'project'>('layer');
  const cfg = project.template_data || {};

  if (!isOpen) {
    return (
      <button
        className="btn-icon"
        style={{
          position: 'absolute',
          right: '12px',
          top: '68px',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 20
        }}
        onClick={() => onToggle(true)}
        title="Open Properties Inspector"
      >
        <Sliders size={16} />
      </button>
    );
  }

  return (
    <aside
      style={{
        width: '320px',
        background: 'var(--surface-primary)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 20,
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Inspector Header & Tab Switcher */}
      <div
        style={{
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          gap: '4px'
        }}
      >
        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
          {(['layer', 'motion', 'backdrop', 'project'] as const).map((t) => {
            const isActive = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  height: '32px',
                  background: isActive ? 'rgba(182, 255, 59, 0.08)' : 'transparent',
                  border: '1px solid',
                  borderColor: isActive ? 'rgba(182, 255, 59, 0.35)' : 'transparent',
                  borderRadius: 'var(--radius-sm)',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {t === 'backdrop' ? 'Backdrop' : t}
              </button>
            );
          })}
        </div>

        <button className="btn-icon" onClick={() => onToggle(false)} title="Collapse Inspector" style={{ width: '28px', height: '28px' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Tab Panels */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* 1. LAYER TAB */}
        {tab === 'layer' && (
          <>
            {/* Section 1: Canvas Placement */}
            <div style={{ padding: '14px', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={14} style={{ color: 'var(--accent-primary)' }} />
                Canvas Placement
              </span>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Vertical Position (Y)</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.position_y !== undefined ? cfg.position_y : 78}%</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="92"
                  value={cfg.position_y !== undefined ? cfg.position_y : 78}
                  onChange={(e) => onUpdateTemplate({ position_y: parseInt(e.target.value) })}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Horizontal Position (X)</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.position_x !== undefined ? cfg.position_x : 50}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={cfg.position_x !== undefined ? cfg.position_x : 50}
                  onChange={(e) => onUpdateTemplate({ position_x: parseInt(e.target.value) })}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>
            </div>

            {/* Section 2: Typography & Layout */}
            <div style={{ padding: '14px', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Typography & Layout
              </span>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Font Family</label>
                <select
                  value={cfg.font_family || "'Cinzel', serif"}
                  onChange={(e) => onUpdateTemplate({ font_family: e.target.value })}
                  className="form-control"
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <optgroup label="Editorial Serif">
                    <option value="'Playfair Display', serif">Playfair Display</option>
                    <option value="'Cinzel', serif">Cinzel (Cinematic)</option>
                    <option value="'Fraunces', serif">Fraunces</option>
                    <option value="'Cormorant Garamond', serif">Cormorant Garamond</option>
                  </optgroup>
                  <optgroup label="Modern Sans & Grotesk">
                    <option value="'Inter', sans-serif">Inter</option>
                    <option value="'Geist', sans-serif">Geist</option>
                    <option value="'Outfit', sans-serif">Outfit</option>
                    <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
                    <option value="'Syne', sans-serif">Syne</option>
                  </optgroup>
                  <optgroup label="Monospace">
                    <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Font Size</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.font_size || 48}pt</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                  <input
                    type="range"
                    min="20"
                    max="120"
                    value={cfg.font_size || 48}
                    onChange={(e) => onUpdateTemplate({ font_size: parseInt(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min="20"
                    max="140"
                    value={cfg.font_size || 48}
                    onChange={(e) => onUpdateTemplate({ font_size: parseInt(e.target.value) || 48 })}
                    className="form-control"
                    style={{ width: '60px', height: '30px', textAlign: 'center', padding: '0 4px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Alignment</label>
                <div style={{ display: 'flex', background: 'var(--surface-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', marginTop: '4px', overflow: 'hidden' }}>
                  {(['left', 'center', 'right'] as const).map((align) => {
                    const isSelected = (cfg.text_align || 'center') === align;
                    return (
                      <button
                        key={align}
                        onClick={() => onUpdateTemplate({ text_align: align })}
                        style={{
                          flex: 1,
                          height: '32px',
                          background: isSelected ? 'var(--surface-hover)' : 'transparent',
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {align === 'left' && <AlignLeft size={16} />}
                        {align === 'center' && <AlignCenter size={16} />}
                        {align === 'right' && <AlignRight size={16} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 3: Text Styling & Illumination */}
            <div style={{ padding: '14px', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Text Styling & Illumination
              </span>

              {/* Primary Fill */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Primary Text Fill</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={cfg.text_color || '#F5F8FA'}
                    onChange={(e) => onUpdateTemplate({ text_color: e.target.value })}
                    style={{ width: '28px', height: '28px', padding: 0, border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{(cfg.text_color || '#F5F8FA').toUpperCase()}</span>
                </div>
              </div>

              {/* Highlight Wipe Color */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Highlight / Wipe Accent</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={cfg.highlight_color || '#B6FF3B'}
                    onChange={(e) => onUpdateTemplate({ highlight_color: e.target.value })}
                    style={{ width: '28px', height: '28px', padding: 0, border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{(cfg.highlight_color || '#B6FF3B').toUpperCase()}</span>
                </div>
              </div>

              {/* Outline Stroke */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Outline Stroke</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={cfg.outline_color || '#0C1A2B'}
                    onChange={(e) => onUpdateTemplate({ outline_color: e.target.value })}
                    style={{ width: '28px', height: '28px', padding: 0, border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{(cfg.outline_color || '#0C1A2B').toUpperCase()}</span>
                </div>
              </div>

              {/* Outline Width */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Outline Width</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.outline_width !== undefined ? cfg.outline_width : 2}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  value={cfg.outline_width !== undefined ? cfg.outline_width : 2}
                  onChange={(e) => onUpdateTemplate({ outline_width: parseInt(e.target.value) })}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>

              {/* Glow Bloom Color */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Glow Bloom Color</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={cfg.glow_color || '#B6FF3B'}
                    onChange={(e) => onUpdateTemplate({ glow_color: e.target.value })}
                    style={{ width: '28px', height: '28px', padding: 0, border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{(cfg.glow_color || '#B6FF3B').toUpperCase()}</span>
                </div>
              </div>

              {/* Glow Intensity */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Glow Bloom Intensity</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.glow_size !== undefined ? cfg.glow_size : 18}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="45"
                  value={cfg.glow_size !== undefined ? cfg.glow_size : 18}
                  onChange={(e) => onUpdateTemplate({ glow_size: parseInt(e.target.value) })}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>
            </div>
          </>
        )}

        {/* 2. MOTION TAB */}
        {tab === 'motion' && (
          <>
            <div style={{ padding: '14px', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Film size={14} style={{ color: 'var(--accent-primary)' }} />
                Motion Preset & Direction
              </span>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Motion Style</label>
                <select
                  value={cfg.animation_type || 'cinematic-rise'}
                  onChange={(e) => onUpdateTemplate({ animation_type: e.target.value })}
                  className="form-control"
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="cinematic-rise">Slow Cinematic Rise</option>
                  <option value="blur-focus">Blur into Focus</option>
                  <option value="tracking-reveal">Tracking Reveal</option>
                  <option value="fade-darkness">Fade through Darkness</option>
                  <option value="beat-pulse">Beat-Reactive Pulse</option>
                  <option value="scale-drift">Subtle Scale & Drift</option>
                  <option value="word-highlight">Word-by-Word Highlight</option>
                  <option value="typewriter">Type-on</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Motion Direction</label>
                <select
                  value={cfg.animation_direction || 'up'}
                  onChange={(e) => onUpdateTemplate({ animation_direction: e.target.value as 'up' | 'down' | 'center' })}
                  className="form-control"
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="up">Upwards (Ascending)</option>
                  <option value="down">Downwards (Descending)</option>
                  <option value="center">Center Zoom</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Transition Duration</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.animation_duration || 0.45}s</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.05"
                  value={cfg.animation_duration || 0.45}
                  onChange={(e) => onUpdateTemplate({ animation_duration: parseFloat(e.target.value) })}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--surface-primary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Audio Beat Pulse</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bounce scale on vocal beats</div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(cfg.beat_pulse !== false)}
                  onChange={(e) => onUpdateTemplate({ beat_pulse: e.target.checked })}
                />
              </label>
            </div>
          </>
        )}

        {/* 3. BACKDROP TAB */}
        {tab === 'backdrop' && (
          <>
            <div style={{ padding: '14px', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mountain size={14} style={{ color: 'var(--accent-primary)' }} />
                Background Framing
              </span>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Image Fit Mode</label>
                <select
                  value={cfg.bg_fit || 'cover'}
                  onChange={(e) => onUpdateTemplate({ bg_fit: e.target.value as 'cover' | 'contain' })}
                  className="form-control"
                  style={{ width: '100%', marginTop: '4px' }}
                >
                  <option value="cover">Cover (Fill Canvas)</option>
                  <option value="contain">Contain (Letterboxed)</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Horizontal Pan</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.bg_pan_x || 0}%</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={cfg.bg_pan_x || 0}
                  onChange={(e) => onUpdateTemplate({ bg_pan_x: parseInt(e.target.value) })}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Vertical Pan</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.bg_pan_y || 0}%</span>
                </div>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={cfg.bg_pan_y || 0}
                  onChange={(e) => onUpdateTemplate({ bg_pan_y: parseInt(e.target.value) })}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Rotation</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.bg_rotation || 0}°</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  value={cfg.bg_rotation || 0}
                  onChange={(e) => onUpdateTemplate({ bg_rotation: parseInt(e.target.value) })}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Atmosphere & Lighting
              </span>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Overlay Dimming</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                    {Math.round((cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.38) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.9"
                  step="0.05"
                  value={cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.38}
                  onChange={(e) => onUpdateTemplate({ overlay_opacity: parseFloat(e.target.value) })}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Atmospheric Blur</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.bg_blur || 0}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  value={cfg.bg_blur || 0}
                  onChange={(e) => onUpdateTemplate({ bg_blur: parseInt(e.target.value) })}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Backdrop Tint Color</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={cfg.background_color || '#0C1A2B'}
                    onChange={(e) => onUpdateTemplate({ background_color: e.target.value })}
                    style={{ width: '28px', height: '28px', padding: 0, border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{(cfg.background_color || '#0C1A2B').toUpperCase()}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 4. PROJECT TAB */}
        {tab === 'project' && (
          <>
            <div style={{ padding: '14px', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Project Composition
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Format</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{project.aspect_ratio}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Canvas Width</span>
                  <span>{project.width} px</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Canvas Height</span>
                  <span>{project.height} px</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Export Frame Rate</span>
                  <span>{project.fps} FPS</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Duration</span>
                  <span>{Math.round(project.duration || 30)}s</span>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px', background: 'var(--surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Calibration & Subtitle Engine
              </span>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Audio Sync Latency Offset</span>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.sync_offset_ms || 0} ms</span>
                </div>
                <input
                  type="range"
                  min="-500"
                  max="500"
                  step="10"
                  value={cfg.sync_offset_ms || 0}
                  onChange={(e) => onUpdateTemplate({ sync_offset_ms: parseInt(e.target.value) })}
                  style={{ width: '100%', marginTop: '6px' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Fine-tune lyric cues against audio driver playback delay
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Rendering Engine</span>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Canvas2D + Web Audio</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtitle Standard</span>
                <span>SSA / ASS Karaoke</span>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
