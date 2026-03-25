"""
Suno / Mureka-style **bus layering** — preset + FFmpeg ``filter_complex``.

Implements the ED-GEERDES vocal / drum / instrument bus recipe (levels, delays, HPF, light reverb)
and a short master chain (EQ tilt, compression, slap echo, room). Stems are **real files** on disk
(storage keys resolved by the API). Missing roles are omitted; at least one stem required.

This is a **mix recipe engine**, not ML vocal synthesis (see Mureka cloud for that).
"""

from __future__ import annotations

import logging
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# --- Canonical layering spec (matches product brief) ---------------------------------

SUNO_MUREKA_LAYERING_PRESET: dict[str, Any] = {
    "name": "suno_mureka_default",
    "version": 1,
    "description": "Lead + doubles + harmonies + ad-libs; drum bus; instrument bus; master chain.",
    "vocal_bus": {
        "lead": {"gain_db": 0.0, "delay_ms": 0, "pan": 0.0, "note": "0 dB reference"},
        "double": {"gain_db": -6.0, "delay_ms": 15, "pan": 0.0, "note": "double-track, 15 ms"},
        "harmony": {
            "gain_db": -12.0,
            "pan_stereo": True,
            "note": "L/R or single stem widened; 3rd/5th stems should be pre-shifted in DAW",
        },
        "harmony_l": {"gain_db": -12.0, "pan": -0.35},
        "harmony_r": {"gain_db": -12.0, "pan": 0.35},
        "adlib": {"gain_db": -18.0, "reverb_wet": 0.4, "note": "background, wetter"},
    },
    "drum_bus": {
        "kick": {"gain_db": -6.0, "mono_center": True},
        "snare": {"gain_db": 0.0, "stereo": True},
        "hihat": {
            "gain_db": 0.0,
            "hpf_hz": 200,
            "reverb_wet": 0.2,
        },
    },
    "instrument_bus": {
        "bass": {"gain_db": 0.0, "mono_center": True, "lfe_lowpass_hz": 200},
        "gtr_center": {"gain_db": 0.0, "note": "rhythm guitar center"},
        "gtr_l": {"gain_db": -1.5, "pan": -0.25},
        "gtr_r": {"gain_db": -1.5, "pan": 0.25},
        "pad": {"gain_db": 0.0, "hpf_hz": 300, "reverb_wet": 0.3},
    },
    "thickening_reference": {
        "original_pct": 100,
        "doubles_pct": 60,
        "harmonies_pct": 40,
        "double_ms_humanize_range": [10, 20],
    },
    "master_chain": {
        "deess": {"freq_hz": 6500, "ratio": 4, "implementation": "eq_notch_approx"},
        "eq": [{"f_hz": 3000, "gain_db": 3, "q": "moderate"}, {"f_hz": 400, "gain_db": -2}],
        "compressor": {"ratio": 4, "threshold_db": -20},
        "delay_slap": {"division_8note_sec_approx": None, "wet": 0.3},
        "reverb_room": {"decay_sec": 1.5, "wet": 0.25},
    },
}


def _which_ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg not found on PATH")
    return exe


def _sanitize_label(s: str) -> str:
    return re.sub(r"[^a-z0-9_]", "_", s.lower())


def _aecho_from_wet(wet: float, base_ms: int = 45) -> str:
    """Small room echo; wet in 0..1 maps to output gain."""
    wet = max(0.0, min(0.95, wet))
    return f"aecho=0.8:{wet:.2f}:{base_ms}:0.25"


def _mono_center_stereo() -> str:
    return "aformat=channel_layouts=mono,pan=stereo|c0=0.707*c0|c1=0.707*c0"


def _pan_mono(pan: float) -> str:
    """Constant power pan for mono source; pan in [-1, 1]."""
    p = max(-1.0, min(1.0, pan))
    # Simple linear pan-law labels for pan filter (mono in)
    if p <= -0.01:
        return "pan=stereo|c0=1.0*c0|c1=0.0*c0"
    if p >= 0.01:
        return "pan=stereo|c0=0.0*c0|c1=1.0*c0"
    return "pan=stereo|c0=0.707*c0|c1=0.707*c0"


