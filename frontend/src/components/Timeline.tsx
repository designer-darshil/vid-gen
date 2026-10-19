import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Scissors, Copy, Trash2, Plus, Magnet, ChevronDown, ChevronUp, ZoomIn, ZoomOut, Music } from 'lucide-react';
import { Project, TimelineClip, LyricLine } from '../types';
import { API } from '../services/api';

interface TimelineProps {
  project: Project;
  currentTime: number;
  onSeek: (time: number) => void;
  onUpdateLyrics: (lines: LyricLine[]) => void;
  onUpdateTimelineData: (tracks: Project['timeline_data']['tracks']) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  project,
  currentTime,
  onSeek,
  onUpdateLyrics,
  onUpdateTimelineData
}) => {
  const rulerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(240);
  const [zoom, setZoom] = useState(80); // pixels per second
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const totalDuration = Math.max(30, project.audio_asset?.duration || project.duration || 60);
  const timelineWidth = Math.max(800, totalDuration * zoom);

  // Load waveform peaks when audio asset changes
  useEffect(() => {
    if (project.audio_asset_id) {
      API.getWaveform(project.audio_asset_id)
        .then((res) => {
          if (res.peaks) setWaveformPeaks(res.peaks);
        })
        .catch(() => {
          setWaveformPeaks([]);
        });
    } else {
      setWaveformPeaks([]);
    }
  }, [project.audio_asset_id]);

  // Draw Ruler
  useEffect(() => {
    const canvas = rulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = timelineWidth;
    canvas.height = 28;

    ctx.fillStyle = '#112338';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const stepSec = zoom >= 120 ? 1 : zoom >= 60 ? 5 : 10;
    ctx.fillStyle = '#8C9EB5';
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';

    for (let sec = 0; sec <= totalDuration; sec += stepSec) {
      const x = sec * zoom;
      ctx.strokeStyle = '#284A73';
      ctx.lineWidth = 1;

      // Major tick
      ctx.beginPath();
      ctx.moveTo(x, 14);
      ctx.lineTo(x, 28);
      ctx.stroke();

      // Timestamp label
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      ctx.fillText(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`, x + 4, 10);

      // Minor sub-second ticks
      if (stepSec > 1) {
        const subStep = stepSec === 5 ? 1 : 2;
        for (let sub = sec + subStep; sub < sec + stepSec && sub <= totalDuration; sub += subStep) {
          const subX = sub * zoom;
          ctx.beginPath();
          ctx.moveTo(subX, 20);
          ctx.lineTo(subX, 28);
          ctx.stroke();
        }
      }
    }
  }, [timelineWidth, zoom, totalDuration]);

  // Draw Audio Waveform
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = timelineWidth;
    canvas.height = 44;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (waveformPeaks.length > 0) {
      const totalPeaks = waveformPeaks.length;
      const barWidth = 2.5;
      const spacing = 1.0;
      const step = (barWidth + spacing);
      const numBars = Math.floor(timelineWidth / step);

      const midY = canvas.height / 2;
      const maxH = canvas.height * 0.42;

      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#B6FF3B');
      grad.addColorStop(0.5, '#38BDF8');
      grad.addColorStop(1, '#B6FF3B');

      ctx.fillStyle = grad;

      for (let i = 0; i < numBars; i++) {
        const peakIdx = Math.floor((i / numBars) * totalPeaks);
        const amp = waveformPeaks[peakIdx] || 0.1;
        const h = Math.max(3, amp * maxH);
        const x = i * step;

        ctx.fillRect(x, midY - h, barWidth, h * 2);
      }
    } else {
      // Honest Empty State
      ctx.strokeStyle = 'rgba(91, 114, 141, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'var(--text-muted)';
      ctx.font = '500 12px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        '✦ No Audio Track Connected • Upload Song Audio in Media Drawer to Display Waveform',
        24,
        canvas.height / 2 - 1
      );
    }
  }, [timelineWidth, waveformPeaks]);

  // Playhead scrub handler
  const handleRulerScrub = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left + container.scrollLeft;
    const newTime = Math.max(0, Math.min(totalDuration, clickX / zoom));
    onSeek(newTime);
  }, [totalDuration, zoom, onSeek]);

  // Split selected clip
  const handleSplitClip = () => {
    if (!selectedClipId) return;
    const tracks = [...(project.timeline_data?.tracks || [])];
    tracks.forEach((track) => {
      const idx = track.clips.findIndex((c) => c.id === selectedClipId);
      if (idx !== -1) {
        const clip = track.clips[idx];
        if (currentTime > clip.start && currentTime < clip.end) {
          const firstPart: TimelineClip = { ...clip, end: currentTime };
          const secondPart: TimelineClip = {
            ...clip,
            id: 'clip_' + Date.now(),
            start: currentTime
          };
          track.clips.splice(idx, 1, firstPart, secondPart);
          onUpdateTimelineData(tracks);
        }
      }
    });
  };

  // Delete selected clip
  const handleDeleteClip = () => {
    if (!selectedClipId) return;
    const tracks = [...(project.timeline_data?.tracks || [])];
    tracks.forEach((track) => {
      track.clips = track.clips.filter((c) => c.id !== selectedClipId);
    });
    onUpdateTimelineData(tracks);
    setSelectedClipId(null);
  };

  const playheadX = currentTime * zoom;

  return (
    <footer
      style={{
        height: isCollapsed ? '44px' : `${timelineHeight}px`,
        background: 'var(--surface-primary)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 25,
        flexShrink: 0,
        transition: 'height 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Resizer Handle */}
      {!isCollapsed && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            cursor: 'row-resize',
            zIndex: 35
          }}
          onMouseDown={(e) => {
            const startY = e.clientY;
            const startH = timelineHeight;
            const onMove = (me: MouseEvent) => {
              const delta = startY - me.clientY;
              setTimelineHeight(Math.max(160, Math.min(500, startH + delta)));
            };
            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
        />
      )}

      {/* Timeline Toolbar */}
      <div
        style={{
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
          background: 'var(--surface-primary)',
          flexShrink: 0
        }}
      >
        {/* Left Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            className="btn btn-secondary btn-icon"
            style={{ width: '32px', height: '32px' }}
            title="Split Clip at Playhead (S)"
            onClick={handleSplitClip}
            disabled={!selectedClipId}
          >
            <Scissors size={15} />
          </button>
          <button
            className="btn btn-secondary btn-icon"
            style={{ width: '32px', height: '32px' }}
            title="Duplicate Clip"
            onClick={() => {
              if (!selectedClipId) return;
              const tracks = [...(project.timeline_data?.tracks || [])];
              tracks.forEach((track) => {
                const clip = track.clips.find((c) => c.id === selectedClipId);
                if (clip) {
                  const dur = clip.end - clip.start;
                  track.clips.push({
                    ...clip,
                    id: 'clip_' + Date.now(),
                    start: clip.end,
                    end: clip.end + dur
                  });
                }
              });
              onUpdateTimelineData(tracks);
            }}
            disabled={!selectedClipId}
          >
            <Copy size={15} />
          </button>
          <button
            className="btn btn-secondary btn-icon"
            style={{ width: '32px', height: '32px', color: 'var(--color-error)' }}
            title="Delete Selected Clip (Del)"
            onClick={handleDeleteClip}
            disabled={!selectedClipId}
          >
            <Trash2 size={15} />
          </button>

          <button
            className="btn btn-secondary"
            style={{ height: '32px', fontSize: '12px', padding: '0 10px' }}
            title="Add Lyric Marker at Playhead"
            onClick={() => {
              const lines = [...(project.lyrics_data || [])];
              lines.push({
                start: Math.round(currentTime * 10) / 10,
                end: Math.round((currentTime + 4.0) * 10) / 10,
                text: 'New lyric verse line'
              });
              lines.sort((a, b) => a.start - b.start);
              onUpdateLyrics(lines);
            }}
          >
            <Plus size={14} />
            <span>Add Lyric Cue</span>
          </button>

          <button
            className={`btn-icon ${snapEnabled ? 'active' : ''}`}
            style={{ width: '32px', height: '32px' }}
            title="Toggle Magnetic Snap"
            onClick={() => setSnapEnabled(!snapEnabled)}
          >
            <Magnet size={15} />
          </button>
        </div>

        {/* Right Tools: Zoom & Collapse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn-icon"
            style={{ width: '28px', height: '28px' }}
            onClick={() => setZoom((z) => Math.max(30, z - 20))}
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <input
            type="range"
            min="30"
            max="250"
            value={zoom}
            onChange={(e) => setZoom(parseInt(e.target.value))}
            style={{ width: '90px' }}
            title="Timeline Zoom"
          />
          <button
            className="btn-icon"
            style={{ width: '28px', height: '28px' }}
            onClick={() => setZoom((z) => Math.min(250, z + 20))}
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>

          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ height: '28px', fontSize: '12px', padding: '0 8px' }}
            title={isCollapsed ? 'Expand Timeline' : 'Collapse Timeline'}
          >
            {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>{isCollapsed ? 'Timeline' : 'Collapse'}</span>
          </button>
        </div>
      </div>

      {/* Timeline Multitrack Body */}
      {!isCollapsed && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          {/* Fixed Track Headers */}
          <div
            style={{
              width: '180px',
              background: 'var(--surface-primary)',
              borderRight: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              zIndex: 15
            }}
          >
            {/* Ruler Header Space */}
            <div style={{ height: '28px', borderBottom: '1px solid var(--border-subtle)' }} />

            {/* Lyric Track Header */}
            <div style={{ height: '52px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
              <span>Lyric Cues</span>
            </div>

            {/* Images Track Header */}
            <div style={{ height: '52px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-info)' }} />
              <span>Artwork / B-Roll</span>
            </div>

            {/* Audio Track Header */}
            <div style={{ height: '52px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
              <Music size={14} style={{ color: 'var(--color-success)' }} />
              <span>Master Audio</span>
            </div>
          </div>

          {/* Scrollable Tracks & Playhead Area */}
          <div
            ref={scrollContainerRef}
            style={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              position: 'relative',
              background: '#07101B'
            }}
            onMouseDown={() => setIsScrubbing(true)}
            onMouseUp={() => setIsScrubbing(false)}
            onMouseMove={(e) => {
              if (isScrubbing) handleRulerScrub(e);
            }}
            onClick={handleRulerScrub}
          >
            <div style={{ width: `${timelineWidth}px`, height: '100%', position: 'relative' }}>
              {/* Ruler Bar */}
              <div style={{ height: '28px', borderBottom: '1px solid var(--border-subtle)' }}>
                <canvas ref={rulerCanvasRef} style={{ display: 'block', height: '28px' }} />
              </div>

              {/* Lane 1: Lyrics Cues Lane */}
              <div style={{ height: '52px', borderBottom: '1px solid var(--border-subtle)', position: 'relative', padding: '6px 0' }}>
                {(project.lyrics_data || []).map((line, idx) => {
                  const left = line.start * zoom;
                  const width = Math.max(30, (line.end - line.start) * zoom);
                  const isSelected = selectedClipId === `lyric_${idx}`;
                  const isCurrent = currentTime >= line.start && currentTime <= line.end;

                  return (
                    <div
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClipId(`lyric_${idx}`);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${left}px`,
                        width: `${width}px`,
                        height: '40px',
                        background: isCurrent ? 'rgba(182, 255, 59, 0.22)' : 'rgba(22, 44, 70, 0.95)',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--accent-primary)' : isCurrent ? 'rgba(182, 255, 59, 0.55)' : 'var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        boxShadow: isSelected ? '0 0 12px rgba(182, 255, 59, 0.4)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 600, color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {line.text}
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginLeft: '6px' }}>
                        {(line.end - line.start).toFixed(1)}s
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Lane 2: Image / Artwork Lane */}
              <div style={{ height: '52px', borderBottom: '1px solid var(--border-subtle)', position: 'relative', padding: '6px 0' }}>
                {(project.timeline_data?.tracks?.find((t) => t.type === 'image')?.clips || []).map((clip) => {
                  const left = clip.start * zoom;
                  const width = Math.max(30, (clip.end - clip.start) * zoom);
                  const isSelected = selectedClipId === clip.id;

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClipId(clip.id);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${left}px`,
                        width: `${width}px`,
                        height: '40px',
                        background: 'rgba(56, 189, 248, 0.16)',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--accent-primary)' : 'rgba(56, 189, 248, 0.45)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0 8px',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        overflow: 'hidden'
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-info)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {clip.title || 'Image Clip'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Lane 3: Audio Waveform Lane */}
              <div style={{ height: '52px', borderBottom: '1px solid var(--border-subtle)', position: 'relative' }}>
                <canvas ref={waveformCanvasRef} style={{ display: 'block', height: '52px' }} />
              </div>

              {/* Solar Lime Playhead Needle & Head */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${playheadX}px`,
                  width: '2px',
                  background: 'var(--accent-primary)',
                  boxShadow: '0 0 10px rgba(182, 255, 59, 0.8)',
                  pointerEvents: 'none',
                  zIndex: 30
                }}
              >
                {/* Diamond Cap */}
                <div
                  style={{
                    position: 'absolute',
                    top: '0',
                    left: '-6px',
                    width: '14px',
                    height: '14px',
                    background: 'var(--accent-primary)',
                    clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
