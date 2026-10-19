export interface LyricWord {
  word: string;
  start: number;
  end: number;
  score?: number;
}

export interface LyricLine {
  id?: string;
  start: number;
  end: number;
  text: string;
  words?: LyricWord[];
}

export interface TimelineClip {
  id: string;
  asset_id?: string;
  title?: string;
  start: number;
  end: number;
  opacity?: number;
  text?: string;
  words?: LyricWord[];
}

export interface TimelineTrack {
  id: string;
  type: 'lyrics' | 'image' | 'audio';
  name: string;
  clips: TimelineClip[];
  muted?: boolean;
  locked?: boolean;
}

export interface TimelineData {
  tracks: TimelineTrack[];
}

export interface TemplateConfig {
  template_id?: string;
  preset?: string;
  font_family?: string;
  font_size?: number;
  font_weight?: string;
  letter_spacing?: number;
  line_height?: number;
  text_color?: string;
  highlight_color?: string;
  secondary_color?: string;
  glow_color?: string;
  glow_size?: number;
  outline_color?: string;
  outline_width?: number;
  shadow_color?: string;
  shadow_blur?: number;
  position_y?: number;
  position_x?: number;
  text_align?: 'left' | 'center' | 'right';
  animation_type?: string;
  animation_duration?: number;
  animation_direction?: 'up' | 'down' | 'center';
  animation_easing?: string;
  animation_intensity?: string;
  bg_fit?: 'cover' | 'contain';
  bg_pan_x?: number;
  bg_pan_y?: number;
  bg_rotation?: number;
  bg_zoom?: 'zoom-in' | 'zoom-out' | 'none';
  overlay_opacity?: number;
  bg_blur?: number;
  background_color?: string;
  sync_offset_ms?: number;
  show_letterbox?: boolean;
  show_visualizer?: boolean;
  visualizer_color?: string;
  beat_pulse?: boolean;
}

export interface Asset {
  id: string;
  project_id: string;
  user_id: number;
  asset_type: 'audio' | 'image' | 'lyrics';
  original_name: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  duration?: number;
  metadata_json?: string;
  created_at?: string;
}

export interface Project {
  id: string;
  user_id: number;
  title: string;
  description?: string;
  aspect_ratio: '16:9' | '9:16' | '1:1' | '4:5';
  width: number;
  height: number;
  fps: number;
  duration: number;
  audio_asset_id?: string;
  audio_asset?: Asset;
  lyrics_data: LyricLine[];
  timeline_data: TimelineData;
  template_data: TemplateConfig;
  assets?: Asset[];
  created_at?: string;
  updated_at?: string;
}

export interface RenderJob {
  id: string;
  project_id: string;
  user_id?: number;
  status: 'pending' | 'rendering' | 'completed' | 'failed' | 'processing';
  progress: number;
  output_resolution?: string;
  fps?: number;
  output_format?: string;
  output_file?: string;
  error_message?: string;
  error?: string;
  message?: string;
  video_url?: string;
  created_at?: string;
  completed_at?: string;
}

export interface AIProposal {
  preset: string;
  font_family: string;
  font_size: number;
  font_weight: string;
  letter_spacing: number;
  text_color: string;
  highlight_color: string;
  glow_color: string;
  background_color: string;
  outline_color: string;
  outline_width: number;
  position_y: number;
  text_align: 'left' | 'center' | 'right';
  animation_type: string;
  animation_duration: number;
  overlay_opacity: number;
  bg_blur: number;
  ken_burns: string;
  rationale: string;
  provider?: string;
}
