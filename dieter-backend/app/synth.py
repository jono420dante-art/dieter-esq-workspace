from __future__ import annotations

import math
import wave
from array import array
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple, TypedDict


SR = 44100


def _clamp(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x


def _hz(note: str) -> float:
    # minimal note parser: e.g. A2, C#3, Eb4
    note = note.strip()
    if len(note) < 2:
        return 440.0
    name = note[:-1]
    octave = int(note[-1])
    semis = {
        "C": -9,
        "C#": -8,
        "Db": -8,
        "D": -7,
        "D#": -6,
        "Eb": -6,
        "E": -5,
        "F": -4,
        "F#": -3,
        "Gb": -3,
        "G": -2,
        "G#": -1,
        "Ab": -1,
        "A": 0,
        "A#": 1,
        "Bb": 1,
        "B": 2,
    }.get(name, 0)
    n = semis + 12 * (octave - 4)
    return 440.0 * (2 ** (n / 12))


class TrackStats(TypedDict):
    peak: float
    rms: float


def _dbfs(x: float) -> float:
    x = max(1e-12, abs(x))
    return 20.0 * math.log10(x)


def _adsr(i: int, n: int, a: float, d: float, s: float, r: float) -> float:
    # ADSR in seconds, applied to n samples total
    t = i / SR
    total = n / SR
    if total <= 0:
        return 0.0
    a = max(1e-6, a)
    d = max(1e-6, d)
    r = max(1e-6, r)
    sustain_t = max(0.0, total - (a + d + r))
    if t < a:
        return t / a
    if t < a + d:
        return 1.0 - (1.0 - s) * ((t - a) / d)
    if t < a + d + sustain_t:
        return s
    # release
    rel_pos = (t - (a + d + sustain_t)) / r
    return s * max(0.0, 1.0 - rel_pos)


def _sine(phase: float) -> float:
    return math.sin(phase)


def _softclip(x: float) -> float:
    return math.tanh(2.0 * x) / math.tanh(2.0)


@dataclass(frozen=True)
class VoiceProfile:
    f0_min: float
    f0_max: float
    formant_scale: float
    breath: float
    vib_depth: float
    vib_rate: float
    gain: float


def _voice_profile(vocal_preset: str) -> VoiceProfile:
    p = (vocal_preset or "").strip().lower()
    if any(k in p for k in ("male", "man", "deep", "baritone", "bass")):
        return VoiceProfile(95.0, 170.0, 0.84, 0.05, 0.012, 4.8, 0.05)
    if any(k in p for k in ("female", "woman", "bright", "soprano", "alto")):
        return VoiceProfile(185.0, 320.0, 1.12, 0.08, 0.02, 5.8, 0.045)
    return VoiceProfile(140.0, 250.0, 1.0, 0.07, 0.016, 5.4, 0.043)


def render_multitrack_wav(
    *,
    out_dir: Path,
    prompt: str,
    lyrics: str = "",
    language: str = "en",
    vocal_preset: str = "Radio",
    bpm: int,
    duration_s: int,
    seed: int,
    render_stems: bool,
) -> Tuple[Path, Dict[str, Path], Dict[str, TrackStats]]:
    """
    Real (non-AI) procedural music renderer to WAV.
    This is production-safe as a fallback engine; model adapters can replace it later.
    """
    # deterministic pseudo-random without importing random (stable across processes)
    def rnd(k: int) -> float:
        x = math.sin((seed + k) * 12.9898) * 43758.5453
        return x - math.floor(x)

    total = int(duration_s * SR)
    beat = 60.0 / max(40, min(240, bpm))
    spb = int(beat * SR)

    # choose a scale / root deterministically from prompt
    roots = ["A2", "C3", "D3", "E2", "F2", "G2"]
    root = roots[seed % len(roots)]
    scale = ["A", "C", "D", "E", "G"] if ("minor" in prompt.lower() or "dark" in prompt.lower()) else ["C", "D", "E", "G", "A"]

    # chord progression (4 chords)
    prog = [
        _hz(root),
        _hz(scale[(seed + 1) % len(scale)] + "2"),
        _hz(scale[(seed + 2) % len(scale)] + "2"),
        _hz(scale[(seed + 3) % len(scale)] + "2"),
    ]

    bars = max(1, int(duration_s / (beat * 4)))
    bar_len = spb * 4
    step = max(1, int((beat / 4) * SR))  # 16th

    # precompute lead events to reduce per-sample branching
    chord_tones = [0, 4, 7, 12]
    lead_events: list[tuple[int, int, float]] = []
    for i in range(0, total, step):
        if rnd(i) < 0.55:
            continue
        chord_hz = prog[(i // (step * 16)) % len(prog)]
        interval = chord_tones[int(rnd(i + 7) * len(chord_tones)) % len(chord_tones)]
        hz = chord_hz * (2 ** (interval / 12)) * 2
        note_len = int(step * (1 + int(rnd(i + 13) * 3)))
        lead_events.append((i, min(total, i + note_len), hz))
    lead_events.sort(key=lambda x: x[0])
    lead_idx = 0

    # --- VOCALS: simple singing synth driven by lyrics (vowel-ish formants) ---
    def pick_vowel(word: str) -> str:
        w = word.lower()
        for ch in "aeiou":
            if ch in w:
                return ch
        return "a"

    # Rough vowel formants (Hz) for "singing-like" tone
    vowel_formants = {
        "a": (800.0, 1150.0),
        "e": (530.0, 1840.0),
        "i": (270.0, 2290.0),
        "o": (570.0, 840.0),
        "u": (300.0, 870.0),
    }

    profile = _voice_profile(vocal_preset)

    # Convert chord root Hz -> target register from voice profile
    def vocal_f0_for_bar(bar_i: int) -> float:
        base_hz = prog[bar_i % len(prog)]
        hz = base_hz * 4.0
        while hz < profile.f0_min:
            hz *= 2.0
        while hz > profile.f0_max:
            hz *= 0.5
        return _clamp(hz, profile.f0_min, profile.f0_max)

    # Build events: one word = one 8th note by default
    lyric_words = [w for w in (lyrics or "").replace("\n", " ").split(" ") if w.strip()]
    vocal_events: list[tuple[int, int, float, str]] = []
    if lyric_words:
        eighth = step * 2
        max_events = min(len(lyric_words), max(1, total // eighth))
        for idx in range(max_events):
            start = idx * eighth
            end = min(total, start + eighth)
            bar_i = start // bar_len
            f0 = vocal_f0_for_bar(int(bar_i))
            vowel = pick_vowel(lyric_words[idx])
            vocal_events.append((start, end, f0, vowel))
    vocal_idx = 0
    vocal_phase = 0.0
    vibr_phase = 0.0

    # Simple resonator state per formant (two formants)
    f1_y1 = f1_y2 = 0.0
    f2_y1 = f2_y2 = 0.0
    cur_vowel = "a"
    f1_w = f2_w = 0.0
    r = 0.99  # damping (lower = more stable)

    def set_formants(vowel: str) -> None:
        nonlocal cur_vowel, f1_w, f2_w
        if vowel == cur_vowel:
            return
        cur_vowel = vowel
        f1, f2 = vowel_formants.get(vowel, vowel_formants["a"])
        f1 *= profile.formant_scale
        f2 *= profile.formant_scale
        f1_w = 2.0 * math.pi * (f1 / SR)
        f2_w = 2.0 * math.pi * (f2 / SR)

    # initialize formants
    f1, f2 = vowel_formants["a"]
    f1 *= profile.formant_scale
    f2 *= profile.formant_scale
    f1_w = 2.0 * math.pi * (f1 / SR)
    f2_w = 2.0 * math.pi * (f2 / SR)

    # preset shaping layered on top of male/female profile
    preset = (vocal_preset or "").lower()
    breath = profile.breath + (0.02 if "trap" in preset else 0.0) + (0.03 if "alien" in preset else 0.0)
    vib_depth = profile.vib_depth + (0.004 if "choir" in preset else 0.0) + (0.006 if "elf" in preset else 0.0)
    vib_rate = profile.vib_rate + (0.5 if "trap" in preset else 0.0)

    mix_path = out_dir / "mix.wav"
    stems_out: Dict[str, Path] = {}
    stem_files: dict[str, wave.Wave_write] = {}

    def open_wav(p: Path) -> wave.Wave_write:
        p.parent.mkdir(parents=True, exist_ok=True)
        wf = wave.open(str(p), "wb")
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        return wf

    mix_wf = open_wav(mix_path)
    if render_stems:
        stems_out = {
            "drums": out_dir / "drums.wav",
            "bass": out_dir / "bass.wav",
            "keys": out_dir / "keys.wav",
            "lead": out_dir / "lead.wav",
            "vocals": out_dir / "vocals.wav",
            "fx": out_dir / "fx.wav",
        }
        stem_files = {k: open_wav(p) for k, p in stems_out.items()}

    stats: Dict[str, TrackStats] = {
        "mix": {"peak": 0.0, "rms": 0.0},
        "drums": {"peak": 0.0, "rms": 0.0},
        "bass": {"peak": 0.0, "rms": 0.0},
        "keys": {"peak": 0.0, "rms": 0.0},
        "lead": {"peak": 0.0, "rms": 0.0},
        "vocals": {"peak": 0.0, "rms": 0.0},
        "fx": {"peak": 0.0, "rms": 0.0},
    }
    sums: Dict[str, float] = {k: 0.0 for k in stats.keys()}

    kick_len = int(0.18 * SR)
    hat_len = int(0.05 * SR)

    # oscillator phases
    bass_phase = 0.0
    pad_phase0 = 0.0
    pad_phase1 = 0.0
    pad_phase2 = 0.0
    lead_phase = 0.0
    lead_phase2 = 0.0

    block = 2048
    for base in range(0, total, block):
        n_samp = min(block, total - base)
        mix_i16 = array("h")
        drums_i16 = array("h")
        bass_i16 = array("h")
        keys_i16 = array("h")
        lead_i16 = array("h")
        vocals_i16 = array("h")
        fx_i16 = array("h")

        for j in range(n_samp):
            i = base + j
            bar_i = i // bar_len
            chord_hz = prog[bar_i % len(prog)]

            # DRUMS
            beat_pos = i % spb
            drum = 0.0
            if beat_pos < kick_len:
                env = _adsr(beat_pos, kick_len, 0.001, 0.03, 0.0, 0.05)
                f0 = 90.0 - 50.0 * (beat_pos / kick_len)
                drum += 0.9 * env * math.sin(2 * math.pi * f0 * (beat_pos / SR))
            hat_pos = (i - (spb // 2)) % spb
            if hat_pos < hat_len:
                env = _adsr(hat_pos, hat_len, 0.001, 0.01, 0.0, 0.02)
                noise = (rnd(i) * 2.0 - 1.0)
                drum += 0.12 * env * noise

            # BASS: 1/2 note pulse at bar start
            bass_s = 0.0
            in_bar = i % bar_len
            half_len = spb * 2
            if in_bar < half_len:
                env = _adsr(in_bar, half_len, 0.01, 0.08, 0.6, 0.12)
                bass_phase += (2 * math.pi * chord_hz) / SR
                bass_s = 0.35 * env * math.sin(bass_phase)

            # KEYS: pad triad per bar
            hz0 = chord_hz
            hz1 = hz0 * (2 ** (4 / 12))
            hz2 = hz0 * (2 ** (7 / 12))
            pad_env = _adsr(in_bar, bar_len, 0.2, 0.3, 0.7, 0.4)
            pad_phase0 += (2 * math.pi * hz0) / SR
            pad_phase1 += (2 * math.pi * hz1) / SR
            pad_phase2 += (2 * math.pi * hz2) / SR
            keys_s = 0.12 * pad_env * (
                math.sin(pad_phase0) + 0.8 * math.sin(pad_phase1) + 0.7 * math.sin(pad_phase2)
            )

            # LEAD: advance to current active event (if any)
            lead_s = 0.0
            while lead_idx < len(lead_events) and lead_events[lead_idx][1] <= i:
                lead_idx += 1
            if lead_idx < len(lead_events):
                ev_s, ev_e, ev_hz = lead_events[lead_idx]
                if ev_s <= i < ev_e:
                    rel = i - ev_s
                    env = _adsr(rel, ev_e - ev_s, 0.01, 0.06, 0.45, 0.08)
                    lead_phase += (2 * math.pi * ev_hz) / SR
                    lead_phase2 += (2 * math.pi * ev_hz * 2) / SR
                    lead_s = 0.14 * env * (math.sin(lead_phase) + 0.25 * math.sin(lead_phase2))

            # FX: riser every 8 bars
            fx_s = 0.0
            if (bar_i % 8) == 0 and in_bar < int(min(2.5, beat * 4) * SR):
                riser_len = int(min(2.5, beat * 4) * SR)
                env = in_bar / max(1, riser_len)
                fx_s = 0.05 * env * (rnd(i + 999) * 2.0 - 1.0)

            # VOCALS: singing-like synth if lyrics present
            vox = 0.0
            if vocal_events:
                while vocal_idx < len(vocal_events) and vocal_events[vocal_idx][1] <= i:
                    vocal_idx += 1
                if vocal_idx < len(vocal_events):
                    vs, ve, f0, vowel = vocal_events[vocal_idx]
                    if vs <= i < ve:
                        rel = i - vs
                        env = _adsr(rel, ve - vs, 0.01, 0.05, 0.75, 0.08)
                        set_formants(vowel)
                        # vibrato
                        vibr_phase += (2.0 * math.pi * vib_rate) / SR
                        f = f0 * (1.0 + vib_depth * math.sin(vibr_phase))
                        vocal_phase += (2.0 * math.pi * f) / SR
                        # saw-ish source + breath noise
                        src = math.sin(vocal_phase) + 0.22 * math.sin(2.0 * vocal_phase) + 0.10 * math.sin(3.0 * vocal_phase)
                        src += breath * (rnd(i + 4242) * 2.0 - 1.0)

                        # two damped resonators (formants)
                        x = src * env
                        c1 = 2.0 * r * math.cos(f1_w)
                        y1 = x + c1 * f1_y1 - (r * r) * f1_y2
                        f1_y2 = f1_y1
                        f1_y1 = y1

                        c2 = 2.0 * r * math.cos(f2_w)
                        y2 = x + c2 * f2_y1 - (r * r) * f2_y2
                        f2_y2 = f2_y1
                        f2_y1 = y2

                        # conservative gain + softclip for stability
                        vox = _softclip(profile.gain * (0.65 * y1 + 0.55 * y2))

            # clamp components before stats
            drum_c = _clamp(drum, -1.0, 1.0)
            bass_c = _clamp(bass_s, -1.0, 1.0)
            keys_c = _clamp(keys_s, -1.0, 1.0)
            lead_c = _clamp(lead_s, -1.0, 1.0)
            vox_c = _clamp(vox, -1.0, 1.0)
            fx_c = _clamp(fx_s, -1.0, 1.0)

            mix_s = _softclip((drum_c * 0.95 + bass_c + keys_c + lead_c + vox_c + fx_c) * 0.9)

            # stats
            for name, s in (
                ("mix", mix_s),
                ("drums", drum_c),
                ("bass", bass_c),
                ("keys", keys_c),
                ("lead", lead_c),
                ("vocals", vox_c),
                ("fx", fx_c),
            ):
                a = abs(s)
                if a > stats[name]["peak"]:
                    stats[name]["peak"] = a
                sums[name] += s * s

            def to_i16(s: float) -> int:
                s = _clamp(s, -1.0, 1.0)
                return int(s * 32767.0) if s >= 0 else int(s * 32768.0)

            mix_i16.append(to_i16(mix_s))
            if render_stems:
                drums_i16.append(to_i16(drum))
                bass_i16.append(to_i16(bass_s))
                keys_i16.append(to_i16(keys_s))
                lead_i16.append(to_i16(lead_s))
                vocals_i16.append(to_i16(vox))
                fx_i16.append(to_i16(fx_s))

        mix_wf.writeframes(mix_i16.tobytes())
        if render_stems:
            stem_files["drums"].writeframes(drums_i16.tobytes())
            stem_files["bass"].writeframes(bass_i16.tobytes())
            stem_files["keys"].writeframes(keys_i16.tobytes())
            stem_files["lead"].writeframes(lead_i16.tobytes())
            stem_files["vocals"].writeframes(vocals_i16.tobytes())
            stem_files["fx"].writeframes(fx_i16.tobytes())

    mix_wf.close()
    for wf in stem_files.values():
        wf.close()

    for name in stats.keys():
        stats[name]["rms"] = math.sqrt(sums[name] / max(1, total))

    return mix_path, stems_out, stats

