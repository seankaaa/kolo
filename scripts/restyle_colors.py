"""One-shot class swap for the Kolo palette. Only className tokens change."""
import re, sys, pathlib
RULES = [
 # specific combos first
 (r"bg-orange-600 text-white", "bg-ink text-white"),            # chat bubbles (mine) — fixed below for buttons
 (r"border-orange-600 bg-orange-600", "border-ink bg-ink"),       # selected chips
 (r"border-orange-500 bg-orange-50", "border-ink bg-sand"),
 (r"hover:border-orange-500 hover:bg-orange-50", "hover:border-ink hover:bg-sand"),
 (r"text-orange-100", "text-white/70"), (r"border-orange-400", "border-white/30"),
 # buttons / fills
 (r"hover:bg-orange-700", "hover:bg-pine-dark"), (r"bg-orange-(500|600|700)", "bg-pine"),
 (r"hover:bg-orange-(50|100)", "hover:bg-sand"), (r"bg-orange-(50|100|200)(/\d+)?", "bg-sand"),
 (r"border-t-orange-600", "border-t-pine"), (r"border-orange-200", "border-line-strong"),
 (r"(hover:|focus:)?border-orange-(300|500|600)", lambda m: (m.group(1) or "") + "border-ink"),
 (r"outline-orange-(500|700)", "outline-ink"), (r"ring-orange-\d+", "ring-ink"), (r"accent-orange-600", "accent-pine"),
 (r"text-orange-(600|700|800|900)", "text-pine"),
 # amber -> warn
 (r"bg-amber-(50|100|200)", "bg-warn-bg"), (r"bg-amber-(600|700)", "bg-pine"), (r"hover:bg-amber-700", "hover:bg-pine-dark"),
 (r"text-amber-(700|800|900)", "text-warn-ink"), (r"decoration-amber-700", "decoration-warn-ink"),
 # emerald (verified / success) -> pine
 (r"bg-emerald-(600|700)", "bg-pine"), (r"hover:bg-emerald-700", "hover:bg-pine-dark"),
 (r"bg-emerald-(50|100)", "bg-pine-soft"), (r"text-emerald-(700|800|900)", "text-pine"),
 (r"border-emerald-200", "border-pine-soft"),
 # rose (support) -> beauty palette
 (r"bg-rose-(600|700)", "bg-pine"), (r"hover:bg-rose-700", "hover:bg-pine-dark"), (r"hover:bg-rose-(50|100)", "hover:bg-beauty-tint"),
 (r"bg-rose-(50|100)(/\d+)?", "bg-beauty-tint"), (r"bg-rose-500", "bg-beauty"), (r"text-rose-800", "text-beauty-ink"),
 (r"(hover:)?border-rose-(100|200|300|400|600)", lambda m: (m.group(1) or "") + "border-beauty"),
 # stone grays -> ink scale
 (r"hover:bg-stone-700", "hover:bg-ink-2"), (r"bg-stone-900", "bg-ink"), (r"bg-stone-700", "bg-ink-2"),
 (r"hover:bg-stone-(50|100)", "hover:bg-sand"), (r"bg-stone-50(/\d+)?", "bg-paper"), (r"bg-stone-100", "bg-sand"), (r"bg-stone-200", "bg-line-strong"),
 (r"text-stone-900", "text-ink"), (r"text-stone-(700|800)", "text-ink-2"), (r"hover:text-stone-800", "hover:text-ink"),
 (r"text-stone-(500|600)", "text-muted"), (r"text-stone-(300|400)", "text-faint"),
 (r"(hover:)?border-stone-(200|300)", lambda m: (m.group(1) or "") + "border-line-strong"), (r"border-stone-100", "border-line"),
 (r"divide-stone-(100|200)", "divide-line"),
]
for f in sys.argv[1:]:
    p = pathlib.Path(f); s = p.read_text(); o = s
    for pat, rep in RULES: s = re.sub(pat, rep, s)
    if s != o: p.write_text(s); print("restyled", f)
