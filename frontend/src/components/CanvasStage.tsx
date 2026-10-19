import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, ShieldAlert } from 'lucide-react';
import { Project, TemplateConfig } from '../types';
import { CanvasRenderer } from '../services/canvasRenderer';

interface CanvasStageProps {
  project: Project;
  currentTime: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onUpdateTemplate: (updates: Partial<TemplateConfig>) => void;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  project,
  currentTime,
  isPlaying,
  onTogglePlay,
  onSeek,
  onUpdateTemplate
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<CanvasRenderer>(new CanvasRenderer());

  const [selectedLayer, setSelectedLayer] = useState<'lyric' | 'artwork' | null>('lyric');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initPosX: number; initPosY: number }>({ x: 0, y: 0, initPosX: 50, initPosY: 78 });
  const [snapGuideX, setSnapGuideX] = useState<number | null>(null);
  const [snapGuideY, setSnapGuideY] = useState<number | null>(null);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [isLooping, setIsLooping] = useState(true);

  const cfg = project.template_data || {};

  // Aspect ratio dimensions
  let aspectW = 1920;
  let aspectH = 1080;
  if (project.aspect_ratio === '9:16') {
    aspectW = 1080;
    aspectH = 1920;
  } else if (project.aspect_ratio === '1:1') {
    aspectW = 1080;
    aspectH = 1080;
  } else if (project.aspect_ratio === '4:5') {
    aspectW = 1080;
    aspectH = 1350;
  }

  // Preload assets
  useEffect(() => {
    rendererRef.current.preloadAssets(project, () => {
      renderCurrentFrame();
    });
  }, [project]);

  // Render loop
  const renderCurrentFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    rendererRef.current.drawFrame(
      ctx,
      canvas.width,
      canvas.height,
      project,
      currentTime,
      selectedLayer,
      snapGuideX,
      snapGuideY,
      showSafeArea
    );
  }, [project, currentTime, selectedLayer, snapGuideX, snapGuideY, showSafeArea]);

  useEffect(() => {
    renderCurrentFrame();
  }, [renderCurrentFrame]);

  // Drag interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    setIsDragging(true);
    setDragStart({
      x: mouseX,
      y: mouseY,
      initPosX: cfg.position_x !== undefined ? cfg.position_x : 50,
      initPosY: cfg.position_y !== undefined ? cfg.position_y : 78
    });
    setSelectedLayer('lyric');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const deltaX = ((mouseX - dragStart.x) / canvas.width) * 100;
    const deltaY = ((mouseY - dragStart.y) / canvas.height) * 100;

    let newX = Math.round(dragStart.initPosX + deltaX);
    let newY = Math.round(dragStart.initPosY + deltaY);

    // Magnetic center snap
    if (Math.abs(newX - 50) < 3) {
      newX = 50;
      setSnapGuideX(canvas.width / 2);
    } else {
      setSnapGuideX(null);
    }

    if (Math.abs(newY - 50) < 3) {
      newY = 50;
      setSnapGuideY(canvas.height / 2);
    } else {
      setSnapGuideY(null);
    }

    newX = Math.max(10, Math.min(90, newX));
    newY = Math.max(15, Math.min(92, newY));

    onUpdateTemplate({ position_x: newX, position_y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setSnapGuideX(null);
    setSnapGuideY(null);
  };

  // Time format
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const totalDuration = project.audio_asset?.duration || project.duration || 30;

  return (
    <main
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)',
        position: 'relative',
        minHeight: 0,
        overflow: 'hidden',
        padding: '24px'
      }}
      onMouseUp={handleMouseUp}
    >
      {/* Aspect Ratio Canvas Wrapper */}
      <div
        style={{
          width: '100%',
          height: '100%',
          maxHeight: 'calc(100% - 60px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        <div
          style={{
            aspectRatio: `${aspectW} / ${aspectH}`,
            maxHeight: '100%',
            maxWidth: '100%',
            position: 'relative',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.65)',
            border: '1px solid var(--border-subtle)',
            background: '#040810',
            overflow: 'hidden'
          }}
        >
          <canvas
            ref={canvasRef}
            width={aspectW}
            height={aspectH}
            style={{ width: '100%', height: '100%', display: 'block', cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
          />
        </div>
      </div>

      {/* Floating Viewport Transport Controls */}
      <div
        style={{
          height: '46px',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-full)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          marginTop: '12px',
          zIndex: 10
        }}
      >
        <button
          className="btn-icon"
          style={{
            background: 'var(--accent-primary)',
            color: 'var(--text-on-accent)',
            width: '32px',
            height: '32px',
            borderRadius: '50%'
          }}
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>

        <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />

        <button
          className={`btn-icon ${isLooping ? 'active' : ''}`}
          style={{ width: '30px', height: '30px' }}
          onClick={() => setIsLooping(!isLooping)}
          title="Loop Playback (L)"
        >
          <RotateCcw size={14} />
        </button>

        <button
          className={`btn-icon ${showSafeArea ? 'active' : ''}`}
          style={{ width: '30px', height: '30px' }}
          onClick={() => setShowSafeArea(!showSafeArea)}
          title="Toggle Title/Action Safe Area Guides"
        >
          <ShieldAlert size={14} />
        </button>
      </div>
    </main>
  );
};
