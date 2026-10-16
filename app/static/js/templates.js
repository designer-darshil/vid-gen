/**
 * LyricStudio Animated Templates Engine
 * Implements 6 genuinely distinct visual styles for video compositions
 */
const TEMPLATES = {
    cinematic: {
        id: 'cinematic',
        name: 'Cinematic Typography',
        description: 'Epic letterboxed typography with wide tracking, dramatic drop shadows, and slow filmic drift.',
        defaults: {
            font_family: "'Cinzel', 'Inter', serif",
            font_size: 46,
            font_weight: '700',
            letter_spacing: 3.5,
            text_color: '#FFFFFF',
            secondary_color: '#E2E8F0',
            highlight_color: '#F6E05E',
            outline_color: '#000000',
            outline_width: 2,
            shadow_color: 'rgba(0,0,0,0.85)',
            shadow_blur: 18,
            glow_color: 'rgba(255,255,255,0.2)',
            glow_size: 10,
            text_align: 'center',
            position_y: 78,
            animation_type: 'fade-slide',
            background_color: '#07080c',
            overlay_opacity: 0.4
        },
        render(ctx, text, words, progress, width, height, cfg) {
            // Letterbox bars
            const barH = height * 0.08;
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, barH);
            ctx.fillRect(0, height - barH, width, barH);

            // Subtle filmic scale
            const scale = 1.0 + (progress * 0.04);
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 1.5);
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

            ctx.save();
            ctx.translate(width / 2, height * (cfg.position_y / 100));
            ctx.scale(scale, scale);

            ctx.font = `${cfg.font_weight} ${cfg.font_size * (height / 1080)}px ${cfg.font_family}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.letterSpacing = `${cfg.letter_spacing}px`;

            // Shadow
            ctx.shadowColor = cfg.shadow_color;
            ctx.shadowBlur = cfg.shadow_blur;
            ctx.shadowOffsetY = 4;

            // Stroke
            if (cfg.outline_width > 0) {
                ctx.strokeStyle = cfg.outline_color;
                ctx.lineWidth = cfg.outline_width * 2;
                ctx.strokeText(text, 0, 0);
            }

            // Fill
            ctx.fillStyle = cfg.text_color;
            ctx.fillText(text, 0, 0);

            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
    },

    neon: {
        id: 'neon',
        name: 'Neon Glow',
        description: 'Pulsing electric neon tubes with multi-stage chromatic glow and cyberpunk vibrancy.',
        defaults: {
            font_family: "'Outfit', 'Inter', sans-serif",
            font_size: 52,
            font_weight: '800',
            letter_spacing: 2.0,
            text_color: '#FFFFFF',
            secondary_color: '#00F2FE',
            highlight_color: '#FF007F',
            outline_color: '#00F2FE',
            outline_width: 3,
            shadow_color: 'rgba(0, 242, 254, 0.9)',
            shadow_blur: 25,
            glow_color: 'rgba(0, 242, 254, 0.95)',
            glow_size: 30,
            text_align: 'center',
            position_y: 75,
            animation_type: 'scale',
            background_color: '#05050a',
            overlay_opacity: 0.5
        },
        render(ctx, text, words, progress, width, height, cfg) {
            const pulse = 1.0 + Math.sin(progress * Math.PI * 4) * 0.03;
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 2.0);
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

            ctx.save();
            ctx.translate(width / 2, height * (cfg.position_y / 100));
            ctx.scale(pulse, pulse);

            ctx.font = `${cfg.font_weight} ${cfg.font_size * (height / 1080)}px ${cfg.font_family}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Outer Neon Glow Layer
            ctx.shadowColor = cfg.glow_color || '#00F2FE';
            ctx.shadowBlur = cfg.glow_size;
            ctx.strokeStyle = cfg.outline_color;
            ctx.lineWidth = 6;
            ctx.strokeText(text, 0, 0);

            // Inner Bright Core
            ctx.shadowBlur = 8;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.strokeText(text, 0, 0);

            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(text, 0, 0);

            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
    },

    minimal: {
        id: 'minimal',
        name: 'Minimal Typography',
        description: 'Clean Swiss modernism with refined geometry, smooth sliding fades, and zero clutter.',
        defaults: {
            font_family: "'Inter', sans-serif",
            font_size: 42,
            font_weight: '500',
            letter_spacing: 1.0,
            text_color: '#FFFFFF',
            secondary_color: '#94A3B8',
            highlight_color: '#38BDF8',
            outline_color: '#000000',
            outline_width: 0,
            shadow_color: 'rgba(0,0,0,0.4)',
            shadow_blur: 6,
            glow_color: 'transparent',
            glow_size: 0,
            text_align: 'center',
            position_y: 80,
            animation_type: 'fade-slide',
            background_color: '#090a0f',
            overlay_opacity: 0.3
        },
        render(ctx, text, words, progress, width, height, cfg) {
            // Slide upwards smoothly
            const slideY = (1.0 - Math.min(1.0, progress * 4.0)) * 15;
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 1.8);
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

            ctx.save();
            ctx.translate(width / 2, height * (cfg.position_y / 100) + slideY);

            ctx.font = `${cfg.font_weight} ${cfg.font_size * (height / 1080)}px ${cfg.font_family}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            ctx.fillStyle = cfg.text_color;
            ctx.fillText(text, 0, 0);

            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
    },

    karaoke: {
        id: 'karaoke',
        name: 'Karaoke Word Highlighting',
        description: 'Real-time progressive word-by-word color highlight wiping in sync with the singer.',
        defaults: {
            font_family: "'Outfit', 'Inter', sans-serif",
            font_size: 48,
            font_weight: '700',
            letter_spacing: 1.5,
            text_color: 'rgba(255, 255, 255, 0.45)',
            secondary_color: '#FFFFFF',
            highlight_color: '#00F2FE',
            outline_color: '#000000',
            outline_width: 2,
            shadow_color: 'rgba(0,0,0,0.7)',
            shadow_blur: 10,
            glow_color: 'rgba(0, 242, 254, 0.6)',
            glow_size: 15,
            text_align: 'center',
            position_y: 75,
            animation_type: 'karaoke',
            background_color: '#08090f',
            overlay_opacity: 0.4
        },
        render(ctx, text, words, progress, width, height, cfg, currentTime = 0, lineStart = 0, lineEnd = 1) {
            ctx.save();
            ctx.translate(width / 2, height * (cfg.position_y / 100));

            ctx.font = `${cfg.font_weight} ${cfg.font_size * (height / 1080)}px ${cfg.font_family}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const effectiveWords = (words && words.length > 0) ? words : text.split(' ').map((w, i, arr) => ({
                word: w,
                start: lineStart + (i / arr.length) * (lineEnd - lineStart),
                end: lineStart + ((i + 1) / arr.length) * (lineEnd - lineStart)
            }));

            // Measure each word to calculate horizontal alignment
            const wordMeasures = effectiveWords.map(w => ctx.measureText(w.word + ' '));
            const totalWidth = wordMeasures.reduce((acc, m) => acc + m.width, 0);
            let currentX = -totalWidth / 2;

            effectiveWords.forEach((w, idx) => {
                const wWidth = wordMeasures[idx].width;
                const isSung = currentTime >= w.end;
                const isSinging = currentTime >= w.start && currentTime < w.end;

                ctx.textAlign = 'left';

                // Shadow & outline
                if (cfg.outline_width > 0) {
                    ctx.strokeStyle = cfg.outline_color;
                    ctx.lineWidth = cfg.outline_width * 2;
                    ctx.strokeText(w.word, currentX, 0);
                }

                if (isSung) {
                    ctx.fillStyle = cfg.highlight_color;
                    ctx.shadowColor = cfg.glow_color;
                    ctx.shadowBlur = 10;
                } else if (isSinging) {
                    // Wipe fill based on progress inside this word
                    ctx.fillStyle = cfg.highlight_color;
                    ctx.shadowColor = cfg.glow_color;
                    ctx.shadowBlur = cfg.glow_size;
                } else {
                    ctx.fillStyle = cfg.text_color;
                    ctx.shadowBlur = 0;
                }

                ctx.fillText(w.word, currentX, 0);
                currentX += wWidth;
            });

            ctx.restore();
        }
    },

    dreamy: {
        id: 'dreamy',
        name: 'Dreamy Atmosphere',
        description: 'Ethereal floating typography with soft violet-lavender luminescence and gentle breathing motion.',
        defaults: {
            font_family: "'Playfair Display', 'Cinzel', serif",
            font_size: 46,
            font_weight: '600',
            letter_spacing: 3.0,
            text_color: '#F8FAFC',
            secondary_color: '#E0AAFF',
            highlight_color: '#C4B5FD',
            outline_color: 'transparent',
            outline_width: 0,
            shadow_color: 'rgba(139, 92, 246, 0.45)',
            shadow_blur: 20,
            glow_color: 'rgba(196, 181, 253, 0.5)',
            glow_size: 24,
            text_align: 'center',
            position_y: 75,
            animation_type: 'dreamy',
            background_color: '#070711',
            overlay_opacity: 0.45
        },
        render(ctx, text, words, progress, width, height, cfg, currentTime = 0) {
            const floatY = Math.sin(currentTime * 2.2) * 8;
            const breathe = 1.0 + Math.sin(currentTime * 1.5) * 0.02;
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 1.6);
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

            ctx.save();
            ctx.translate(width / 2, height * (cfg.position_y / 100) + floatY);
            ctx.scale(breathe, breathe);

            ctx.font = `${cfg.font_weight} ${cfg.font_size * (height / 1080)}px ${cfg.font_family}`;
            ctx.textAlign = cfg.text_align || 'center';
            ctx.textBaseline = 'middle';
            ctx.letterSpacing = `${cfg.letter_spacing || 2}px`;

            // Soft ethereal halo
            ctx.shadowColor = cfg.glow_color || 'rgba(196, 181, 253, 0.6)';
            ctx.shadowBlur = cfg.glow_size || 24;
            ctx.fillStyle = cfg.text_color || '#F8FAFC';
            ctx.fillText(text, 0, 0);

            // Subtle luminous core
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(text, 0, 0);

            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
    },

    kinetic: {
        id: 'kinetic',
        name: 'Kinetic Movement',
        description: 'High-energy punchy typography with expressive scale pop, dynamic bounce, and modern impact.',
        defaults: {
            font_family: "'Space Grotesk', 'Syne', 'Outfit', sans-serif",
            font_size: 54,
            font_weight: '700',
            letter_spacing: 1.0,
            text_color: '#FFFFFF',
            secondary_color: '#F43F5E',
            highlight_color: '#8B5CF6',
            outline_color: '#000000',
            outline_width: 3,
            shadow_color: 'rgba(0, 0, 0, 0.9)',
            shadow_blur: 16,
            glow_color: 'rgba(139, 92, 246, 0.4)',
            glow_size: 15,
            text_align: 'center',
            position_y: 72,
            animation_type: 'kinetic',
            background_color: '#06070B',
            overlay_opacity: 0.4
        },
        render(ctx, text, words, progress, width, height, cfg) {
            let scale = 1.0;
            if (progress < 0.25) {
                const p = progress / 0.25;
                scale = 0.75 + Math.sin(p * Math.PI * 0.75) * 0.4;
            } else {
                scale = 1.0 + (progress - 0.25) * 0.04;
            }
            const alpha = Math.min(1.0, Math.sin(progress * Math.PI) * 2.2);
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

            ctx.save();
            ctx.translate(width / 2, height * (cfg.position_y / 100));
            ctx.scale(scale, scale);

            ctx.font = `${cfg.font_weight} ${cfg.font_size * (height / 1080)}px ${cfg.font_family}`;
            ctx.textAlign = cfg.text_align || 'center';
            ctx.textBaseline = 'middle';
            ctx.letterSpacing = `${cfg.letter_spacing || 1}px`;

            if (cfg.outline_width > 0) {
                ctx.strokeStyle = cfg.outline_color || '#000000';
                ctx.lineWidth = cfg.outline_width * 2.5;
                ctx.strokeText(text, 0, 0);
            }

            ctx.shadowColor = cfg.shadow_color || 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = cfg.shadow_blur || 12;
            ctx.fillStyle = cfg.text_color || '#FFFFFF';
            ctx.fillText(text, 0, 0);

            ctx.restore();
            ctx.globalAlpha = 1.0;
        }
    },

    aesthetic: {
        id: 'aesthetic',
        name: 'Aesthetic Image Lyrics',
        description: 'Sophisticated frosted glass card with kinetic typography and editorial composition.',
        defaults: {
            font_family: "'Cinzel', 'Inter', serif",
            font_size: 44,
            font_weight: '700',
            letter_spacing: 3.0,
            text_color: '#FFFFFF',
            secondary_color: '#F8FAFC',
            highlight_color: '#E0AAFF',
            outline_color: 'transparent',
            outline_width: 0,
            shadow_color: 'rgba(0,0,0,0.5)',
            shadow_blur: 12,
            glow_color: 'rgba(224, 170, 255, 0.3)',
            glow_size: 15,
            text_align: 'center',
            position_y: 75,
            animation_type: 'fade-slide',
            background_color: '#0c0d14',
            overlay_opacity: 0.5
        },
        render(ctx, text, words, progress, width, height, cfg) {
            ctx.save();
            ctx.translate(width / 2, height * (cfg.position_y / 100));

            ctx.font = `${cfg.font_weight} ${cfg.font_size * (height / 1080)}px ${cfg.font_family}`;
            const metrics = ctx.measureText(text);
            const cardW = metrics.width + 60;
            const cardH = cfg.font_size * 2.2;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
            ctx.fill();
            ctx.stroke();

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = cfg.text_color;
            ctx.shadowColor = cfg.shadow_color;
            ctx.shadowBlur = cfg.shadow_blur;
            ctx.fillText(text, 0, 0);

            ctx.restore();
        }
    },

    visualizer: {
        id: 'visualizer',
        name: 'Dynamic Music Visualizer',
        description: 'Audio spectrum waves reacting dynamically underneath synchronized typography.',
        defaults: {
            font_family: "'Outfit', 'Inter', sans-serif",
            font_size: 48,
            font_weight: '700',
            letter_spacing: 1.5,
            text_color: '#FFFFFF',
            secondary_color: '#4FACFE',
            highlight_color: '#00F2FE',
            outline_color: '#000000',
            outline_width: 2,
            shadow_color: 'rgba(0,0,0,0.8)',
            shadow_blur: 15,
            glow_color: 'rgba(79, 172, 254, 0.8)',
            glow_size: 20,
            text_align: 'center',
            position_y: 65,
            animation_type: 'scale',
            background_color: '#060810',
            overlay_opacity: 0.4,
            visualizer_color: '#4FACFE'
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
                grad.addColorStop(0, cfg.visualizer_color || '#4FACFE');
                grad.addColorStop(1, '#00F2FE');

                ctx.fillStyle = grad;
                ctx.fillRect(startX + i * barW + 2, baseY - barH, barW - 4, barH);
            }
            ctx.restore();

            ctx.save();
            ctx.translate(width / 2, height * (cfg.position_y / 100));

            ctx.font = `${cfg.font_weight} ${cfg.font_size * (height / 1080)}px ${cfg.font_family}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (cfg.outline_width > 0) {
                ctx.strokeStyle = cfg.outline_color;
                ctx.lineWidth = cfg.outline_width * 2;
                ctx.strokeText(text, 0, 0);
            }

            ctx.fillStyle = cfg.text_color;
            ctx.shadowColor = cfg.glow_color;
            ctx.shadowBlur = cfg.glow_size;
            ctx.fillText(text, 0, 0);

            ctx.restore();
        }
    }
};