def _role_chain(role: str) -> str:
    """Single-filter-chain (comma-separated) for one stem after aresample."""
    vb = SUNO_MUREKA_LAYERING_PRESET["vocal_bus"]
    db = SUNO_MUREKA_LAYERING_PRESET["drum_bus"]
    ib = SUNO_MUREKA_LAYERING_PRESET["instrument_bus"]

    parts: list[str] = ["aresample=44100"]

    if role == "lead":
        parts.append(f"volume={vb['lead']['gain_db']}dB")
    elif role == "double":
        d = int(vb["double"]["delay_ms"])
        parts.append(f"adelay={d}|{d}")
        parts.append(f"volume={vb['double']['gain_db']}dB")
    elif role == "harmony":
        parts.append(f"volume={vb['harmony']['gain_db']}dB")
        parts.append("extrastereo=2.2")
    elif role == "harmony_l":
        parts.append(f"volume={vb['harmony_l']['gain_db']}dB")
        parts.append(_pan_mono(vb["harmony_l"]["pan"]))
    elif role == "harmony_r":
        parts.append(f"volume={vb['harmony_r']['gain_db']}dB")
        parts.append(_pan_mono(vb["harmony_r"]["pan"]))
    elif role == "adlib":
        parts.append(f"volume={vb['adlib']['gain_db']}dB")
        parts.append(_aecho_from_wet(float(vb["adlib"]["reverb_wet"])))
    elif role == "kick":
        parts.append(f"volume={db['kick']['gain_db']}dB")
        parts.append(_mono_center_stereo())
    elif role == "snare":
        parts.append(f"volume={db['snare']['gain_db']}dB")
        parts.append("aformat=channel_layouts=stereo")
    elif role == "hihat":
        h = int(db["hihat"]["hpf_hz"])
        parts.append(f"highpass=f={h}")
        parts.append(f"volume={db['hihat']['gain_db']}dB")
        parts.append(_aecho_from_wet(float(db["hihat"]["reverb_wet"]), base_ms=30))
    elif role == "bass":
        lp = int(ib["bass"]["lfe_lowpass_hz"])
        parts.append(f"lowpass=f={lp}")
        parts.append(f"volume={ib['bass']['gain_db']}dB")
        parts.append(_mono_center_stereo())
    elif role == "gtr_center":
        parts.append(f"volume={ib['gtr_center']['gain_db']}dB")
        parts.append(_mono_center_stereo())
    elif role == "gtr_l":
        parts.append(f"volume={ib['gtr_l']['gain_db']}dB")
        parts.append(_pan_mono(ib["gtr_l"]["pan"]))
    elif role == "gtr_r":
        parts.append(f"volume={ib['gtr_r']['gain_db']}dB")
        parts.append(_pan_mono(ib["gtr_r"]["pan"]))
    elif role == "pad":
        h = int(ib["pad"]["hpf_hz"])
        parts.append(f"highpass=f={h}")
        parts.append(f"volume={ib['pad']['gain_db']}dB")
        parts.append(_aecho_from_wet(float(ib["pad"]["reverb_wet"]), base_ms=60))
    else:
        parts.append("anull")

    return ",".join(parts)


def _master_chain_filters() -> str:
    mc = SUNO_MUREKA_LAYERING_PRESET["master_chain"]
    chunks: list[str] = [
        "equalizer=f=6500:width_type=h:width=2000:g=-3",
        "equalizer=f=3000:width_type=h:width=900:g=3",
        "equalizer=f=400:width_type=h:width=350:g=-2",
        f"acompressor=threshold={mc['compressor']['threshold_db']}dB:ratio={mc['compressor']['ratio']}:attack=20:release=250",
        "aecho=0.85:0.28:340:0.2",
        "aecho=0.75:0.22:1800:0.15",
        "alimiter=limit=0.95",
    ]
    return ",".join(chunks)


ROLE_GROUPS: dict[str, tuple[str, ...]] = {
    "vocal": ("lead", "double", "harmony", "harmony_l", "harmony_r", "adlib"),
    "drum": ("kick", "snare", "hihat"),
    "instrument": ("bass", "gtr_center", "gtr_l", "gtr_r", "pad"),
}

