/**
 * LyricStudio Animated Templates & Motion Design Engine
 * Implements 7 Signature Cinematic Templates and 8 Reusable Animation Presets.
 * Deterministic for real-time Canvas preview and FFmpeg video export consistency.
 */

// --- Easing functions ---
const EASING = {
    linear: (t) => t,
    easeOutQuad: (t) => t * (2 - t),
    easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeOutCubic: (t) => (--t) * t * t + 1,
    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    cubicBezierCinema: (t) => {
        // Approximates cubic-bezier(0.16, 1, 0.3, 1)
        return 1 - Math.pow(1 - t, 3.5);
    }
};

// --- 8 Reusable Motion Presets ---
const ANIMATION_PRESETS = {
    'fade-darkness': {
        id: 'fade-darkness',
        name: 'Fade through darkness',
        description: 'Opacity emerges smoothly from pure darkness with deep shadow contraction.',
        apply(progress, cfg = {}) {
            const dur = cfg.animation_duration || 0.45;
            const ease = EASING.cubicBezierCinema(Math.min(1.0, progress / dur));
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 1.8);
            return {
                alpha: Math.max(0, Math.min(1, alpha)),
                scale: 1.0,
                translateY: 0,
                blur: 0,
                trackingDelta: 0
            };
        }
    },
    'blur-focus': {
        id: 'blur-focus',
        name: 'Blur into focus',
        description: 'Optical lens blur resolving smoothly into sharp crisp typography.',
        apply(progress, cfg = {}) {
            const dur = cfg.animation_duration || 0.4;
            const p = Math.min(1.0, progress / dur);
            const ease = EASING.easeOutCubic(p);
            const maxBlur = cfg.animation_intensity === 'dramatic' ? 16 : 8;
            const blur = (1.0 - ease) * maxBlur;
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 1.8);
            return {
                alpha: Math.max(0, Math.min(1, alpha)),
                scale: 1.02 - (ease * 0.02),
                translateY: 0,
                blur: blur,
                trackingDelta: 0
            };
        }
    },
    'cinematic-rise': {
        id: 'cinematic-rise',
        name: 'Slow cinematic rise',
        description: 'Upward vertical translation with subtle camera scale drift.',
        apply(progress, cfg = {}) {
            const dur = cfg.animation_duration || 0.5;
            const p = Math.min(1.0, progress / dur);
            const ease = EASING.cubicBezierCinema(p);
            const dir = cfg.animation_direction === 'down' ? -1 : 1;
            const maxRise = cfg.animation_intensity === 'dramatic' ? 36 : 20;
            const translateY = (1.0 - ease) * maxRise * dir;
            const scale = 1.0 + (progress * 0.03);
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 1.7);
            return {
                alpha: Math.max(0, Math.min(1, alpha)),
                scale: scale,
                translateY: translateY,
                blur: 0,
                trackingDelta: 0
            };
        }
    },
    'tracking-reveal': {
        id: 'tracking-reveal',
        name: 'Tracking reveal',
        description: 'Letter-spacing expands gracefully from compressed to wide cinema tracking.',
        apply(progress, cfg = {}) {
            const dur = cfg.animation_duration || 0.55;
            const p = Math.min(1.0, progress / dur);
            const ease = EASING.easeOutCubic(p);
            const trackingDelta = (1.0 - ease) * -2.5;
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 1.6);
            return {
                alpha: Math.max(0, Math.min(1, alpha)),
                scale: 1.0,
                translateY: 0,
                blur: 0,
                trackingDelta: trackingDelta
            };
        }
    },
    'typewriter': {
        id: 'typewriter',
        name: 'Type-on',
        description: 'Characters resolve sequentially across line duration.',
        apply(progress, cfg = {}) {
            return {
                alpha: 1.0,
                scale: 1.0,
                translateY: 0,
                blur: 0,
                charProgress: Math.max(0, Math.min(1, progress * 1.4))
            };
        }
    },
    'word-highlight': {
        id: 'word-highlight',
        name: 'Word-by-word highlight',
        description: 'Synchronized progressive lighting across individual lyric words.',
        apply(progress, cfg = {}) {
            return {
                alpha: 1.0,
                scale: 1.0,
                translateY: 0,
                blur: 0,
                wordProgress: progress
            };
        }
    },
    'scale-drift': {
        id: 'scale-drift',
        name: 'Subtle scale and drift',
        description: 'Continuous slow filmic push or pull drift matching camera motion.',
        apply(progress, cfg = {}) {
            const scale = 1.0 + (progress * 0.05);
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 1.8);
            return {
                alpha: Math.max(0, Math.min(1, alpha)),
                scale: scale,
                translateY: 0,
                blur: 0,
                trackingDelta: 0
            };
        }
    },
    'beat-pulse': {
        id: 'beat-pulse',
        name: 'Beat-reactive pulse',
        description: 'Rhythmic energetic scale and bloom pop reacting to song rhythm.',
        apply(progress, cfg = {}, audioEnergy = 0) {
            // Periodic rhythmic bounce combined with audio energy
            const pulse = 1.0 + Math.sin(progress * Math.PI * 4) * 0.035 + (audioEnergy * 0.05);
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 2.0);
            return {
                alpha: Math.max(0, Math.min(1, alpha)),
                scale: pulse,
                translateY: 0,
                blur: 0,
                trackingDelta: 0
            };
        }
    }
};

