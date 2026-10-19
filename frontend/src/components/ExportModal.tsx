import React, { useState, useEffect } from 'react';
import { X, Film, CheckCircle2, AlertCircle, Loader2, Download, Sparkles, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { RenderJob } from '../types';

interface ExportModalProps {
  projectId: string;
  projectTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  projectId,
  projectTitle,
  isOpen,
  onClose,
}) => {
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [fps, setFps] = useState<number>(30);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [job, setJob] = useState<RenderJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll job status if a job is active and processing
  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const updated = await api.getExportStatus(job.id);
        setJob(updated);
      } catch (err: any) {
        console.error('Failed to poll export status:', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [job]);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    try {
      setIsStarting(true);
      setError(null);
      const newJob = await api.triggerExport(projectId, {
        resolution,
        fps,
        aspect_ratio: aspectRatio,
      });
      setJob(newJob);
    } catch (err: any) {
      setError(err.message || 'Failed to start video export.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleReset = () => {
    setJob(null);
    setError(null);
  };

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
        if (e.target === e.currentTarget && (!job || job.status !== 'processing')) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--ls-bg-surface-1)',
          border: '1px solid var(--ls-border-subtle)',
          borderRadius: 'var(--ls-radius-lg)',
          boxShadow: 'var(--ls-shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
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
              <Film size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ls-text-primary)' }}>
                Export Animated Lyric Video
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--ls-text-muted)' }}>
                {projectTitle} • FFmpeg 1080p Canvas Engine
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
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--ls-radius-md)',
                color: '#f87171',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!job ? (
            /* Export Settings Form */
            <>
              {/* Resolution selection */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ls-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                  Resolution
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: '720p', label: '720p HD', desc: 'Fast render' },
                    { id: '1080p', label: '1080p Full HD', desc: 'Recommended' },
                    { id: '4k', label: '4K Ultra', desc: 'Master quality' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setResolution(item.id as any)}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--ls-radius-md)',
                        border: resolution === item.id ? '1px solid var(--ls-accent)' : '1px solid var(--ls-border-subtle)',
                        backgroundColor: resolution === item.id ? 'var(--ls-accent-glow)' : 'var(--ls-bg-surface-2)',
                        color: resolution === item.id ? 'var(--ls-accent)' : 'var(--ls-text-secondary)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.label}</span>
                      <span style={{ fontSize: '10px', opacity: 0.7 }}>{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Framerate & Aspect Ratio */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ls-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                    Frame Rate
                  </label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--ls-bg-surface-2)',
                      border: '1px solid var(--ls-border-subtle)',
                      borderRadius: 'var(--ls-radius-md)',
                      color: 'var(--ls-text-primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={24}>24 fps (Cinematic)</option>
                    <option value={30}>30 fps (Standard Web)</option>
                    <option value={60}>60 fps (Ultra Smooth)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ls-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                    Aspect Ratio
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--ls-bg-surface-2)',
                      border: '1px solid var(--ls-border-subtle)',
                      borderRadius: 'var(--ls-radius-md)',
                      color: 'var(--ls-text-primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="16:9">16:9 Landscape (YouTube)</option>
                    <option value="9:16">9:16 Vertical (Reels / TikTok)</option>
                    <option value="1:1">1:1 Square (Feed)</option>
                  </select>
                </div>
              </div>

              {/* Features summary note */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--ls-radius-md)',
                  backgroundColor: 'rgba(182, 255, 59, 0.05)',
                  border: '1px solid rgba(182, 255, 59, 0.2)',
                  fontSize: '11px',
                  lineHeight: '1.5',
                  color: 'var(--ls-text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <Sparkles size={16} style={{ color: 'var(--ls-accent)', flexShrink: 0, marginTop: '2px' }} />
                <span>
                  High-fidelity server-side render will preserve your synced kinetic lyric animations, Ken Burns zoom moves, typography effects, and high-bitrate AAC audio master. 100% watermark-free.
                </span>
              </div>
            </>
          ) : (
            /* Job Progress / Complete Screen */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center', padding: '10px 0' }}>
              {job.status === 'processing' || job.status === 'pending' ? (
                <>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(182, 255, 59, 0.1)',
                      border: '2px solid var(--ls-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--ls-accent)',
                      animation: 'spin 2s linear infinite',
                    }}
                  >
                    <Loader2 size={28} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ls-text-primary)', marginBottom: '4px' }}>
                      Rendering Video Master...
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--ls-text-muted)' }}>
                      {job.message || 'Compositing lyric overlays, effects, and audio track'}
                    </p>
                  </div>
                  <div style={{ width: '100%', maxWidth: '380px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ls-text-muted)', marginBottom: '6px' }}>
                      <span>Progress</span>
                      <span style={{ color: 'var(--ls-accent)', fontWeight: 600 }}>{job.progress}%</span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '6px',
                        backgroundColor: 'var(--ls-bg-surface-3)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${job.progress}%`,
                          backgroundColor: 'var(--ls-accent)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : job.status === 'completed' ? (
                <>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(182, 255, 59, 0.15)',
                      border: '2px solid var(--ls-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--ls-accent)',
                    }}
                  >
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ls-text-primary)', marginBottom: '4px' }}>
                      Export Completed!
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--ls-text-secondary)' }}>
                      Your high-definition lyric video has been encoded and is ready to download.
                    </p>
                  </div>

                  <a
                    href={job.video_url || `/api/export/${job.id}/download`}
                    download={`${projectTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_1080p.mp4`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      backgroundColor: 'var(--ls-accent)',
                      color: 'var(--ls-accent-text)',
                      borderRadius: 'var(--ls-radius-md)',
                      fontWeight: 600,
                      fontSize: '13px',
                      textDecoration: 'none',
                      marginTop: '8px',
                      boxShadow: '0 4px 14px rgba(182, 255, 59, 0.3)',
                    }}
                  >
                    <Download size={18} />
                    Download MP4 Video
                  </a>
                </>
              ) : (
                /* Failed state */
                <>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      border: '2px solid #ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ef4444',
                    }}
                  >
                    <AlertCircle size={32} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ls-text-primary)', marginBottom: '4px' }}>
                      Export Failed
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--ls-text-secondary)' }}>
                      {job.error || 'An error occurred during video rendering.'}
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: 'var(--ls-bg-surface-2)',
                      border: '1px solid var(--ls-border-subtle)',
                      borderRadius: 'var(--ls-radius-md)',
                      color: 'var(--ls-text-primary)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={14} /> Try Again
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--ls-border-subtle)',
            backgroundColor: 'var(--ls-bg-surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          {!job || job.status === 'completed' || job.status === 'failed' ? (
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--ls-radius-md)',
                border: '1px solid var(--ls-border-subtle)',
                backgroundColor: 'transparent',
                color: 'var(--ls-text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          ) : null}

          {!job && (
            <button
              onClick={handleStartExport}
              disabled={isStarting}
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--ls-radius-md)',
                border: 'none',
                backgroundColor: 'var(--ls-accent)',
                color: 'var(--ls-accent-text)',
                fontWeight: 600,
                fontSize: '12px',
                cursor: isStarting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isStarting ? 0.7 : 1,
              }}
            >
              {isStarting ? <Loader2 size={14} className="spin" /> : <Film size={14} />}
              Start Render
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
