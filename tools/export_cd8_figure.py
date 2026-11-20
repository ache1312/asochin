"""Render the CD8 figure from the saved ccRCC analysis.

Run from the deck with: python3 tools/export_cd8_figure.py /path/to/flowcv
"""

import argparse
import base64
import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator, PercentFormatter

RUN = "03af8504-0756-4810-9770-5d89c8c9d5c3"
W, H = 1300, 748
INK, MUTED = "#152238", "#475569"
TISSUE = ("Blood", "Tumor")
TISSUE_COLORS = ("#c43a4b", "#176aab")
PATIENT_COLORS = ("#4e79a7", "#f28e2b", "#59a14f", "#b07aa1", "#76b7b2", "#9c755f")
POPS = [
    ("Naive", (14,), "#7199c3"),
    ("Central memory", (13,), "#d88a16"),
    ("Circulating memory", (12,), "#9bad32"),
    ("Progenitor", (21,), "#bd4b79"),
    ("Effector", (10,), "#087f98"),
    ("Effector memory", (11,), "#245ebe"),
    ("Resident memory", (15, 17), "#288e5d"),
    ("Resident exhausted", (18, 19), "#8551c5"),
]
MARKERS = ("CCR7", "CD45RO", "GZMB", "CD69", "CD103", "PD-1", "TIM-3")
DISPLAY_COFACTOR = 150
SUPERSCRIPT = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def decade_ticks(low, high):
    """Label saved arcsinh coordinates in the deck's display units."""
    ticks = [(0.0, "0")] if low <= 0 <= high else []
    for exponent in range(5, 1, -1):
        label = f"10{str(exponent).translate(SUPERSCRIPT)}"
        for sign, prefix in [(-1, "−"), (1, "")]:
            value = float(np.arcsinh(sign * 10**exponent / DISPLAY_COFACTOR))
            gap = (.14 if sign < 0 else .085) * (high - low)
            if low <= value <= high and all(abs(value - x) >= gap for x, _ in ticks):
                ticks.append((value, prefix + label))
    return sorted(ticks)


def explicit_scatter_points(svg):
    """Keep marker paint explicit through Figure Studio's vector export."""
    namespace = "http://www.w3.org/2000/svg"
    xlink = "http://www.w3.org/1999/xlink"
    ET.register_namespace("", namespace)
    ET.register_namespace("xlink", xlink)
    root = ET.fromstring(svg)
    radii = {}
    for path in root.iter(f"{{{namespace}}}path"):
        name, tokens = path.get("id", ""), path.get("d", "").split()
        # scatter markers are "C0_0_<hex>"; glyph outlines ("SourceSans3-Bold-6f", text as paths) must stay untouched
        if re.fullmatch(r"C\d+_\d+_[0-9a-f]+", name) and tokens[:2] == ["M", "0"] and tokens[3:4] == ["C"] and tokens[-1] == "z":
            radii["#" + name] = tokens[2]
    for point in root.iter(f"{{{namespace}}}use"):
        radius = radii.get(point.get(f"{{{xlink}}}href"))
        if radius is None or "x" not in point.attrib:
            continue
        x, y = point.attrib.pop("x"), point.attrib.pop("y")
        point.attrib.pop(f"{{{xlink}}}href")
        style = dict(value.strip().split(": ", 1) for value in point.attrib.pop("style", "").split(";") if value.strip())
        point.tag = f"{{{namespace}}}circle"
        point.attrib.update({"cx": x, "cy": y, "r": radius, **style})
    return ET.tostring(root, encoding="unicode")