ALL_ROLES: tuple[str, ...] = tuple(
    r for group in ROLE_GROUPS.values() for r in group
)


def build_suno_mureka_mix(
    stems: dict[str, Path],
    out_path: Path,
    *,
    master: bool = True,
) -> dict[str, Any]:
    """
    Mix provided stems through bus architecture. ``stems`` keys are role names (see ``ALL_ROLES``).
    """
    for k, p in stems.items():
        if k not in ALL_ROLES:
            raise ValueError(f"Unknown stem role {k!r}; allowed: {ALL_ROLES}")
        if not p.is_file():
            raise FileNotFoundError(p)

    if not stems:
        raise ValueError("At least one stem path required")

    ff = _which_ffmpeg()
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Stable input order: all roles that are present, in ALL_ROLES order
    ordered = [r for r in ALL_ROLES if r in stems]
    inputs: list[str] = []
    for p in [stems[r] for r in ordered]:
        inputs.extend(["-i", str(p)])

    graph: list[str] = []
    bus_labels: dict[str, list[str]] = {"vocal": [], "drum": [], "instrument": []}

    for idx, role in enumerate(ordered):
        inl = f"{idx}:a"
        chain = _role_chain(role)
        lbl = _sanitize_label(f"stem_{role}_{idx}")
        graph.append(f"[{inl}]{chain}[{lbl}]")

        for bus, roles in ROLE_GROUPS.items():
            if role in roles:
                bus_labels[bus].append(lbl)
                break

    mix_parts: list[str] = []
    bus_outs: list[str] = []

    for bus in ("vocal", "drum", "instrument"):
        labs = bus_labels[bus]
        if not labs:
            continue
        if len(labs) == 1:
            bus_outs.append(f"bus_{bus}")
            graph.append(f"[{labs[0]}]anull[bus_{bus}]")
            continue
        ins = "".join(f"[{x}]" for x in labs)
        outb = f"bus_{bus}"
        bus_outs.append(outb)
        mix_parts.append(f"{ins}amix=inputs={len(labs)}:duration=longest:dropout_transition=0:normalize=0[{outb}]")

    graph.extend(mix_parts)

    if not bus_outs:
        raise RuntimeError("internal: no buses")

    if len(bus_outs) == 1:
        graph.append(f"[{bus_outs[0]}]anull[pre_master]")
        pre = "pre_master"
    else:
        ins = "".join(f"[{x}]" for x in bus_outs)
        graph.append(
            f"{ins}amix=inputs={len(bus_outs)}:duration=longest:dropout_transition=0:normalize=0[pre_master]"
        )
        pre = "pre_master"

    final_label = "aout"
    if master:
        graph.append(f"[{pre}]{_master_chain_filters()}[{final_label}]")
    else:
        graph.append(f"[{pre}]anull[{final_label}]")

    fc = ";".join(graph)

    cmd = [
        ff,
        "-hide_banner",
        "-y",
        *inputs,
        "-filter_complex",
        fc,
        "-map",
        f"[{final_label}]",
        "-ar",
        "44100",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "320k",
        str(out_path),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        err = (r.stderr or r.stdout or "").strip()
        logger.error("suno_mureka mix ffmpeg: %s", err[:2000])
        raise RuntimeError(err or "ffmpeg suno/mureka bus mix failed")

    return {
        "rolesUsed": ordered,
        "buses": {b: bool(bus_labels[b]) for b in bus_labels},
        "output": str(out_path),
        "preset": SUNO_MUREKA_LAYERING_PRESET["name"],
    }


def preset_summary() -> dict[str, Any]:
    return {
        "preset": SUNO_MUREKA_LAYERING_PRESET,
        "roles": list(ALL_ROLES),
        "notes": [
            "Harmony +3/+7 semitones: pitch stems in DAW or use /api/local/tempo-align + rubberband stem export.",
            "Reference-track blending (20–50%) is client-side gain before POST or add a 'reference' role later.",
        ],
    }
