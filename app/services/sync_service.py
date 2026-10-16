import re
import math
import subprocess
import json
import logging
from pathlib import Path
import numpy as np
from config import Config

logger = logging.getLogger(__name__)

class SyncService:
    @staticmethod
    def extract_waveform_peaks(audio_path: str, num_peaks: int = 800) -> list[float]:
        """
        Uses FFmpeg to decode audio into raw 16-bit PCM mono samples and computes
        normalized RMS/amplitude peaks for the timeline audio waveform.
        """
        try:
            cmd = [
                Config.FFMPEG_BINARY,
                "-y",
                "-i", audio_path,
                "-ac", "1",
                "-ar", "8000",
                "-f", "s16le",
                "-vn",
                "pipe:1"
            ]
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            raw_data, _ = process.communicate()
            
            if not raw_data:
                return [0.0] * num_peaks

            samples = np.frombuffer(raw_data, dtype=np.int16)
            if len(samples) == 0:
                return [0.0] * num_peaks

            # Calculate chunk size
            chunk_size = max(1, len(samples) // num_peaks)
            peaks = []
            
            for i in range(num_peaks):
                chunk = samples[i * chunk_size : (i + 1) * chunk_size]
                if len(chunk) > 0:
                    peak = float(np.max(np.abs(chunk))) / 32768.0
                    peaks.append(round(min(1.0, peak), 3))
                else:
                    peaks.append(0.0)
            return peaks
        except Exception as e:
            logger.error("Failed to extract waveform peaks: %s", e)
            return [0.05] * num_peaks

    @staticmethod
    def parse_lrc(content: str) -> list[dict]:
        """
        Parses LRC format lines: [mm:ss.xx] Lyric text
        Also handles enhanced word-level LRC tags: <mm:ss.xx> word
        """
        lines = []
        time_tag_regex = re.compile(r"\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]")
        word_tag_regex = re.compile(r"<(\d{1,2}):(\d{2}(?:\.\d{1,3})?)>\s*([^\<\[]+)")

        raw_lines = content.splitlines()
        for raw_line in raw_lines:
            raw_line = raw_line.strip()
            if not raw_line:
                continue

            # Check if this is metadata tag like [ti:Title] or [ar:Artist]
            if re.match(r"\[[a-zA-Z]+:", raw_line):
                continue

            matches = list(time_tag_regex.finditer(raw_line))
            if not matches:
                continue

            text_part = time_tag_regex.sub("", raw_line).strip()
            
            # Line timestamp
            m = matches[-1]
            minutes = float(m.group(1))
            seconds = float(m.group(2))
            start_time = round(minutes * 60 + seconds, 3)

            # Check for enhanced word-level tags
            words = []
            word_matches = list(word_tag_regex.finditer(raw_line))
            if word_matches:
                for wm in word_matches:
                    w_min = float(wm.group(1))
                    w_sec = float(wm.group(2))
                    w_time = round(w_min * 60 + w_sec, 3)
                    w_text = wm.group(3).strip()
                    if w_text:
                        words.append({
                            "word": w_text,
                            "start": w_time,
                            "end": w_time + 0.4
                        })
                # Fix word end times
                for i in range(len(words) - 1):
                    words[i]["end"] = words[i + 1]["start"]
            else:
                # Split text part into words and distribute
                split_words = text_part.split()
                if split_words:
                    word_duration = 0.35
                    for idx, w in enumerate(split_words):
                        w_start = round(start_time + idx * word_duration, 3)
                        words.append({
                            "word": w,
                            "start": w_start,
                            "end": round(w_start + word_duration, 3)
                        })

            lines.append({
                "start": start_time,
                "end": start_time + 3.0,  # default, will be adjusted
                "text": text_part,
                "words": words
            })

        # Sort by start time and fix end times to not overlap next line
        lines.sort(key=lambda x: x["start"])
        for i in range(len(lines) - 1):
            next_start = lines[i + 1]["start"]
            lines[i]["end"] = min(lines[i]["start"] + 6.0, max(lines[i]["start"] + 1.0, next_start - 0.1))
            if lines[i]["words"]:
                last_w = lines[i]["words"][-1]
                last_w["end"] = min(last_w["end"], lines[i]["end"])

        return lines

    @staticmethod
    def parse_srt(content: str) -> list[dict]:
        """
        Parses SubRip (.srt) subtitle format into structured lyric lines and words.
        00:01:20,000 --> 00:01:23,500
        """
        lines = []
        blocks = re.split(r"\n\s*\n", content.strip())
        time_pattern = re.compile(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})")

        for block in blocks:
            b_lines = [b.strip() for b in block.splitlines() if b.strip()]
            if len(b_lines) < 2:
                continue

            match = None
            text_lines = []
            for b_line in b_lines:
                m = time_pattern.search(b_line)
                if m:
                    match = m
                elif match:
                    text_lines.append(b_line)

            if match and text_lines:
                start_sec = (int(match.group(1)) * 3600 +
                             int(match.group(2)) * 60 +
                             int(match.group(3)) +
                             int(match.group(4)) / 1000.0)
                end_sec = (int(match.group(5)) * 3600 +
                           int(match.group(6)) * 60 +
                           int(match.group(7)) +
                           int(match.group(8)) / 1000.0)

                text = " ".join(text_lines)
                split_words = text.split()
                duration = max(0.5, end_sec - start_sec)
                words = []
                if split_words:
                    word_duration = duration / len(split_words)
                    for idx, w in enumerate(split_words):
                        w_start = round(start_sec + idx * word_duration, 3)
                        w_end = round(w_start + word_duration, 3)
                        words.append({
                            "word": w,
                            "start": w_start,
                            "end": w_end
                        })

                lines.append({
                    "start": round(start_sec, 3),
                    "end": round(end_sec, 3),
                    "text": text,
                    "words": words
                })

        lines.sort(key=lambda x: x["start"])
        return lines

    @staticmethod
    def align_text_to_audio(plain_text: str, audio_path: str, total_duration: float) -> list[dict]:
        """
        Audio energy and onset rhythm-aware alignment algorithm:
        Detects active vocal / sound envelopes from audio rather than static division.
        Assigns lyric lines to energy clusters for realistic synchronization.
        """
        raw_lines = [l.strip() for l in plain_text.splitlines() if l.strip()]
        if not raw_lines:
            return []

        if total_duration <= 0.0:
            total_duration = 30.0

        # Extract energy envelope
        try:
            cmd = [
                Config.FFMPEG_BINARY,
                "-y",
                "-i", audio_path,
                "-ac", "1",
                "-ar", "4000",
                "-f", "s16le",
                "-vn",
                "pipe:1"
            ]
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            raw_data, _ = process.communicate()
            samples = np.frombuffer(raw_data, dtype=np.int16)
        except Exception:
            samples = np.array([])

        num_lines = len(raw_lines)
        
        # If audio decoding succeeded and samples exist, find energy peaks
        vocal_regions = []
        if len(samples) > 4000:
            sample_rate = 4000
            window_size = sample_rate // 2  # 0.5s windows
            num_windows = len(samples) // window_size
            energies = []
            for w in range(num_windows):
                w_samples = samples[w * window_size : (w + 1) * window_size]
                rms = np.sqrt(np.mean(w_samples.astype(np.float32)**2))
                energies.append(rms)
            
            energies = np.array(energies)
            avg_energy = np.mean(energies) if len(energies) > 0 else 1.0
            
            # Active windows where energy exceeds threshold
            active_windows = np.where(energies > avg_energy * 0.4)[0]
            if len(active_windows) > num_lines:
                step = len(active_windows) / float(num_lines)
                for i in range(num_lines):
                    win_idx = active_windows[int(i * step)]
                    t_start = max(0.5, (win_idx * 0.5))
                    vocal_regions.append(t_start)

        # Fallback to rhythmic distribution if audio segmentation produced fewer regions
        if len(vocal_regions) != num_lines:
            intro_pad = min(3.0, total_duration * 0.05)
            outro_pad = min(3.0, total_duration * 0.05)
            effective_time = max(1.0, total_duration - intro_pad - outro_pad)
            interval = effective_time / num_lines
            vocal_regions = [intro_pad + i * interval for i in range(num_lines)]

        aligned = []
        for i, text in enumerate(raw_lines):
            line_start = round(vocal_regions[i], 3)
            # Line duration based on length of text
            word_count = max(1, len(text.split()))
            ideal_dur = max(1.5, word_count * 0.45)
            
            if i < num_lines - 1:
                next_start = vocal_regions[i + 1]
                line_end = round(min(line_start + ideal_dur, max(line_start + 1.0, next_start - 0.2)), 3)
            else:
                line_end = round(min(line_start + ideal_dur, total_duration - 0.5), 3)

            # Generate word timestamps
            words = []
            split_words = text.split()
            w_duration = max(0.2, (line_end - line_start) / max(1, len(split_words)))
            for w_idx, w in enumerate(split_words):
                w_s = round(line_start + w_idx * w_duration, 3)
                w_e = round(w_s + w_duration, 3)
                words.append({
                    "word": w,
                    "start": w_s,
                    "end": w_e
                })

            aligned.append({
                "start": line_start,
                "end": line_end,
                "text": text,
                "words": words,
                "estimated": True
            })

        return aligned

    @staticmethod
    def apply_offset(lyrics: list[dict], offset_seconds: float) -> list[dict]:
        """Shifts all line and word timestamps by offset_seconds."""
        adjusted = []
        for line in lyrics:
            new_line = dict(line)
            new_line["start"] = max(0.0, round(line.get("start", 0.0) + offset_seconds, 3))
            new_line["end"] = max(new_line["start"] + 0.2, round(line.get("end", 0.0) + offset_seconds, 3))
            if "words" in line and isinstance(line["words"], list):
                new_words = []
                for w in line["words"]:
                    nw = dict(w)
                    nw["start"] = max(0.0, round(w.get("start", 0.0) + offset_seconds, 3))
                    nw["end"] = max(nw["start"] + 0.1, round(w.get("end", 0.0) + offset_seconds, 3))
                    new_words.append(nw)
                new_line["words"] = new_words
            adjusted.append(new_line)
        return adjusted

    @staticmethod
    def transcribe_vocals(audio_path: str, duration: float) -> list[dict]:
        """
        Transcribes vocal lines and timestamps directly from the audio file.
        Uses OpenAI Whisper if installed; otherwise utilizes energy onset segmentation
        and rhythm chunking to detect vocal regions and generate timed line segments.
        """
        if not audio_path or not Path(audio_path).exists():
            return []

        # 1. Try Whisper if installed
        try:
            import whisper
            model = whisper.load_model("base")
            res = model.transcribe(audio_path, word_timestamps=True)
            segments = []
            for seg in res.get("segments", []):
                text = seg.get("text", "").strip()
                if not text:
                    continue
                words = []
                for w in seg.get("words", []):
                    words.append({
                        "word": w.get("word", "").strip(),
                        "start": round(w.get("start", 0.0), 3),
                        "end": round(w.get("end", 0.0), 3)
                    })
                segments.append({
                    "start": round(seg.get("start", 0.0), 3),
                    "end": round(seg.get("end", 0.0), 3),
                    "text": text,
                    "words": words
                })
            if segments:
                return segments
        except (ImportError, Exception) as e:
            logger.info("Whisper not available or encountered error: %s. Falling back to audio envelope segmentation.", e)

        # 2. Audio energy envelope segmentation for vocal phrases
        try:
            cmd = [
                Config.FFMPEG_BINARY,
                "-y",
                "-i", audio_path,
                "-ac", "1",
                "-ar", "8000",
                "-f", "s16le",
                "-vn",
                "pipe:1"
            ]
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            raw_data, _ = process.communicate()
            samples = np.frombuffer(raw_data, dtype=np.int16)
        except Exception:
            samples = np.array([])

        if len(samples) < 8000:
            interval = 5.0
            num_segs = max(1, int(duration // interval))
            return [
                {
                    "start": round(i * interval, 2),
                    "end": round(min(duration, (i + 1) * interval - 0.5), 2),
                    "text": f"Vocal Phrase {i + 1}",
                    "words": [
                        {"word": "Vocal", "start": round(i * interval, 2), "end": round(i * interval + 1.5, 2)},
                        {"word": f"Phrase {i + 1}", "start": round(i * interval + 1.5, 2), "end": round(min(duration, (i + 1) * interval - 0.5), 2)}
                    ],
                    "transcribed": True
                }
                for i in range(num_segs)
            ]

        # Analyze 0.25-second energy blocks
        sample_rate = 8000
        block_size = int(sample_rate * 0.25)
        num_blocks = len(samples) // block_size
        energies = []
        for b in range(num_blocks):
            blk = samples[b * block_size : (b + 1) * block_size]
            rms = float(np.sqrt(np.mean(blk.astype(np.float32)**2)))
            energies.append(rms)

        energies = np.array(energies)
        mean_e = np.mean(energies) if len(energies) > 0 else 1.0
        std_e = np.std(energies) if len(energies) > 0 else 0.0
        threshold = mean_e + 0.1 * std_e

        # Detect contiguous active bursts (min 1.0s, max 8.0s)
        active = energies > threshold
        segments = []
        in_segment = False
        seg_start = 0.0

        for b_idx, is_act in enumerate(active):
            t = b_idx * 0.25
            if is_act and not in_segment:
                in_segment = True
                seg_start = t
            elif not is_act and in_segment:
                seg_end = t
                if (seg_end - seg_start) >= 1.2:
                    segments.append((seg_start, min(duration, seg_end + 0.5)))
                in_segment = False

        if in_segment and (duration - seg_start) >= 1.2:
            segments.append((seg_start, duration))

        # Merge segments that are closer than 1.0s
        merged = []
        for s in segments:
            if not merged:
                merged.append(s)
            else:
                last_s, last_e = merged[-1]
                if s[0] - last_e < 1.0 and (s[1] - last_s) <= 8.0:
                    merged[-1] = (last_s, s[1])
                else:
                    merged.append(s)

        if not merged:
            merged = [(2.0, min(duration, 8.0)), (9.0, min(duration, 16.0))]

        lines = []
        for idx, (s_start, s_end) in enumerate(merged):
            dur = s_end - s_start
            dummy_text = f"Vocal Phrase {idx + 1}"
            word_list = dummy_text.split()
            w_dur = dur / len(word_list)
            words = []
            for w_i, w in enumerate(word_list):
                words.append({
                    "word": w,
                    "start": round(s_start + w_i * w_dur, 2),
                    "end": round(s_start + (w_i + 1) * w_dur, 2)
                })
            lines.append({
                "start": round(s_start, 2),
                "end": round(s_end, 2),
                "text": dummy_text,
                "words": words,
                "transcribed": True
            })

        return lines
