import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TopNav } from './components/TopNav';
import { ToolRail, ToolTab } from './components/ToolRail';
import { ToolDrawer } from './components/ToolDrawer';
import { CanvasStage } from './components/CanvasStage';
import { RightInspector } from './components/RightInspector';
import { Timeline } from './components/Timeline';
import { ExportModal } from './components/ExportModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Project, LyricLine, TemplateConfig, AIProposal } from './types';
import { API } from './services/api';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  // Determine projectId from window object, path (/editor/<id>), or search params
  const [projectId] = useState<string>(() => {
    if ((window as any).__INITIAL_PROJECT_ID__) {
      return (window as any).__INITIAL_PROJECT_ID__;
    }
    const match = window.location.pathname.match(/\/editor\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return match[1];
    const params = new URLSearchParams(window.location.search);
    return params.get('project_id') || 'proj-1';
  });

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Undo / Redo history
  const [history, setHistory] = useState<Project[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Workspace layout & selection state
  const [activeTool, setActiveTool] = useState<ToolTab | null>('media');
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Playback & timeline state
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Saving state
  const [saving, setSaving] = useState<boolean>(false);

  // Modals
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Audio element reference for playback synchronization
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper to push project state to history
  const commitProjectState = useCallback((newProject: Project) => {
    setProject(newProject);
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), newProject]);
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Load project data
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const res = await API.getProject(projectId);
        if (isMounted && res.project) {
          setProject(res.project);
          setHistory([res.project]);
          setHistoryIndex(0);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load project');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // Find audio file URL if available
  const audioAsset = project?.assets?.find((a) => a.asset_type === 'audio') || project?.audio_asset;
  const audioUrl = audioAsset ? `/api/assets/${audioAsset.id}/file` : null;

  // Initialize and synchronize HTMLAudioElement
  useEffect(() => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      const audio = new Audio();
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    if (audio.src !== window.location.origin + audioUrl && !audio.src.endsWith(audioUrl)) {
      audio.src = audioUrl;
      audio.load();
    }
  }, [audioUrl]);

  // Handle Play/Pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.currentTime = currentTime;
      audio.play().catch((err) => {
        console.warn('Audio playback prevented or delayed:', err);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Playback timer loop
  useEffect(() => {
    let animId: number;
    let lastTimestamp = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      if (isPlaying) {
        if (audioRef.current && !audioRef.current.paused) {
          setCurrentTime(audioRef.current.currentTime);
        } else {
          setCurrentTime((prev) => {
            const next = prev + dt;
            const duration = project?.duration || 30;
            if (next >= duration) {
              setIsPlaying(false);
              return 0;
            }
            return next;
          });
        }
      }

      animId = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      lastTimestamp = performance.now();
      animId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(animId);
  }, [isPlaying, project?.duration]);

  // Handle seek
  const handleSeek = useCallback(
    (time: number) => {
      const duration = project?.duration || 30;
      const clamped = Math.max(0, Math.min(time, duration));
      setCurrentTime(clamped);
      if (audioRef.current) {
        audioRef.current.currentTime = clamped;
      }
    },
    [project?.duration]
  );

  // Save project helper
  const handleSave = useCallback(async () => {
    if (!project) return;
    try {
      setSaving(true);
      await API.updateProject(project.id, {
        title: project.title,
        aspect_ratio: project.aspect_ratio,
        lyrics_data: project.lyrics_data,
        timeline_data: project.timeline_data,
        template_data: project.template_data,
      });
    } catch (err: any) {
      console.error('Failed to save project:', err);
    } finally {
      setSaving(false);
    }
  }, [project]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setProject(history[newIndex]);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setProject(history[newIndex]);
    }
  }, [historyIndex, history]);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const delta = e.shiftKey ? 5 : 1;
        handleSeek(currentTime - delta);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const delta = e.shiftKey ? 5 : 1;
        handleSeek(currentTime + delta);
      } else if (e.code === 'Home' || e.code === 'Digit0') {
        e.preventDefault();
        handleSeek(0);
      } else if (e.code === 'KeyM') {
        if (audioRef.current) {
          audioRef.current.muted = !audioRef.current.muted;
        }
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyS') {
        e.preventDefault();
        handleSave();
      } else if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, handleSeek, handleSave, handleUndo, handleRedo]);

  // Handlers for ToolDrawer
  const handleUploadFile = async (file: File, type: 'audio' | 'image' | 'lyrics') => {
    if (!project) return;
    const res = await API.uploadAsset(project.id, file, type);
    if (res.success && res.asset) {
      const updatedAssets = [...(project.assets || []), res.asset];
      const updatedProject = { ...project, assets: updatedAssets };
      commitProjectState(updatedProject);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!project) return;
    await API.deleteAsset(assetId);
    const updatedAssets = (project.assets || []).filter((a) => a.id !== assetId);
    commitProjectState({ ...project, assets: updatedAssets });
  };

  const handleAddImageToTimeline = (assetId: string, title: string) => {
    if (!project) return;
    const tracks = [...project.timeline_data.tracks];
    const imageTrack = tracks.find((t) => t.type === 'image');
    if (imageTrack) {
      imageTrack.clips.push({
        id: `clip_${Date.now()}`,
        asset_id: assetId,
        title: title,
        start: 0,
        end: project.duration || 30,
        opacity: 1,
      });
      commitProjectState({ ...project, timeline_data: { tracks } });
    }
  };

  const handleUpdateLyrics = (lines: LyricLine[]) => {
    if (!project) return;
    commitProjectState({ ...project, lyrics_data: lines });
  };

  const handleSyncLyricsText = async (text: string) => {
    if (!project) return;
    const res = await API.syncLyrics(project.id, text);
    if (res.success && res.lyrics) {
      commitProjectState({ ...project, lyrics_data: res.lyrics });
    }
  };

  const handleTranscribeVocals = async () => {
    if (!project) return;
    const res = await API.transcribeLyrics(project.id);
    if (res.success && res.lyrics) {
      commitProjectState({ ...project, lyrics_data: res.lyrics });
    }
  };

  const handleUpdateTemplate = (updates: Partial<TemplateConfig>) => {
    if (!project) return;
    const newTemplate = { ...project.template_data, ...updates };
    commitProjectState({ ...project, template_data: newTemplate });
  };

  const handleProposeAI = async (): Promise<AIProposal | null> => {
    if (!project) return null;
    const res = await API.proposeAI(project.id);
    return res.success ? res.proposal : null;
  };

  const handleApplyAIProposal = async (proposal: AIProposal) => {
    if (!project) return;
    const res = await API.applyAIProposal(project.id, proposal);
    if (res.success && res.template_data) {
      commitProjectState({ ...project, template_data: res.template_data as TemplateConfig });
    }
  };

  const handleUpdateTimelineData = (tracks: Project['timeline_data']['tracks']) => {
    if (!project) return;
    commitProjectState({ ...project, timeline_data: { tracks } });
  };

  const handleUpdateTitle = (title: string) => {
    if (!project) return;
    commitProjectState({ ...project, title });
  };

  const handleUpdateAspectRatio = (aspect_ratio: '16:9' | '9:16' | '1:1' | '4:5') => {
    if (!project) return;
    commitProjectState({ ...project, aspect_ratio });
  };

  if (loading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          backgroundColor: 'var(--ls-bg-canvas)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <div style={{ color: 'var(--ls-accent)', animation: 'spin 1.5s linear infinite' }}>
          <Loader2 size={40} />
        </div>
        <div style={{ color: 'var(--ls-text-secondary)', fontSize: '14px', fontWeight: 500 }}>
          Initializing LyricStudio Engine...
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          backgroundColor: 'var(--ls-bg-canvas)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '20px',
        }}
      >
        <div style={{ color: '#ef4444', fontSize: '18px', fontWeight: 600 }}>
          Unable to Load LyricStudio Project
        </div>
        <div style={{ color: 'var(--ls-text-muted)', fontSize: '13px', maxWidth: '400px', textAlign: 'center' }}>
          {error || 'Project not found.'}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '12px',
            padding: '10px 20px',
            backgroundColor: 'var(--ls-accent)',
            color: 'var(--ls-accent-text)',
            borderRadius: 'var(--ls-radius-md)',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--ls-bg-canvas)',
        color: 'var(--ls-text-primary)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* 1. TOP NAVIGATION BAR */}
      <TopNav
        project={project}
        saving={saving}
        onUpdateTitle={handleUpdateTitle}
        onUpdateAspectRatio={handleUpdateAspectRatio}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* 2. MIDDLE WORKSPACE */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          position: 'relative',
        }}
      >
        {/* Far-Left Tool Rail */}
        <ToolRail activeTab={activeTool} onSelectTab={setActiveTool} />

        {/* Collapsible Left Creative Drawer */}
        <ToolDrawer
          activeTab={activeTool}
          project={project}
          currentTime={currentTime}
          onClose={() => setActiveTool(null)}
          onUploadFile={handleUploadFile}
          onDeleteAsset={handleDeleteAsset}
          onAddImageToTimeline={handleAddImageToTimeline}
          onUpdateLyrics={handleUpdateLyrics}
          onSyncLyricsText={handleSyncLyricsText}
          onTranscribeVocals={handleTranscribeVocals}
          onUpdateTemplate={handleUpdateTemplate}
          onProposeAI={handleProposeAI}
          onApplyAIProposal={handleApplyAIProposal}
          onUpdateProject={(p) => commitProjectState(p)}
        />

        {/* Central Cinematic Canvas Stage */}
        <CanvasStage
          project={project}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onSeek={handleSeek}
          onUpdateTemplate={handleUpdateTemplate}
        />

        {/* Right Contextual Properties Inspector */}
        <RightInspector
          project={project}
          onUpdateTemplate={handleUpdateTemplate}
          isOpen={isInspectorOpen}
          onToggle={setIsInspectorOpen}
          selectedClipId={selectedClipId}
          onSelectClip={setSelectedClipId}
          onUpdateLyrics={handleUpdateLyrics}
          onUpdateTimelineData={handleUpdateTimelineData}
          onSeek={handleSeek}
          onUpdateProject={(p) => commitProjectState(p)}
        />
      </div>

      {/* 3. BOTTOM MULTI-TRACK TIMELINE */}
      <Timeline
        project={project}
        currentTime={currentTime}
        selectedClipId={selectedClipId}
        onSelectClip={setSelectedClipId}
        onSeek={handleSeek}
        onUpdateLyrics={handleUpdateLyrics}
        onUpdateTimelineData={handleUpdateTimelineData}
      />

      {/* 4. MODALS */}
      <ExportModal
        projectId={project.id}
        projectTitle={project.title}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};