// --- 7 Signature Cinematic Templates ---
const TEMPLATES = {
    // 1. Midnight Cinema
    midnight_cinema: {
        id: 'midnight_cinema',
        name: 'Midnight Cinema',
        badge: 'Letterbox & Drift',
        description: 'Filmic 2.39:1 widescreen letterbox, wide tracking, subtle scale drift, and deep filmic drop shadow.',
        defaults: {
            font_family: "'Cinzel', 'Playfair Display', serif",
            font_size: 48,
            font_weight: '700',
            letter_spacing: 3.5,
            line_height: 1.3,
            text_color: '#F1EFEA',
            secondary_color: '#A09EA9',
            highlight_color: '#A994FF',
            outline_color: '#090909',
            outline_width: 2,
            shadow_color: 'rgba(0,0,0,0.92)',
            shadow_blur: 18,
            glow_color: 'rgba(169, 148, 255, 0.25)',
            glow_size: 14,
            text_align: 'center',
            position_y: 78,
            position_x: 50,
            animation_type: 'cinematic-rise',
            animation_duration: 0.45,
            animation_direction: 'up',
            animation_intensity: 'medium',
            beat_pulse: true,
            background_color: '#090909',
            overlay_opacity: 0.42,
            show_letterbox: true
        },
        render(ctx, text, words, progress, width, height, cfg, currentTime = 0) {
            // Letterbox bars
            const barH = height * 0.08;
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, barH);
            ctx.fillRect(0, height - barH, width, barH);

            const motionPreset = ANIMATION_PRESETS[cfg.animation_type] || ANIMATION_PRESETS['cinematic-rise'];
            const motion = motionPreset.apply(progress, cfg);

            ctx.globalAlpha = motion.alpha;
            ctx.save();

            const posX = width * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
            const posY = height * ((cfg.position_y !== undefined ? cfg.position_y : 78) / 100) + (motion.translateY || 0);
            ctx.translate(posX, posY);
            ctx.scale(motion.scale || 1.0, motion.scale || 1.0);

            if (motion.blur && motion.blur > 0) {
                ctx.filter = `blur(${motion.blur}px)`;
            }

            const fontSize = cfg.font_size * (height / 1080);
            ctx.font = `${cfg.font_weight || '700'} ${fontSize}px ${cfg.font_family || "'Cinzel', serif"}`;
            ctx.textAlign = cfg.text_align || 'center';
            ctx.textBaseline = 'middle';
            ctx.letterSpacing = `${(cfg.letter_spacing || 3.5) + (motion.trackingDelta || 0)}px`;

            // Deep filmic shadow
            ctx.shadowColor = cfg.shadow_color || 'rgba(0,0,0,0.92)';
            ctx.shadowBlur = cfg.shadow_blur || 18;
            ctx.shadowOffsetY = 4;

            // Stroke outline
            if (cfg.outline_width > 0) {
                ctx.strokeStyle = cfg.outline_color || '#090909';
                ctx.lineWidth = cfg.outline_width * 2;
                ctx.strokeText(text, 0, 0);
            }

            // Fill
            ctx.fillStyle = cfg.text_color || '#F1EFEA';
            ctx.fillText(text, 0, 0);

            ctx.restore();
            ctx.filter = 'none';
            ctx.globalAlpha = 1.0;
        }
    },

    // 2. Soft Focus
    soft_focus: {
        id: 'soft_focus',
        name: 'Soft Focus',
        badge: 'Atmospheric Bloom',
        description: 'Optical blur into sharp focus, soft diffused ivory bloom, and gentle ambient warmth.',
        defaults: {
            font_family: "'Playfair Display', 'Cormorant Garamond', serif",
            font_size: 46,
            font_weight: '600',
            letter_spacing: 2.0,
            line_height: 1.3,
            text_color: '#FFFDF7',
            secondary_color: '#FFF8E6',
            highlight_color: '#A994FF',
            outline_color: 'transparent',
            outline_width: 0,
            shadow_color: 'rgba(255, 248, 230, 0.35)',
            shadow_blur: 24,
            glow_color: 'rgba(255, 248, 230, 0.45)',
            glow_size: 26,
            text_align: 'center',
            position_y: 76,
            position_x: 50,
            animation_type: 'blur-focus',
            animation_duration: 0.4,
            background_color: '#0a0a0e',
            overlay_opacity: 0.45
        },
        render(ctx, text, words, progress, width, height, cfg, currentTime = 0) {
            const motionPreset = ANIMATION_PRESETS[cfg.animation_type] || ANIMATION_PRESETS['blur-focus'];
            const motion = motionPreset.apply(progress, cfg);

            ctx.globalAlpha = motion.alpha;
            ctx.save();

            const posX = width * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
            const posY = height * ((cfg.position_y !== undefined ? cfg.position_y : 76) / 100) + (motion.translateY || 0);
            ctx.translate(posX, posY);
            ctx.scale(motion.scale || 1.0, motion.scale || 1.0);

            if (motion.blur && motion.blur > 0) {
                ctx.filter = `blur(${motion.blur}px)`;
            }

            const fontSize = cfg.font_size * (height / 1080);
            ctx.font = `${cfg.font_weight || '600'} ${fontSize}px ${cfg.font_family || "'Playfair Display', serif"}`;
            ctx.textAlign = cfg.text_align || 'center';
            ctx.textBaseline = 'middle';
            ctx.letterSpacing = `${cfg.letter_spacing || 2.0}px`;

            // Soft bloom aura
            ctx.shadowColor = cfg.glow_color || 'rgba(255, 248, 230, 0.45)';
            ctx.shadowBlur = cfg.glow_size || 26;
            ctx.fillStyle = cfg.text_color || '#FFFDF7';
            ctx.fillText(text, 0, 0);

            // Inner warm core
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(text, 0, 0);

            ctx.restore();
            ctx.filter = 'none';
            ctx.globalAlpha = 1.0;
        }
    },

    // 3. Editorial Serif
    editorial_serif: {
        id: 'editorial_serif',
        name: 'Editorial Serif',
        badge: 'High-Fashion Editorial',
        description: 'Classic high-contrast editorial serif typography, elegant tracking reveal, and architectural balance.',
        defaults: {
            font_family: "'Playfair Display', 'Cormorant Garamond', 'Fraunces', serif",
            font_size: 48,
            font_weight: '600',
            letter_spacing: 3.0,
            line_height: 1.35,
            text_color: '#F1EFEA',
            secondary_color: '#A09EA9',
            highlight_color: '#A994FF',
            outline_color: '#171717',
            outline_width: 1,
            shadow_color: 'rgba(0, 0, 0, 0.65)',
            shadow_blur: 10,
            glow_color: 'transparent',
            glow_size: 0,
            text_align: 'center',
            position_y: 77,
            position_x: 50,
            animation_type: 'tracking-reveal',
            animation_duration: 0.5,
            background_color: '#080808',
            overlay_opacity: 0.4
        },
        render(ctx, text, words, progress, width, height, cfg, currentTime = 0) {
            const motionPreset = ANIMATION_PRESETS[cfg.animation_type] || ANIMATION_PRESETS['tracking-reveal'];
            const motion = motionPreset.apply(progress, cfg);

            ctx.globalAlpha = motion.alpha;
            ctx.save();

            const posX = width * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
            const posY = height * ((cfg.position_y !== undefined ? cfg.position_y : 77) / 100) + (motion.translateY || 0);
            ctx.translate(posX, posY);
            ctx.scale(motion.scale || 1.0, motion.scale || 1.0);

            const fontSize = cfg.font_size * (height / 1080);
            ctx.font = `${cfg.font_weight || '600'} ${fontSize}px ${cfg.font_family || "'Playfair Display', serif"}`;
            ctx.textAlign = cfg.text_align || 'center';
            ctx.textBaseline = 'middle';
            ctx.letterSpacing = `${(cfg.letter_spacing || 3.0) + (motion.trackingDelta || 0)}px`;

            // Fine framing rules
            const textMetrics = ctx.measureText(text);
            const halfW = textMetrics.width / 2;
            ctx.strokeStyle = 'rgba(241, 239, 234, 0.22)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-halfW - 30, -fontSize * 0.7);
            ctx.lineTo(halfW + 30, -fontSize * 0.7);
            ctx.stroke();

            // Text
            ctx.shadowColor = cfg.shadow_color || 'rgba(0,0,0,0.65)';
            ctx.shadowBlur = cfg.shadow_blur || 10;
            ctx.fillStyle = cfg.text_color || '#F1EFEA';
            ctx.fillText(text, 0, 0);

            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
    },

    // 4. Kinetic Type
    kinetic_type: {
        id: 'kinetic_type',
        name: 'Kinetic Type',
        badge: 'Punchy Rhythm Pop',
        description: 'Dynamic impact bounce, bold grotesque typography, and expressive rhythm on every lyric entry.',
        defaults: {
            font_family: "'Syne', 'Space Grotesk', 'Geist', sans-serif",
            font_size: 54,
            font_weight: '800',
            letter_spacing: 1.0,
            line_height: 1.25,
            text_color: '#FFFFFF',
            secondary_color: '#A994FF',
            highlight_color: '#38BDF8',
            outline_color: '#090909',
            outline_width: 3,
            shadow_color: 'rgba(0, 0, 0, 0.95)',
            shadow_blur: 16,
            glow_color: 'rgba(169, 148, 255, 0.35)',
            glow_size: 16,
            text_align: 'center',
            position_y: 72,
            position_x: 50,
            animation_type: 'beat-pulse',
            animation_duration: 0.35,
            background_color: '#090909',
            overlay_opacity: 0.4
        },
        render(ctx, text, words, progress, width, height, cfg, currentTime = 0) {
            let scale = 1.0;
            if (progress < 0.22) {
                const p = progress / 0.22;
                scale = 0.78 + Math.sin(p * Math.PI * 0.75) * 0.38;
            } else {
                scale = 1.0 + (progress - 0.22) * 0.04;
            }
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 2.2);
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

            ctx.save();
            const posX = width * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
            const posY = height * ((cfg.position_y !== undefined ? cfg.position_y : 72) / 100);
            ctx.translate(posX, posY);
            ctx.scale(scale, scale);

            const fontSize = cfg.font_size * (height / 1080);
            ctx.font = `${cfg.font_weight || '800'} ${fontSize}px ${cfg.font_family || "'Syne', sans-serif"}`;
            ctx.textAlign = cfg.text_align || 'center';
            ctx.textBaseline = 'middle';
            ctx.letterSpacing = `${cfg.letter_spacing || 1.0}px`;

            if (cfg.outline_width > 0) {
                ctx.strokeStyle = cfg.outline_color || '#090909';
                ctx.lineWidth = cfg.outline_width * 2.5;
                ctx.strokeText(text, 0, 0);
            }

            ctx.shadowColor = cfg.shadow_color || 'rgba(0,0,0,0.95)';
            ctx.shadowBlur = cfg.shadow_blur || 16;
            ctx.fillStyle = cfg.text_color || '#FFFFFF';
            ctx.fillText(text, 0, 0);

            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
    },

    // 5. Dream Sequence
    dream_sequence: {
        id: 'dream_sequence',
        name: 'Dream Sequence',
        badge: 'Ambient Floating Wave',
        description: 'Ambient sinusoidal floating wave, soft violet-lavender luminescence, and ethereal fade-through-darkness.',
        defaults: {
            font_family: "'Outfit', 'Playfair Display', sans-serif",
            font_size: 46,
            font_weight: '600',
            letter_spacing: 2.5,
            line_height: 1.3,
            text_color: '#F1EFEA',
            secondary_color: '#D4CBFF',
            highlight_color: '#A994FF',
            outline_color: 'transparent',
            outline_width: 0,
            shadow_color: 'rgba(169, 148, 255, 0.45)',
            shadow_blur: 22,
            glow_color: 'rgba(169, 148, 255, 0.55)',
            glow_size: 26,
            text_align: 'center',
            position_y: 75,
            position_x: 50,
            animation_type: 'fade-darkness',
            animation_duration: 0.5,
            background_color: '#08080f',
            overlay_opacity: 0.45
        },
        render(ctx, text, words, progress, width, height, cfg, currentTime = 0) {
            // Ambient vertical bobbing wave
            const floatY = Math.sin(currentTime * 2.4) * 6;
            const breathe = 1.0 + Math.sin(currentTime * 1.6) * 0.015;
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 1.6);
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

            ctx.save();
            const posX = width * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
            const posY = height * ((cfg.position_y !== undefined ? cfg.position_y : 75) / 100) + floatY;
            ctx.translate(posX, posY);
            ctx.scale(breathe, breathe);

            const fontSize = cfg.font_size * (height / 1080);
            ctx.font = `${cfg.font_weight || '600'} ${fontSize}px ${cfg.font_family || "'Outfit', sans-serif"}`;
            ctx.textAlign = cfg.text_align || 'center';
            ctx.textBaseline = 'middle';
            ctx.letterSpacing = `${cfg.letter_spacing || 2.5}px`;

            // Soft lavender ethereal halo
            ctx.shadowColor = cfg.glow_color || 'rgba(169, 148, 255, 0.55)';
            ctx.shadowBlur = cfg.glow_size || 26;
            ctx.fillStyle = cfg.text_color || '#F1EFEA';
            ctx.fillText(text, 0, 0);

            // Subtle luminous core
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(text, 0, 0);

            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
    },

    // 6. Minimal Verse
    minimal_verse: {
        id: 'minimal_verse',
        name: 'Minimal Verse',
        badge: 'Swiss Geometry',
        description: 'Crisp geometric clarity, clean negative space, smooth slide transitions, and zero visual clutter.',
        defaults: {
            font_family: "'Geist', 'Inter', sans-serif",
            font_size: 42,
            font_weight: '500',
            letter_spacing: 1.5,
            line_height: 1.35,
            text_color: '#F1EFEA',
            secondary_color: '#A09EA9',
            highlight_color: '#A994FF',
            outline_color: '#090909',
            outline_width: 0,
            shadow_color: 'rgba(0,0,0,0.45)',
            shadow_blur: 6,
            glow_color: 'transparent',
            glow_size: 0,
            text_align: 'center',
            position_y: 80,
            position_x: 50,
            animation_type: 'fade-darkness',
            animation_duration: 0.35,
            background_color: '#090909',
            overlay_opacity: 0.35
        },
        render(ctx, text, words, progress, width, height, cfg, currentTime = 0) {
            // Smooth upward slide
            const slideY = (1.0 - Math.min(1.0, progress * 4.0)) * 14;
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 1.8);
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

            ctx.save();
            const posX = width * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
            const posY = height * ((cfg.position_y !== undefined ? cfg.position_y : 80) / 100) + slideY;
            ctx.translate(posX, posY);

            const fontSize = cfg.font_size * (height / 1080);
            ctx.font = `${cfg.font_weight || '500'} ${fontSize}px ${cfg.font_family || "'Geist', sans-serif"}`;
            ctx.textAlign = cfg.text_align || 'center';
            ctx.textBaseline = 'middle';
            ctx.letterSpacing = `${cfg.letter_spacing || 1.5}px`;

            ctx.shadowColor = cfg.shadow_color || 'rgba(0,0,0,0.45)';
            ctx.shadowBlur = cfg.shadow_blur || 6;
            ctx.fillStyle = cfg.text_color || '#F1EFEA';
            ctx.fillText(text, 0, 0);

            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
    },

    // 7. Karaoke Highlight
    karaoke_highlight: {
        id: 'karaoke_highlight',
        name: 'Karaoke Highlight',
        badge: 'Word-by-Word Wipe',
        description: 'Real-time progressive word-by-word highlight wiping synchronized to audio vocal delivery.',
        defaults: {
            font_family: "'Geist', 'Outfit', 'Inter', sans-serif",
            font_size: 48,
            font_weight: '700',
            letter_spacing: 1.5,
            line_height: 1.3,
            text_color: 'rgba(241, 239, 234, 0.4)',
            secondary_color: '#F1EFEA',
            highlight_color: '#A994FF',
            outline_color: '#090909',
            outline_width: 2,
            shadow_color: 'rgba(0,0,0,0.85)',
            shadow_blur: 12,
            glow_color: 'rgba(169, 148, 255, 0.7)',
            glow_size: 16,
            text_align: 'center',
            position_y: 75,
            position_x: 50,
            animation_type: 'word-highlight',
            animation_duration: 0.3,
            background_color: '#090909',
            overlay_opacity: 0.4
        },
        render(ctx, text, words, progress, width, height, cfg, currentTime = 0, lineStart = 0, lineEnd = 1) {
            ctx.save();
            const posX = width * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
            const posY = height * ((cfg.position_y !== undefined ? cfg.position_y : 75) / 100);
            ctx.translate(posX, posY);

            const fontSize = cfg.font_size * (height / 1080);
            ctx.font = `${cfg.font_weight || '700'} ${fontSize}px ${cfg.font_family || "'Geist', sans-serif"}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.letterSpacing = `${cfg.letter_spacing || 1.5}px`;

            const effectiveWords = (words && words.length > 0) ? words : text.split(' ').map((w, i, arr) => ({
                word: w,
                start: lineStart + (i / arr.length) * (lineEnd - lineStart),
                end: lineStart + ((i + 1) / arr.length) * (lineEnd - lineStart)
            }));

            // Measure each word to calculate horizontal layout
            const wordMeasures = effectiveWords.map(w => ctx.measureText(w.word + ' '));
            const totalWidth = wordMeasures.reduce((acc, m) => acc + m.width, 0);
            let currentX = -totalWidth / 2;

            effectiveWords.forEach((w, idx) => {
                const wWidth = wordMeasures[idx].width;
                const isSung = currentTime >= w.end;
                const isSinging = currentTime >= w.start && currentTime < w.end;

                ctx.textAlign = 'left';

                if (cfg.outline_width > 0) {
                    ctx.strokeStyle = cfg.outline_color || '#090909';
                    ctx.lineWidth = cfg.outline_width * 2;
                    ctx.strokeText(w.word, currentX, 0);
                }

                if (isSung) {
                    ctx.fillStyle = cfg.highlight_color || '#A994FF';
                    ctx.shadowColor = cfg.glow_color || 'rgba(169, 148, 255, 0.7)';
                    ctx.shadowBlur = 10;
                } else if (isSinging) {
                    ctx.fillStyle = cfg.highlight_color || '#A994FF';
                    ctx.shadowColor = cfg.glow_color || 'rgba(169, 148, 255, 0.7)';
                    ctx.shadowBlur = cfg.glow_size || 16;
                } else {
                    ctx.fillStyle = cfg.text_color || 'rgba(241, 239, 234, 0.4)';
                    ctx.shadowBlur = 0;
                }

                ctx.fillText(w.word, currentX, 0);
                currentX += wWidth;
            });

            ctx.restore();
        }
    }
};

// --- Backwards-compatibility Aliases ---
TEMPLATES['cinematic'] = TEMPLATES.midnight_cinema;
TEMPLATES['minimal'] = TEMPLATES.minimal_verse;
TEMPLATES['karaoke'] = TEMPLATES.karaoke_highlight;
TEMPLATES['dreamy'] = TEMPLATES.dream_sequence;
TEMPLATES['aesthetic'] = TEMPLATES.dream_sequence;
TEMPLATES['kinetic'] = TEMPLATES.kinetic_type;

// Optional Cyberpunk Neon Glow Template (preserves any existing neon project)
TEMPLATES['neon'] = {
    id: 'neon',
    name: 'Neon Glow',
    badge: 'Electric Tubes',
    description: 'Pulsing electric neon tubes with multi-stage chromatic glow and cyberpunk vibrancy.',
    defaults: {
        font_family: "'Outfit', 'Inter', sans-serif",
        font_size: 52,
        font_weight: '800',
        letter_spacing: 2.0,
        text_color: '#FFFFFF',
        secondary_color: '#00F2FE',
        highlight_color: '#A994FF',
        outline_color: '#00F2FE',
        outline_width: 3,
        shadow_color: 'rgba(0, 242, 254, 0.9)',
        shadow_blur: 25,
        glow_color: 'rgba(0, 242, 254, 0.95)',
        glow_size: 30,
        text_align: 'center',
        position_y: 75,
        animation_type: 'beat-pulse',
        background_color: '#05050a',
        overlay_opacity: 0.5
    },
    render(ctx, text, words, progress, width, height, cfg) {
        const pulse = 1.0 + Math.sin(progress * Math.PI * 4) * 0.03;
        const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 2.0);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

        ctx.save();
        const posX = width * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
        const posY = height * ((cfg.position_y !== undefined ? cfg.position_y : 75) / 100);
        ctx.translate(posX, posY);
        ctx.scale(pulse, pulse);

        const fontSize = cfg.font_size * (height / 1080);
        ctx.font = `${cfg.font_weight || '800'} ${fontSize}px ${cfg.font_family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = cfg.glow_color || '#00F2FE';
        ctx.shadowBlur = cfg.glow_size || 30;
        ctx.strokeStyle = cfg.outline_color || '#00F2FE';
        ctx.lineWidth = 6;
        ctx.strokeText(text, 0, 0);

        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.strokeText(text, 0, 0);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, 0, 0);

        ctx.restore();
        ctx.globalAlpha = 1.0;
    }
};

// Optional Dynamic Music Visualizer
TEMPLATES['visualizer'] = {
    id: 'visualizer',
    name: 'Dynamic Music Visualizer',
    badge: 'Audio Reactive',
    description: 'Audio spectrum waves reacting dynamically underneath synchronized typography.',
    defaults: {
        font_family: "'Outfit', 'Inter', sans-serif",
        font_size: 48,
        font_weight: '700',
        letter_spacing: 1.5,
        text_color: '#F1EFEA',
        secondary_color: '#A994FF',
        highlight_color: '#38BDF8',
        outline_color: '#090909',
        outline_width: 2,
        shadow_color: 'rgba(0,0,0,0.85)',
        shadow_blur: 15,
        glow_color: 'rgba(169, 148, 255, 0.7)',
        glow_size: 20,
        text_align: 'center',
        position_y: 65,
        animation_type: 'beat-pulse',
        background_color: '#090909',
        overlay_opacity: 0.4,
        visualizer_color: '#A994FF'
    },
    render(ctx, text, words, progress, width, height, cfg, currentTime = 0) {
        const numBars = 48;
        const barW = (width * 0.7) / numBars;
        const startX = (width - (numBars * barW)) / 2;
        const baseY = height * 0.88;

        ctx.save();
        for (let i = 0; i < numBars; i++) {
            const freq = Math.sin(currentTime * 8 + i * 0.4) * Math.cos(currentTime * 4 - i * 0.2);
            const barH = Math.max(4, Math.abs(freq) * (height * 0.16));

            const grad = ctx.createLinearGradient(0, baseY, 0, baseY - barH);
            grad.addColorStop(0, cfg.visualizer_color || '#A994FF');
            grad.addColorStop(1, '#D4CBFF');

            ctx.fillStyle = grad;
            ctx.fillRect(startX + i * barW + 2, baseY - barH, barW - 4, barH);
        }
        ctx.restore();

        ctx.save();
        const posX = width * ((cfg.position_x !== undefined ? cfg.position_x : 50) / 100);
        const posY = height * ((cfg.position_y !== undefined ? cfg.position_y : 65) / 100);
        ctx.translate(posX, posY);

        const fontSize = cfg.font_size * (height / 1080);
        ctx.font = `${cfg.font_weight || '700'} ${fontSize}px ${cfg.font_family}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (cfg.outline_width > 0) {
            ctx.strokeStyle = cfg.outline_color || '#090909';
            ctx.lineWidth = cfg.outline_width * 2;
            ctx.strokeText(text, 0, 0);
        }

        ctx.fillStyle = cfg.text_color || '#F1EFEA';
        ctx.shadowColor = cfg.glow_color || 'rgba(169, 148, 255, 0.7)';
        ctx.shadowBlur = cfg.glow_size || 20;
        ctx.fillText(text, 0, 0);

        ctx.restore();
    }
};