def render(flowcv, output, assistant_data=None):
    analysis = flowcv / "output/rcc-reanalysis-2026-11-10"
    sys.path.insert(0, str(analysis))
    from reanalysis_common import FEATURES36, FILES

    run = flowcv / "backend/app/data/run_artifacts" / RUN
    with gzip.open(next(run.glob("embedding-cd8_embedding_payload_*.json.gz")), "rt") as file:
        events = json.load(file)["points"]
    assert all(e["event_idx"] == i for i, e in enumerate(events))
    xy = np.array([(e["x"], e["y"]) for e in events])
    z = np.load(run / "flowsom_review-cd8_analysis_input.npz")
    data, source = z["matrix"], z["source_indices"]
    embedding_source = np.load(run / "embedding-cd8_analysis_input.npz")["source_indices"]
    np.testing.assert_array_equal(source, embedding_source)
    measured = np.array([FEATURES36.index("MNN-" + m) for m in MARKERS])
    labels = np.load(next(run.glob("flowsom_review-cd8_clustering_labels_*.npz")))["labels"]
    match = json.loads((analysis / "thesis-match/match.json").read_text())["CD8"]
    by_label = {row["mc"]: row["best"] for row in match}
    phenotype = np.array([by_label[int(label)] for label in labels])
    assert len(data) == len(xy) == len(phenotype) == 68_936
    assert set(source) == set(FILES)

    groups = np.stack([np.isin(phenotype, ids) for _, ids, _ in POPS])
    np.testing.assert_array_equal(groups.sum(axis=0), np.ones(len(source), dtype=int))
    colors = np.array([color for _, _, color in POPS])[groups.argmax(axis=0)]
    tissue_masks = [np.isin(source, [f for f, (_, t) in FILES.items() if t == tissue]) for tissue in ('B', 'T')]
    counts = np.stack([groups[:, mask].sum(axis=1) for mask in tissue_masks])
    totals = counts.sum(axis=1)
    np.testing.assert_array_equal(totals, [mask.sum() for mask in tissue_masks])
    fractions = 100 * counts / totals[:, None]
    print('Blood and tumor composition (%):', fractions.round(2).tolist())

    rng = np.random.default_rng(7)
    sample = []
    for tissue in ('B', 'T'):
        ids = [rng.choice(np.flatnonzero(source == f), 500, replace=False)
               for f, (_, t) in sorted(FILES.items()) if t == tissue]
        sample.append(np.concatenate(ids))
        rng.shuffle(sample[-1])
    shown = np.concatenate(sample)
    values = data[shown][:, measured].astype("<f4")
    lows = np.floor(values.min(axis=0)).astype(int)
    highs = np.ceil(values.max(axis=0)).astype(int)
    ticks = [decade_ticks(low, high) for low, high in zip(lows, highs)]
    marker_data = data[:, measured[-2:]]
    print("Full CD8 count per tissue", totals.tolist())

    # Same typeface as the deck (Source Sans 3), stored as outlines: the SVG is shown through <img>, which cannot
    # load the deck's web fonts, so live text would fall back to whatever font the presenting computer has.
    from matplotlib import font_manager
    for ttf in sorted((Path(__file__).resolve().parent.parent / "assets" / "fonts").glob("SourceSans3-*.ttf")):
        font_manager.fontManager.addfont(str(ttf))
    plt.rcParams.update({"svg.fonttype": "path", "svg.hashsalt": "asochin-cd8-figure",
                         "font.family": "Source Sans 3", "font.size": 13,
                         "axes.labelcolor": INK, "xtick.color": MUTED, "ytick.color": MUTED})
    fig = plt.figure(figsize=(W / 72, H / 72), facecolor="white")

    def caption(x, y, text, size=15, color=INK, **kwargs):
        fig.text(x / W, 1 - y / H, text, color=color, size=size, **kwargs)

    def axes(x, y, w, h):
        return fig.add_axes([x / W, 1 - (y + h) / H, w / W, h / H])

    def heading(x, y, letter, text, subtitle):
        caption(x, y, letter, 23, "#2563eb", weight="bold")
        caption(x + 31, y, text, 22, weight="bold")
        caption(x + 31, y + 23, subtitle, 14, MUTED)

    def polish(ax):
        for edge in ("top", "right"):
            ax.spines[edge].set_visible(False)
        for edge in ("bottom", "left"):
            ax.spines[edge].set_color("#8b9bac")
        ax.tick_params(axis="both", length=4, pad=4, labelsize=12)

    for x1, y1, x2, y2 in [(635, 16, 635, 720), (20, 404, 1280, 404)]:
        fig.add_artist(plt.Line2D([x1 / W, x2 / W], [1-y1/H, 1-y2/H],
                                  transform=fig.transFigure, color="#dbe4ed", lw=1.1))
    patients = sorted({p for p, _ in FILES.values()})
    patient_of = {f: p for f, (p, _) in FILES.items()}
    patient_idx = np.array([patients.index(patient_of[f]) for f in source])

    # A · every shown CD8 cell coloured by patient, next to each sample's cell-type composition (all CD8 cells).
    heading(24, 31, "A", "CD8 cells by patient", "UMAP coloured by patient · % of CD8 cells per sample (B blood, T tumor)")
    ax = axes(67, 81, 240, 240)
    ax.scatter(*xy[shown].T, s=6.0, c=np.array(PATIENT_COLORS)[patient_idx[shown]], alpha=0.7, linewidths=0)
    ax.set(xlim=(xy[shown, 0].min() - .5, xy[shown, 0].max() + .5),
           ylim=(xy[shown, 1].min() - .5, xy[shown, 1].max() + .5), xlabel="UMAP 1", ylabel="UMAP 2")
    ax.set_aspect("equal", adjustable="box")
    ax.xaxis.set_major_locator(MaxNLocator(4, integer=True))
    ax.yaxis.set_major_locator(MaxNLocator(4, integer=True))
    polish(ax)
    for i, patient in enumerate(patients):
        x, y = 48 + i % 3 * 96, 357 + i // 3 * 16
        caption(x, y, "●", 13, PATIENT_COLORS[i])
        caption(x + 15, y, patient, 12, MUTED)

    ax = axes(370, 81, 240, 240)
    bars = [(p, t) for p in patients for t in ("B", "T")]
    xs = np.array([i * 2 + k * .9 for i in range(len(patients)) for k in range(2)], dtype=float)
    bottom = np.zeros(len(bars))
    sample_counts = np.stack([groups[:, np.isin(source, [f for f, v in FILES.items() if v == bar])].sum(axis=1) for bar in bars])
    sample_fractions = 100 * sample_counts / sample_counts.sum(axis=1, keepdims=True)
    for i, (_, _, color) in enumerate(POPS):
        ax.bar(xs, sample_fractions[:, i], bottom=bottom, width=.82, color=color, edgecolor="white", linewidth=.6)
        bottom += sample_fractions[:, i]
    ax.set(xlim=(xs[0] - .7, xs[-1] + .7), ylim=(0, 100), yticks=[0, 25, 50, 75, 100])
    ax.yaxis.set_major_formatter(PercentFormatter(100, decimals=0))
    ax.set_xticks(xs)
    ax.set_xticklabels([t for _, t in bars], fontsize=10)
    for i, patient in enumerate(patients):
        ax.text((xs[2 * i] + xs[2 * i + 1]) / 2, -15, patient, ha="center", va="top", fontsize=12, weight="bold",
                color=PATIENT_COLORS[i], transform=ax.transData, clip_on=False)
    polish(ax)
    ax.tick_params(axis="x", length=0, pad=3)

    # B · the cell map, blood and tumor on the same UMAP coordinates.
    heading(656, 31, "B", "CD8 cell map", "Same UMAP coordinates · phenotypes matched by marker profile")
    umap_panels = []
    for j, pick in enumerate(sample):
        ax = axes(705+j*290, 81, 240, 240)
        umap_panels.append(ax)
        ax.scatter(*xy[pick].T, s=7.0, c=colors[pick], alpha=0.73, linewidths=0)
        ax.set(xlim=(xy[shown, 0].min() - .5, xy[shown, 0].max() + .5),
               ylim=(xy[shown, 1].min() - .5, xy[shown, 1].max() + .5),
               xlabel="UMAP 1", ylabel="UMAP 2" if j == 0 else "")
        ax.set_aspect("equal", adjustable="box")
        ax.xaxis.set_major_locator(MaxNLocator(4, integer=True))
        ax.yaxis.set_major_locator(MaxNLocator(4, integer=True))
        polish(ax)
        caption(825+j*290, 75, TISSUE[j], 16, TISSUE_COLORS[j], ha="center", weight="bold")

    def legend(x0, y0, column):
        for i, (name, _, color) in enumerate(POPS):
            x, y = x0 + i % 3 * column, y0 + i // 3 * 16
            caption(x, y, "●", 13, color)
            caption(x + 15, y, name, 12, MUTED)

    legend(675, 357, 200)
    caption(24, 395, "500 CD8 cells per FCS shown in the UMAPs of A and B", 12, MUTED)

    heading(24, 436, "C", "CD8 marker profiles", "Median signal by phenotype · all CD8 cells")
    medians = np.stack([np.median(data[mask][:, measured], axis=0) for mask in groups])
    ax = axes(160, 477, 402, 200)
    heat = ax.imshow(medians, cmap="viridis", aspect="auto", interpolation="nearest")
    heat_labels = []
    for i, row in enumerate(medians):
        for j, value in enumerate(row):
            label = ax.text(j, i, f"{value:.1f}", ha="center", va="center", fontsize=12,
                            color="white" if heat.norm(value) < .5 else "#0f172a")
            heat_labels.append((value, label))
    ax.set_xticks(range(len(MARKERS)))
    ax.set_xticklabels(MARKERS, rotation=35, ha="right", fontsize=12)
    ax.set_yticks(range(len(POPS)))
    ax.set_yticklabels([pop[0] for pop in POPS], fontsize=12)
    ax.tick_params(length=0, pad=7)
    for edge in ax.spines.values():
        edge.set_visible(False)
    colorbar = fig.colorbar(heat, cax=axes(577, 477, 12, 200))

    heading(656, 436, "D", "CD8 composition by tissue", "Percentage of CD8 cells pooled within each tissue")
    ax = axes(748, 472, 515, 169)
    left = np.zeros(2)
    y = [1, 0]
    for i, (_, _, color) in enumerate(POPS):
        ax.barh(y, fractions[:, i], left=left, height=.54, color=color, edgecolor="white", linewidth=.9)
        for j, fraction in enumerate(fractions[:, i]):
            if fraction >= 5:
                ax.text(left[j] + fraction / 2, y[j], f"{fraction:.0f}%", ha="center", va="center",
                        fontsize=13, weight="bold", color="#0f172a" if i in (0, 1, 2) else "white")
        left += fractions[:, i]
    ax.set(xlim=(0, 100), ylim=(-.48, 1.48), xticks=[0, 25, 50, 75, 100], yticks=y)
    ax.set_yticklabels(TISSUE)
    ax.xaxis.set_major_formatter(PercentFormatter(100, decimals=0))
    polish(ax)
    ax.spines["left"].set_visible(False)
    ax.tick_params(axis="y", length=0, pad=13, labelsize=16)
    for label, color in zip(ax.get_yticklabels(), TISSUE_COLORS):
        label.set_color(color)
        label.set_fontweight("bold")
    legend(675, 681, 200)
    caption(24, 737, "ccRCC paired blood and tumor study · 68,936 CD8 T cells · saved FlowCV analysis", 13, MUTED)

    def write_figure(path):
        fig.savefig(path, format="svg", metadata={"Title": "CD8 T cells in paired blood and tumor",
                    "Description": "Saved FlowCV analysis " + RUN, "Date": None})
        svg = path.read_text()
        svg = re.sub(r'width="(?:1300|1300\.0)pt" height="(?:748|748\.0)pt"', 'width="1300" height="748"', svg, count=1)
        svg = re.sub(r'<!DOCTYPE svg[^>]*>\s*', '', svg, count=1)
        # Keep provenance in an SVG element compatible with Figure Studio's vector export.
        svg = re.sub(r'<metadata>[\s\S]*?</metadata>',
                     f'<desc>Saved FlowCV analysis {RUN}. Paired CD8 study with 6 patients and 12 files.</desc>',
                     svg, count=1)
        path.write_text(explicit_scatter_points(svg))

    write_figure(output)
    if assistant_data is not None:
        for panel in umap_panels:
            panel.tick_params(axis="both", labelbottom=False, labelleft=False, length=0)
        write_figure(output.with_name("cd8-linked-figure-ai-1.svg"))
        heat.set_cmap("magma")
        for value, label in heat_labels:
            r, g, b, _ = heat.cmap(heat.norm(value))
            label.set_color("#0f172a" if .2126*r + .7152*g + .0722*b > .52 else "white")
        write_figure(output.with_name("cd8-linked-figure-ai-2.svg"))
        colorbar.set_ticks(heat.get_clim(), labels=["Min", "Max"])
        write_figure(output.with_name("cd8-linked-figure-ai-final.svg"))

        # The 21 marker pairs use the same individual CD8 cells as the first figure page.
        display = {
            "markers": MARKERS, "n": len(values),
            "lo": lows.tolist(), "hi": highs.tolist(), "ticks": ticks,
            "displayCofactor": DISPLAY_COFACTOR,
            "v": base64.b64encode(values.tobytes()).decode("ascii"),
        }
        assistant_data.write_text("// Generated by tools/export_cd8_figure.py. Values are little-endian Float32.\n"
                                  "window.DECK_FIGURE_CD8 = " + json.dumps(display, separators=(",", ":"), ensure_ascii=False) + ";\n")
    plt.close(fig)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("flowcv", type=Path)
    parser.add_argument("--output", type=Path, default=Path("assets/img/cd8-linked-figure.svg"))
    parser.add_argument("--assistant-data", type=Path, help="Write the scripted demo's marker data and three SVG edit states.")
    args = parser.parse_args()
    render(args.flowcv, args.output, args.assistant_data)
