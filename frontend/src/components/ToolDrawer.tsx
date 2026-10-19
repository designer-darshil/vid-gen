import React, { useState } from 'react';
import { X, Upload, Plus, Trash2, Wand2, Music, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { Project, LyricLine, TemplateConfig, AIProposal } from '../types';
import { ToolTab } from './ToolRail';

interface ToolDrawerProps {
  activeTab: ToolTab | null;
  project: Project;
  onClose: () => void;
  onUploadFile: (file: File, type: 'audio' | 'image' | 'lyrics') => Promise<void>;
  onDeleteAsset: (assetId: string) => Promise<void>;
  onAddImageToTimeline: (assetId: string, title: string) => void;
  onUpdateLyrics: (lines: LyricLine[]) => void;
  onSyncLyricsText: (text: string) => Promise<void>;
  onTranscribeVocals: () => Promise<void>;
  onUpdateTemplate: (updates: Partial<TemplateConfig>) => void;
  onProposeAI: () => Promise<AIProposal | null>;
  onApplyAIProposal: (proposal: AIProposal) => Promise<void>;
}

export const ToolDrawer: React.FC<ToolDrawerProps> = ({
  activeTab,
  project,
  onClose,
  onUploadFile,
  onDeleteAsset,
  onAddImageToTimeline,
  onUpdateLyrics,
  onSyncLyricsText,
  onTranscribeVocals,
  onUpdateTemplate,
  onProposeAI,
  onApplyAIProposal
}) => {
  const [lyricsInput, setLyricsInput] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProposal, setAiProposal] = useState<AIProposal | null>(null);

  if (!activeTab) return null;

  const cfg = project.template_data || {};

  return (
    <aside style={{
      width: '320px',
      background: 'var(--surface-elevated)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      zIndex: 20,
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Drawer Header */}
      <div style={{
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0
      }}>
        <span style={{ fontSize: '15px', fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
          {activeTab === 'ai' ? 'AI Creative Director' : activeTab}
        </span>
        <button className="btn-icon" onClick={onClose} title="Collapse Panel">
          <X size={16} />
        </button>
      </div>

      {/* Drawer Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 1. MEDIA TAB */}
        {activeTab === 'media' && (
          <>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Song Audio Track
              </span>
              <label style={{
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                background: 'var(--surface-primary)',
                border: '1.5px dashed var(--border-default)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'center',
                gap: '6px'
              }}>
                <Music size={24} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Upload Audio Track</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MP3, WAV, FLAC, M4A</span>
                <input
                  type="file"
                  accept="audio/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) onUploadFile(e.target.files[0], 'audio');
                  }}
                />
              </label>

              {project.audio_asset && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 12px',
                  background: 'var(--surface-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <Music size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {project.audio_asset.original_name}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {Math.round(project.audio_asset.duration || 0)}s
                  </span>
                </div>
              )}
            </div>

            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Background Artwork & B-Roll
              </span>
              <label style={{
                marginTop: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                background: 'var(--surface-primary)',
                border: '1.5px dashed var(--border-default)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'center',
                gap: '6px'
              }}>
                <ImageIcon size={24} style={{ color: 'var(--color-info)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Upload Image Artwork</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PNG, JPG, WebP (1080p+)</span>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) onUploadFile(e.target.files[0], 'image');
                  }}
                />
              </label>

              {/* Uploaded Images List */}
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(project.assets || []).filter((a) => a.asset_type === 'image').map((img) => (
                  <div key={img.id} style={{
                    padding: '8px 10px',
                    background: 'var(--surface-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <img
                        src={`/api/assets/${img.id}/file`}
                        alt={img.original_name}
                        style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {img.original_name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        className="btn btn-secondary btn-icon"
                        style={{ width: '28px', height: '28px' }}
                        title="Add to Timeline Track"
                        onClick={() => onAddImageToTimeline(img.id, img.original_name)}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        className="btn btn-secondary btn-icon"
                        style={{ width: '28px', height: '28px', color: 'var(--color-error)' }}
                        title="Delete Asset"
                        onClick={() => onDeleteAsset(img.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 2. LYRICS TAB */}
        {activeTab === 'lyrics' && (
          <>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Import Lyrics & Timecodes
              </span>
              <textarea
                value={lyricsInput}
                onChange={(e) => setLyricsInput(e.target.value)}
                placeholder="Paste lyrics or timed LRC / SRT subtitles here..."
                rows={5}
                className="form-control"
                style={{ width: '100%', marginTop: '8px', resize: 'vertical', fontSize: '13px' }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, height: '34px', fontSize: '13px' }}
                  disabled={isSyncing || !lyricsInput.trim()}
                  onClick={async () => {
                    setIsSyncing(true);
                    await onSyncLyricsText(lyricsInput);
                    setIsSyncing(false);
                    setLyricsInput('');
                  }}
                >
                  {isSyncing ? 'Aligning...' : 'Sync Lines'}
                </button>

                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, height: '34px', fontSize: '13px' }}
                  disabled={isTranscribing || !project.audio_asset}
                  title="Auto transcribe singing vocals using backend AI"
                  onClick={async () => {
                    setIsTranscribing(true);
                    await onTranscribeVocals();
                    setIsTranscribing(false);
                  }}
                >
                  <Wand2 size={14} />
                  <span>{isTranscribing ? 'Listening...' : 'Transcribe'}</span>
                </button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Synchronized Lines ({project.lyrics_data?.length || 0})
              </span>

              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(project.lyrics_data || []).map((line, idx) => (
                  <div key={idx} style={{
                    padding: '8px',
                    background: 'var(--surface-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>#{idx + 1}</span>
                      <span>{line.start.toFixed(1)}s — {line.end.toFixed(1)}s</span>
                    </div>
                    <input
                      type="text"
                      value={line.text}
                      onChange={(e) => {
                        const copy = [...project.lyrics_data];
                        copy[idx] = { ...copy[idx], text: e.target.value };
                        onUpdateLyrics(copy);
                      }}
                      className="form-control"
                      style={{ height: '30px', padding: '0 8px', fontSize: '13px' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 3. TYPOGRAPHY TAB */}
        {activeTab === 'typography' && (
          <>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Font Family
              </span>
              <select
                value={cfg.font_family || "'Cinzel', serif"}
                onChange={(e) => onUpdateTemplate({ font_family: e.target.value })}
                className="form-control"
                style={{ width: '100%', marginTop: '6px' }}
              >
                <optgroup label="Editorial Serif">
                  <option value="'Playfair Display', serif">Playfair Display</option>
                  <option value="'Cinzel', serif">Cinzel (Cinematic)</option>
                  <option value="'Fraunces', serif">Fraunces</option>
                  <option value="'Cormorant Garamond', serif">Cormorant Garamond</option>
                </optgroup>
                <optgroup label="Modern Sans & Display">
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                <span>Font Size</span>
                <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{cfg.font_size || 48}pt</span>
              </div>
              <input
                type="range"
                min="20"
                max="120"
                value={cfg.font_size || 48}
                onChange={(e) => onUpdateTemplate({ font_size: parseInt(e.target.value) })}
                style={{ width: '100%', marginTop: '6px' }}
              />
            </div>

            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Font Weight
              </span>
              <select
                value={cfg.font_weight || '700'}
                onChange={(e) => onUpdateTemplate({ font_weight: e.target.value })}
                className="form-control"
                style={{ width: '100%', marginTop: '6px' }}
              >
                <option value="400">Regular (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">SemiBold (600)</option>
                <option value="700">Bold (700)</option>
                <option value="800">ExtraBold (800)</option>
              </select>
            </div>
          </>
        )}

        {/* 4. BACKDROP TAB */}
        {activeTab === 'backdrop' && (
          <>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Image Fit Mode
              </span>
              <select
                value={cfg.bg_fit || 'cover'}
                onChange={(e) => onUpdateTemplate({ bg_fit: e.target.value as 'cover' | 'contain' })}
                className="form-control"
                style={{ width: '100%', marginTop: '6px' }}
              >
                <option value="cover">Cover (Fill Canvas)</option>
                <option value="contain">Contain (Letterboxed)</option>
              </select>
            </div>

            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Ken Burns Camera Motion
              </span>
              <select
                value={cfg.bg_zoom || 'zoom-in'}
                onChange={(e) => onUpdateTemplate({ bg_zoom: e.target.value as 'zoom-in' | 'zoom-out' | 'none' })}
                className="form-control"
                style={{ width: '100%', marginTop: '6px' }}
              >
                <option value="zoom-in">Slow Push In (+8%)</option>
                <option value="zoom-out">Slow Pull Out (-8%)</option>
                <option value="none">Static (No Motion)</option>
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
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
          </>
        )}

        {/* 5. MOTION TAB */}
        {activeTab === 'motion' && (
          <>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Animation Preset
              </span>
              <select
                value={cfg.animation_type || 'cinematic-rise'}
                onChange={(e) => onUpdateTemplate({ animation_type: e.target.value })}
                className="form-control"
                style={{ width: '100%', marginTop: '6px' }}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                <span>Transition Time</span>
                <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                  {cfg.animation_duration || 0.45}s
                </span>
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
          </>
        )}

        {/* 6. EFFECTS TAB */}
        {activeTab === 'effects' && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--surface-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Cinematic Letterbox</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>2.39:1 widescreen black film bars</div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(cfg.show_letterbox || cfg.template_id === 'midnight_cinema')}
                onChange={(e) => onUpdateTemplate({ show_letterbox: e.target.checked })}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--surface-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Audio Visualizer Spectrum</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bottom animated reactive frequency bars</div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(cfg.show_visualizer || cfg.template_id === 'visualizer')}
                onChange={(e) => onUpdateTemplate({ show_visualizer: e.target.checked })}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--surface-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Audio Beat Pulse</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rhythmic bounce on energetic vocal beats</div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(cfg.beat_pulse !== false)}
                onChange={(e) => onUpdateTemplate({ beat_pulse: e.target.checked })}
              />
            </label>
          </>
        )}

        {/* 7. AI STUDIO TAB */}
        {activeTab === 'ai' && (
          <>
            <div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                AI analyzes your audio tempo, lyric sentiment, and artwork palette to synthesize a bespoke cinematic composition.
              </p>
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '12px' }}
                disabled={aiLoading}
                onClick={async () => {
                  setAiLoading(true);
                  const prop = await onProposeAI();
                  setAiProposal(prop);
                  setAiLoading(false);
                }}
              >
                <Sparkles size={16} />
                <span>{aiLoading ? 'Synthesizing Proposal...' : 'Generate Direction'}</span>
              </button>
            </div>

            {aiProposal && (
              <div style={{ padding: '14px', background: 'var(--surface-primary)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                  Proposed: {aiProposal.preset}
                </span>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {aiProposal.rationale}
                </p>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', height: '34px', fontSize: '13px' }}
                  onClick={() => onApplyAIProposal(aiProposal)}
                >
                  <Check size={14} />
                  <span>Apply Proposal</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
