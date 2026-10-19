import { Project, Asset, RenderJob, AIProposal, LyricLine } from '../types';

function getCsrfToken(): string {
  const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
  if (meta && meta.content) return meta.content;

  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);

  return '';
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const csrf = getCsrfToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (csrf && !headers.has('X-CSRFToken')) {
    headers.set('X-CSRFToken', csrf);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const data = await response.json();
      if (data.error) errMessage = data.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(errMessage);
  }

  return response.json();
}

export const API = {
  // Projects
  async getProject(projectId: string): Promise<{ success: boolean; project: Project }> {
    return request<{ success: boolean; project: Project }>(`/api/projects/${projectId}`);
  },

  async updateProject(projectId: string, data: Partial<Project>): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Assets
  async uploadAsset(projectId: string, file: File, assetType: 'audio' | 'image' | 'lyrics'): Promise<{ success: boolean; asset: Asset }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('asset_type', assetType);

    return request<{ success: boolean; asset: Asset }>(`/api/projects/${projectId}/upload`, {
      method: 'POST',
      body: formData
    });
  },

  async deleteAsset(assetId: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/assets/${assetId}`, {
      method: 'DELETE'
    });
  },

  async getWaveform(assetId: string): Promise<{ success: boolean; peaks: number[] }> {
    return request<{ success: boolean; peaks: number[] }>(`/api/assets/${assetId}/waveform`);
  },

  // Lyrics & Sync
  async syncLyrics(projectId: string, text: string, format = 'auto'): Promise<{ success: boolean; lyrics: LyricLine[] }> {
    return request<{ success: boolean; lyrics: LyricLine[] }>(`/api/projects/${projectId}/sync`, {
      method: 'POST',
      body: JSON.stringify({ text, format })
    });
  },

  async transcribeLyrics(projectId: string): Promise<{ success: boolean; lyrics: LyricLine[] }> {
    return request<{ success: boolean; lyrics: LyricLine[] }>(`/api/projects/${projectId}/transcribe`, {
      method: 'POST'
    });
  },

  async applySyncOffset(projectId: string, offset: number): Promise<{ success: boolean; lyrics: LyricLine[] }> {
    return request<{ success: boolean; lyrics: LyricLine[] }>(`/api/projects/${projectId}/sync/offset`, {
      method: 'POST',
      body: JSON.stringify({ offset })
    });
  },

  // AI Creative Director
  async proposeAI(projectId: string): Promise<{ success: boolean; proposal: AIProposal; provider: string }> {
    return request<{ success: boolean; proposal: AIProposal; provider: string }>(`/api/projects/${projectId}/ai/propose`, {
      method: 'POST'
    });
  },

  async applyAIProposal(projectId: string, proposal: AIProposal): Promise<{ success: boolean; template_data: Record<string, unknown> }> {
    return request<{ success: boolean; template_data: Record<string, unknown> }>(`/api/projects/${projectId}/ai/apply`, {
      method: 'POST',
      body: JSON.stringify({ proposal })
    });
  },

  // Conversational AI Editor (OpusClip Producer Mode)
  async chatWithAI(projectId: string, message: string, currentTime = 0): Promise<{
    success: boolean;
    action: string;
    summary: string;
    applied_changes: Array<{ field: string; old_value: any; new_value: any; description: string }>;
    project: Project;
    can_undo: boolean;
  }> {
    return request(`/api/projects/${projectId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, current_time: currentTime })
    });
  },

  async getChatHistory(projectId: string): Promise<{
    success: boolean;
    history: Array<{ id: string; role: 'user' | 'assistant'; message: string; summary: string; applied_changes: any[]; created_at: string }>;
  }> {
    return request(`/api/projects/${projectId}/chat`);
  },

  async undoChatEdit(projectId: string): Promise<{
    success: boolean;
    action: string;
    summary: string;
    project: Project;
    can_undo: boolean;
  }> {
    return request(`/api/projects/${projectId}/chat/undo`, {
      method: 'POST'
    });
  },

  // Render & Export
  async triggerRender(projectId: string, resolution = '1080p', fps = 30): Promise<{ success: boolean; job_id: string }> {
    return request<{ success: boolean; job_id: string }>(`/api/projects/${projectId}/render`, {
      method: 'POST',
      body: JSON.stringify({ resolution, fps })
    });
  },

  async getRenderStatus(jobId: string): Promise<{ success: boolean; job: any }> {
    return request<{ success: boolean; job: any }>(`/api/renders/${jobId}/status`);
  },

  // Direct helpers
  async getProjectData(projectId: string): Promise<Project> {
    const res = await this.getProject(projectId);
    return res.project;
  },

  async saveProject(project: Project): Promise<Project> {
    await this.updateProject(project.id, {
      title: project.title,
      aspect_ratio: project.aspect_ratio,
      lyrics_data: project.lyrics_data,
      timeline_data: project.timeline_data,
      template_data: project.template_data,
    });
    return project;
  },

  async triggerExport(projectId: string, options: { resolution?: string; fps?: number; aspect_ratio?: string }): Promise<RenderJob> {
    const res = await this.triggerRender(projectId, options.resolution || '1080p', options.fps || 30);
    return {
      id: res.job_id,
      project_id: projectId,
      status: 'pending',
      progress: 0,
      output_resolution: options.resolution || '1080p',
      fps: options.fps || 30,
      output_format: 'mp4'
    };
  },

  async getExportStatus(jobId: string): Promise<RenderJob> {
    const res = await this.getRenderStatus(jobId);
    const j = res.job || {};
    return {
      id: j.id || jobId,
      project_id: j.project_id || '',
      status: j.status || 'pending',
      progress: j.progress || 0,
      output_resolution: j.output_resolution,
      fps: j.fps,
      output_format: j.output_format || 'mp4',
      output_file: j.output_file,
      error_message: j.error_message,
      error: j.error_message,
      video_url: j.download_url || `/api/renders/${jobId}/download`,
      message: j.status === 'rendering' ? `Rendering video (${j.progress || 0}%)` : (j.status === 'completed' ? 'Render complete' : undefined)
    };
  }
};

export const api = API;


