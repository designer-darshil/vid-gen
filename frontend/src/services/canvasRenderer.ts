import { Project, LyricLine, TemplateConfig } from '../types';

export class CanvasRenderer {
  private imageCache: Map<string, HTMLImageElement> = new Map();

  preloadAssets(project: Project, onLoaded?: () => void) {
    if (project.assets) {
      project.assets.forEach((a) => {
        if (a.asset_type === 'image' && !this.imageCache.has(a.id)) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (onLoaded) onLoaded();
          };
          img.src = `/api/assets/${a.id}/file`;
          this.imageCache.set(a.id, img);
        }
      });
    }
  }

  drawFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    project: Project,
    currentTime: number,
    selectedLayer: 'lyric' | 'artwork' | null = null,
    snapGuideX: number | null = null,
    snapGuideY: number | null = null,
    showSafeArea = false
  ): { textBounds: { x: number; y: number; w: number; h: number } | null } {
    const cfg: TemplateConfig = project.template_data || {};

    // 1. Clear Frame
    ctx.clearRect(0, 0, width, height);

    // 2. Background: Uploaded Media or Procedural Cinematic Fallback
    let hasRenderedImage = false;
    const activeImageClip = this.getActiveImageClip(project, currentTime);

    if (activeImageClip) {
      const assetId = activeImageClip.asset_id;
      if (assetId && !this.imageCache.has(assetId)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = `/api/assets/${assetId}/file`;
        this.imageCache.set(assetId, img);
      }

      if (assetId && this.imageCache.has(assetId)) {
        const img = this.imageCache.get(assetId);
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.save();
          const duration = Math.max(0.1, activeImageClip.end - activeImageClip.start);
          const clipProgress = Math.max(0, Math.min(1, (currentTime - activeImageClip.start) / duration));

          // Ken Burns Motion
          let zoom = 1.0;
          const motion = cfg.bg_zoom || 'zoom-in';
          if (motion === 'zoom-in') {
            zoom = 1.0 + clipProgress * 0.08;
          } else if (motion === 'zoom-out') {
            zoom = 1.08 - clipProgress * 0.08;
          }

          const panX = ((cfg.bg_pan_x || 0) * width) / 100;
          const panY = ((cfg.bg_pan_y || 0) * height) / 100;
          const rotDeg = ((cfg.bg_rotation || 0) * Math.PI) / 180;

          ctx.translate(width / 2 + panX, height / 2 + panY);
          ctx.rotate(rotDeg);
          ctx.scale(zoom, zoom);
          ctx.globalAlpha = activeImageClip.opacity !== undefined ? activeImageClip.opacity : 1.0;

          if (cfg.bg_blur && cfg.bg_blur > 0) {
            ctx.filter = `blur(${cfg.bg_blur}px)`;
          }

          // Strict proportional cover scaling
          const imgRatio = img.naturalWidth / img.naturalHeight;
          const canvasRatio = width / height;
          let drawW = width;
          let drawH = height;

          if (cfg.bg_fit === 'contain') {
            if (imgRatio > canvasRatio) {
              drawW = width;
              drawH = width / imgRatio;
            } else {
              drawH = height;
              drawW = height * imgRatio;
            }
          } else {
            // Default Cover
            if (imgRatio > canvasRatio) {
              drawH = height;
              drawW = height * imgRatio;
            } else {
              drawW = width;
              drawH = width / imgRatio;
            }
          }

          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.restore();

          // Dimming Overlay
          const op = cfg.overlay_opacity !== undefined ? cfg.overlay_opacity : 0.38;
          if (op > 0) {
            ctx.fillStyle = `rgba(8, 18, 30, ${op})`;
            ctx.fillRect(0, 0, width, height);
          }
          hasRenderedImage = true;
        }
      }
    }

    if (!hasRenderedImage) {
      this.drawCinematicFallbackBackground(ctx, width, height, currentTime, cfg);
    }

    // 3. Audio Visualizer Spectrum (when enabled)
    if (cfg.show_visualizer || cfg.template_id === 'visualizer') {
      this.drawVisualizer(ctx, width, height, currentTime, cfg);
    }

    // 4. Letterbox Bars (when enabled or cinematic)
    if (cfg.show_letterbox || cfg.template_id === 'midnight_cinema') {
      const barH = height * 0.08;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, barH);
      ctx.fillRect(0, height - barH, width, barH);
    }

    // 5. Active Lyric Rendering & Direct Manipulation Bounds
    let textBounds: { x: number; y: number; w: number; h: number } | null = null;
    const activeLine = this.getActiveLyricLine(project, currentTime);

    if (activeLine) {
      textBounds = this.renderLyricLine(ctx, width, height, activeLine, currentTime, cfg);

      // Direct Manipulation Selection Bounding Box & Handles
      if (selectedLayer === 'lyric' && textBounds) {
        this.drawSelectionGizmo(ctx, textBounds, width, height, cfg);
      }
    }

    // 6. Magnetic Snap Guides
    if (snapGuideX !== null) {
      ctx.save();
      ctx.strokeStyle = '#B6FF3B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(snapGuideX, 0);
      ctx.lineTo(snapGuideX, height);
      ctx.stroke();
      ctx.restore();
    }

    if (snapGuideY !== null) {
      ctx.save();
      ctx.strokeStyle = '#B6FF3B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, snapGuideY);
      ctx.lineTo(width, snapGuideY);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Safe Area Action / Title Guides
    if (showSafeArea) {
      this.drawSafeAreaGuides(ctx, width, height);
    }

    return { textBounds };
  }

  private drawCinematicFallbackBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    time: number,
    cfg: TemplateConfig
  ) {
    ctx.save();

    // Cosmic Navy Sky Gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.72);
    sky.addColorStop(0, '#040810');
    sky.addColorStop(0.35, '#07101B');
    sky.addColorStop(0.65, '#0C1A2B');
    sky.addColorStop(0.88, '#112338');
    sky.addColorStop(1, '#162C46');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.72);

    // Stars Twinkle
    const starCount = 65;
    for (let i = 0; i < starCount; i++) {
      const sx = ((i * 137.5) % 1) * w;
      const sy = ((i * 269.3) % 0.65) * h;
      const size = i % 3 === 0 ? 1.6 : 1.0;
      const twinkle = 0.35 + 0.55 * Math.sin(time * 1.8 + i);
      ctx.fillStyle = `rgba(245, 248, 250, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aurora Horizon Nebula
    const nx = w * 0.5;
    const ny = h * 0.68;
    const neb = ctx.createRadialGradient(nx, ny, 10, nx, ny, w * 0.48);
    neb.addColorStop(0, 'rgba(182, 255, 59, 0.16)');
    neb.addColorStop(0.35, 'rgba(56, 189, 248, 0.08)');
    neb.addColorStop(0.7, 'rgba(12, 26, 43, 0.04)');
    neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, h * 0.2, w, h * 0.6);

    // Far Silhouette Ridge
    ctx.fillStyle = '#060E18';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.68);
    const farPeaks = [
      [0.08, 0.62], [0.18, 0.65], [0.28, 0.59], [0.38, 0.64],
      [0.50, 0.57], [0.62, 0.63], [0.74, 0.58], [0.86, 0.65], [1.0, 0.61]
    ];
    farPeaks.forEach(([px, py]) => ctx.lineTo(px * w, py * h));
    ctx.lineTo(w, h * 0.72);
    ctx.lineTo(0, h * 0.72);
    ctx.closePath();
    ctx.fill();

    // Midground Ridge
    ctx.fillStyle = '#071526';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.70);
    const midPeaks = [
      [0.05, 0.66], [0.14, 0.69], [0.24, 0.63], [0.34, 0.68],
      [0.46, 0.61], [0.58, 0.67], [0.69, 0.62], [0.82, 0.68], [0.93, 0.64], [1.0, 0.69]
    ];
    midPeaks.forEach(([px, py]) => ctx.lineTo(px * w, py * h));
    ctx.lineTo(w, h * 0.74);
    ctx.lineTo(0, h * 0.74);
    ctx.closePath();
    ctx.fill();

    // Dark Basin Ground Plane
    const ground = ctx.createLinearGradient(0, h * 0.68, 0, h);
    ground.addColorStop(0, '#06101c');
    ground.addColorStop(0.3, '#040b14');
    ground.addColorStop(1, '#02060b');
    ctx.fillStyle = ground;
    ctx.fillRect(0, h * 0.68, w, h * 0.32);

    // Solar Lime Horizon Fine Line & Soft Glow
    const horizY = h * 0.68;
    const horizGlow = ctx.createLinearGradient(0, horizY - 14, 0, horizY + 14);
    horizGlow.addColorStop(0, 'rgba(182, 255, 59, 0)');
    horizGlow.addColorStop(0.5, 'rgba(182, 255, 59, 0.35)');
    horizGlow.addColorStop(1, 'rgba(182, 255, 59, 0)');
    ctx.fillStyle = horizGlow;
    ctx.fillRect(0, horizY - 14, w, 28);

    ctx.strokeStyle = 'rgba(182, 255, 59, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, horizY);
    ctx.lineTo(w, horizY);
    ctx.stroke();

    // Subtle 35mm Grain Texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    const grainStep = 24;
    for (let gx = 0; gx < w; gx += grainStep) {
      for (let gy = 0; gy < h; gy += grainStep) {
        const grainSeed = (gx * 37 + gy * 79 + ((time * 10) | 0)) % 100;
        if (grainSeed > 68) {
          ctx.fillRect(gx + (grainSeed % 8), gy + ((grainSeed * 3) % 8), 1.5, 1.5);
        }
      }
    }

    // Corner Vignette
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.28, w * 0.5, h * 0.5, w * 0.76);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.7, 'rgba(4, 8, 16, 0.35)');
    vig.addColorStop(1, 'rgba(2, 4, 8, 0.85)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // Custom background tint if chosen
    if (cfg.background_color && cfg.background_color !== '#0C1A2B') {
      ctx.fillStyle = cfg.background_color;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  private drawVisualizer(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, cfg: TemplateConfig) {
    const numBars = 48;
    const barW = (w * 0.72) / numBars;
    const startX = (w - numBars * barW) / 2;
    const baseY = h * 0.88;

    ctx.save();
    for (let i = 0; i < numBars; i++) {
      const freq = Math.sin(time * 8 + i * 0.4) * Math.cos(time * 4 - i * 0.2);
      const barH = Math.max(4, Math.abs(freq) * (h * 0.16));

      const grad = ctx.createLinearGradient(0, baseY, 0, baseY - barH);
      grad.addColorStop(0, cfg.visualizer_color || '#B6FF3B');
      grad.addColorStop(1, '#38BDF8');

      ctx.fillStyle = grad;
      ctx.fillRect(startX + i * barW + 2, baseY - barH, barW - 4, barH);
    }
    ctx.restore();
  }

  private renderLyricLine(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    line: LyricLine,
    currentTime: number,
    cfg: TemplateConfig
  ): { x: number; y: number; w: number; h: number } {
    ctx.save();

    const posX = w * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
    const posY = h * ((cfg.position_y !== undefined ? cfg.position_y : 78) / 100);
    const fontSize = (cfg.font_size || 48) * (h / 1080);
    const fontFamily = cfg.font_family || "'Inter', sans-serif";
    const fontWeight = cfg.font_weight || '700';

    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = cfg.text_align || 'center';
    ctx.textBaseline = 'middle';

    const duration = Math.max(0.1, line.end - line.start);
    const progress = Math.max(0, Math.min(1, (currentTime - line.start) / duration));

    // Motion animation entrance offset
    let animOffsetY = 0;
    let animAlpha = 1.0;
    const animType = cfg.animation_type || 'cinematic-rise';
    const animDuration = cfg.animation_duration || 0.45;

    if (currentTime < line.start + animDuration) {
      const t = Math.max(0, (currentTime - line.start) / animDuration);
      if (animType === 'cinematic-rise') {
        animOffsetY = (1 - t) * (fontSize * 0.5);
        animAlpha = t;
      } else if (animType === 'fade-darkness' || animType === 'blur-focus') {
        animAlpha = t;
      }
    }

    ctx.globalAlpha = animAlpha;
    ctx.translate(posX, posY + animOffsetY);

    // Audio Beat pulse scale
    if (cfg.beat_pulse) {
      const pulse = 1.0 + Math.sin(currentTime * 12) * 0.022;
      ctx.scale(pulse, pulse);
    }

    const isPlaceholder = line.text.startsWith('[') && line.text.endsWith(']');
    const maxTextWidth = w * 0.80;

    // Word wrap helper for clean cinematic line breaks
    const rawParagraphs = line.text.split('\n');
    const wrappedLines: string[] = [];
    for (const para of rawParagraphs) {
      const wordsInPara = para.split(' ');
      let cur = '';
      for (const wd of wordsInPara) {
        const testLine = cur ? `${cur} ${wd}` : wd;
        if (ctx.measureText(testLine).width > maxTextWidth && cur) {
          wrappedLines.push(cur);
          cur = wd;
        } else {
          cur = testLine;
        }
      }
      if (cur) wrappedLines.push(cur);
    }

    const lineHeight = fontSize * 1.36;
    const totalHeight = Math.max(lineHeight, wrappedLines.length * lineHeight);
    let maxLineWidth = 0;
    wrappedLines.forEach((l) => {
      const mw = ctx.measureText(l).width;
      if (mw > maxLineWidth) maxLineWidth = mw;
    });

    const boxW = maxLineWidth + 48;
    const boxH = totalHeight + 24;

    // If placeholder, draw subtle cue card backing
    if (isPlaceholder) {
      ctx.fillStyle = 'rgba(12, 26, 43, 0.75)';
      ctx.strokeStyle = 'rgba(182, 255, 59, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      const rx = -boxW / 2;
      const ry = -boxH / 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(rx, ry, boxW, boxH, 8) : ctx.rect(rx, ry, boxW, boxH);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const words = line.words || [];

    // Word-by-word karaoke mode if single line with word timestamps
    if (words.length > 0 && wrappedLines.length === 1 && !isPlaceholder) {
      let startWordX = -maxLineWidth / 2;

      for (let i = 0; i < words.length; i++) {
        const item = words[i];
        const isSung = currentTime >= item.end;
        const isSinging = currentTime >= item.start && currentTime < item.end;
        const wordText = item.word + ' ';
        const wordWidth = ctx.measureText(wordText).width;

        // Circuit Navy dark outline for high contrast
        ctx.strokeStyle = cfg.outline_color || '#0C1A2B';
        ctx.lineWidth = Math.max(2, (cfg.outline_width || 2) * 2);
        ctx.lineJoin = 'round';
        ctx.strokeText(item.word, startWordX, 0);

        // Fill color & Solar Lime neon bloom
        if (isSinging || isSung) {
          ctx.fillStyle = cfg.highlight_color || '#B6FF3B';
          ctx.shadowColor = cfg.glow_color || 'rgba(182, 255, 59, 0.65)';
          ctx.shadowBlur = isSinging ? 18 : 8;
        } else {
          ctx.fillStyle = cfg.text_color || '#F1EFEA';
          ctx.shadowColor = 'rgba(4, 10, 20, 0.85)';
          ctx.shadowBlur = 8;
        }

        ctx.fillText(item.word, startWordX, 0);
        startWordX += wordWidth;
      }
    } else {
      // Multiline / Whole-line cinematic typography
      wrappedLines.forEach((lStr, lIdx) => {
        const lineY = (lIdx - (wrappedLines.length - 1) / 2) * lineHeight;

        // 1. Deep shadow / outline for crisp readable contrast against any backdrop
        ctx.strokeStyle = cfg.outline_color || '#0C1A2B';
        ctx.lineWidth = Math.max(2, (cfg.outline_width || 2) * 2);
        ctx.lineJoin = 'round';
        ctx.strokeText(lStr, 0, lineY);

        // 2. Active highlight bloom
        if (progress > 0.05 && !isPlaceholder) {
          ctx.fillStyle = cfg.highlight_color || '#B6FF3B';
          ctx.shadowColor = cfg.glow_color || 'rgba(182, 255, 59, 0.65)';
          ctx.shadowBlur = 16;
        } else if (isPlaceholder) {
          ctx.fillStyle = 'rgba(182, 255, 59, 0.85)';
          ctx.shadowColor = 'rgba(182, 255, 59, 0.3)';
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = cfg.text_color || '#F1EFEA';
          ctx.shadowColor = 'rgba(4, 10, 20, 0.9)';
          ctx.shadowBlur = 10;
        }

        ctx.fillText(lStr, 0, lineY);
      });
    }

    ctx.restore();

    return {
      x: posX - boxW / 2,
      y: posY - boxH / 2,
      w: boxW,
      h: boxH
    };
  }

  private drawSelectionGizmo(
    ctx: CanvasRenderingContext2D,
    b: { x: number; y: number; w: number; h: number },
    w: number,
    h: number,
    cfg: TemplateConfig
  ) {
    ctx.save();
    ctx.strokeStyle = '#B6FF3B';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    // Floating Layer Badge
    ctx.setLineDash([]);
    const badgeText = '✦ Typography Layer • Drag to Move';
    ctx.font = '500 13px "Inter", sans-serif';
    const tagW = ctx.measureText(badgeText).width + 20;
    const tagH = 26;
    const tagX = b.x;
    const tagY = b.y - tagH - 8;

    ctx.fillStyle = 'rgba(12, 26, 43, 0.95)';
    ctx.strokeStyle = 'rgba(182, 255, 59, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(tagX, tagY, tagW, tagH, 6) : ctx.rect(tagX, tagY, tagW, tagH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#B6FF3B';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, tagX + 10, tagY + tagH / 2);

    // 4 Corner Tactile Handles
    const corners = [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [b.x, b.y + b.h],
      [b.x + b.w, b.y + b.h]
    ];

    corners.forEach(([cx, cy]) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(cx - 7, cy - 7, 14, 14);

      ctx.fillStyle = '#B6FF3B';
      ctx.fillRect(cx - 6, cy - 6, 12, 12);
      ctx.strokeStyle = '#0C1A2B';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 6, cy - 6, 12, 12);
    });

    // Center Anchor Dot
    const posX = w * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
    const posY = h * ((cfg.position_y !== undefined ? cfg.position_y : 78) / 100);

    ctx.fillStyle = '#B6FF3B';
    ctx.beginPath();
    ctx.arc(posX, posY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0C1A2B';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private drawSafeAreaGuides(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save();
    // 90% Action Safe
    ctx.strokeStyle = 'rgba(182, 255, 59, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);

    // 80% Title Safe
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);

    // Center Crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 20, h / 2);
    ctx.lineTo(w / 2 + 20, h / 2);
    ctx.moveTo(w / 2, h / 2 - 20);
    ctx.lineTo(w / 2, h / 2 + 20);
    ctx.stroke();

    // Labels
    ctx.font = '500 16px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.fillText('80% Title Safe Area', w * 0.1 + 10, h * 0.1 + 22);
    ctx.fillStyle = 'rgba(182, 255, 59, 0.85)';
    ctx.fillText('90% Action Safe Area', w * 0.05 + 10, h * 0.05 + 22);

    ctx.restore();
  }

  private getActiveLyricLine(project: Project, time: number): LyricLine | null {
    const lyrics = project.lyrics_data;
    if (!lyrics || lyrics.length === 0) {
      // Readable sample lyric line for empty/new projects
      return {
        start: 0,
        end: Math.max(10, project.duration || 30),
        text: 'Cruising under midnight cinema skies',
        words: [
          { word: 'Cruising', start: 0, end: 2.0 },
          { word: 'under', start: 2.0, end: 3.5 },
          { word: 'midnight', start: 3.5, end: 5.5 },
          { word: 'cinema', start: 5.5, end: 7.5 },
          { word: 'skies', start: 7.5, end: 10.0 }
        ]
      };
    }

    const active = lyrics.find((l) => time >= l.start && time <= l.end);
    if (active) return active;

    // Nearest line when resting
    if (time <= lyrics[0].start) return lyrics[0];
    const prior = [...lyrics].reverse().find((l) => time >= l.end);
    if (prior) return prior;

    return lyrics[0];
  }

  private getActiveImageClip(project: Project, time: number): { asset_id?: string; start: number; end: number; opacity?: number } | null {
    if (project.timeline_data && project.timeline_data.tracks) {
      const imgTrack = project.timeline_data.tracks.find((t) => t.type === 'image');
      if (imgTrack && imgTrack.clips && imgTrack.clips.length > 0) {
        const clip = imgTrack.clips.find((c) => time >= c.start && time <= c.end);
        if (clip) return clip;
      }
    }

    // Fallback to project-level uploaded image asset
    if (project.assets) {
      const imgAsset = project.assets.find((a) => a.asset_type === 'image');
      if (imgAsset) {
        return {
          asset_id: imgAsset.id,
          start: 0,
          end: project.duration || 60,
          opacity: 1.0
        };
      }
    }

    return null;
  }
}
