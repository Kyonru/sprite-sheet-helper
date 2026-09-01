# Design System — sprite-sheet-helper

Status: **implemented.** Steps 1–11 of §10.2 are done; §11 lists what is still open.
Last updated: 2026-08-29.

This document exists so that any agent or contributor can continue the design
work without re-deriving the reasoning or re-running the exploration. Read it
before changing anything visual.

---

## 0. How to use this document

| If you are… | Read |
|---|---|
| Implementing the redesign | §1, §3–§8, then §10 |
| Adding a new panel or control | §1, §5, §6 |
| Tempted to propose a new visual direction | §2 — it was probably already tried and rejected |
| Wondering why something looks the way it does | §9 |
| Looking for what is still undecided | §11 |

The system is live in the app. Tokens are in `src/index.css`; the primitives
are `panel-tile.tsx`, `panel-header.tsx`, `panel-empty.tsx`, `panel-tabs.tsx`,
`ui/scrub-field.tsx` and `export-workbench/pipeline.tsx`.

**The design lab is kept**, at `src/__design_lab/` — dev-only, stripped from
production builds. Open `?design_lab=true` to compare the implementation against
variant N and the directions that lost. Use it as the reference when adding a
surface: if the app and N disagree on layout, N is the intent.

**Never hardcode a colour.** Everything routes through the tokens in §3.

---

## 1. The governing constraint

**The chrome sits directly beside the artwork the user is judging.**

Someone is looking at a 64×64 sprite deciding whether its hue, contrast and
edges are right. Any chrome that puts saturated colour, heavy borders, texture
or a coloured cast next to that surface corrupts the judgement — they compensate
for it, export, and the sprite is wrong in-engine.

This is why Photoshop, Aseprite, Blender and Figma all converged on neutral
grey. It is not timidity; it is a measurement requirement.

Every rule below derives from this. **When a rule conflicts with an aesthetic
preference, this constraint wins.**

Practical tests before shipping any surface:
1. Does it introduce chroma above ~0.02 on any large area adjacent to the viewport or a sprite preview?
2. Does it tint a checkerboard, a preview background, or an atlas page?
3. Would a user's read of the sprite change if this panel were hidden?

If yes to any, it is wrong regardless of how good it looks.

---

## 2. Provenance — what was explored and rejected

Thirteen directions were built as working mocks and compared side by side
against identical fixture data, with the same sprite in every viewport as a
control. **Do not re-propose the rejected ones without new information.**

### Rejected, with reasons

| Direction | Why not |
|---|---|
| **Neo-brutalism** | Saturated flat fields shift perceived sprite hue through simultaneous contrast. 3px borders in a 320px rail are unaffordable, and it needs 16px+ type to land — shrunk to 11px it is just noise. |
| **Glassmorphism** | Translucent chrome over an orbiting 3D viewport means panel colour changes as the user rotates the scene. Disqualifying. |
| **Neumorphism** | Low contrast is disqualifying for a precision tool. |
| **Material 3 (as-shipped)** | Its *surfaces* were adopted (§9.1). Its elevation shadows and violet-seeded neutral were not — soft edges and a colour cast next to artwork. |
| **Retro system chrome** (System 7 / Win95) | Bevels are pure noise at 11px. Nostalgia, not an argument. |
| **Contact sheet** (film metaphor) | Charming, but the metaphor cannot survive contact with the inspector without becoming costume. |
| **Blueprint** | Strong thesis (this app measures things), but a blue ground measurably shifts the sprite read. The *dimension-line* idea is worth revisiting for the atlas map only. |
| **Terminal-native** | Real identity payoff and grounded in the shipped CLI, but monospace prose labels hurt scanning. The mono-numerics half was adopted. |
| **Swiss grid** | Useful as a restraint pole. Pure whitespace grouping reads as unstructured at rail width. |
| **Darkroom** | Hiding affordances until hover costs more than the focus buys in an app with this many controls. |

### Adopted

The chosen direction, **N**, is a synthesis of six:

| Source | Contributed |
|---|---|
| Material 3 | Tonal surface roles |
| Bento box | Tile structure; sunken centred monospace inputs |
| Pipeline | Export rail organised as pipeline stages with per-step state |
| Density-first DCC | Rail density; drag-to-scrub numeric fields |
| Pixel-native | Monospace numerics; checkerboard as signature texture; no soft shadows |
| Fluent 2 | Hairline strokes; one accent carrying focus and selection; reveal on hover |

---

## 3. Tokens

### 3.1 One hue

Surfaces and accent share **hue 248** — the steel already used by `--ring`.
Applied in both themes.

**Naming, important:** the brand accent is `--brand`, *not* `--accent`. shadcn
reserves `--accent` / `--accent-foreground` for the neutral hover pair used by
menus and dropdowns; redefining it would turn every dropdown hover blue. The
two are separate on purpose:

| Token | Meaning |
|---|---|
| `--brand` | Selection, focus, active state, primary action. The one accent. |
| `--accent` | shadcn's neutral hover fill. Stays neutral. Do not repurpose. |

### 3.2 Dark surface ladder (authoritative)

Depth is carried by **tone only**. There are no drop shadows anywhere in this
system (§9.1).

| Role | Hex (from mock) | OKLCH (for `index.css`) | Used for |
|---|---|---|---|
| `--surface-sunken` | `#131415` | `oklch(0.191 0.003 248)` | Viewport, input interiors, atlas page |
| `--background` | `#171819` | `oklch(0.208 0.003 248)` | App shell behind tiles |
| `--card` | `#1e2022` | `oklch(0.242 0.005 248)` | Default tile |
| `--surface-high` | `#26282b` | `oklch(0.276 0.006 248)` | Raised tile, menus, footer tile |
| `--surface-highest` | `#2f3235` | `oklch(0.315 0.007 248)` | Active tab, pressed control |

Rule: **the viewport is always the darkest surface on screen.** Chrome sits
above it. This is the DCC convention and it keeps the artwork the subject.

### 3.3 Content

| Role | Hex | OKLCH | Used for |
|---|---|---|---|
| `--foreground` | `#e6e8ea` | `oklch(0.930 0.004 248)` | Primary text, values |
| `--muted-foreground` | `#9ba1a7` | `oklch(0.706 0.011 248)` | Labels, unselected rows |
| `--faint-foreground` | `#6b7177` | `oklch(0.546 0.012 248)` | Units, counts, micro-labels, connectors |

### 3.4 Accent and semantics

One accent. It carries selection, focus, active state and the primary action —
nothing else.

| Role | Hex | OKLCH |
|---|---|---|
| `--accent` | `#6fa4dc` | `oklch(0.704 0.100 251)` |
| `--accent-foreground` | `#0b1620` | `oklch(0.195 0.026 247)` |
| `--ok` | `#6fbf8f` | `oklch(0.740 0.106 156)` |
| `--warn` | `#e0b062` | `oklch(0.785 0.111 78)` |
| `--destructive` | `#e0605f` | `oklch(0.649 0.161 23)` |

### 3.5 Alpha layers

Never hardcode; these are the only overlays in the system.

| Token | Value | Used for |
|---|---|---|
| `--stroke` | `rgb(255 255 255 / 0.065)` | Every tile and control border |
| `--stroke-strong` | `rgb(255 255 255 / 0.13)` | Hover border |
| `--accent-soft` | `rgb(111 164 220 / 0.14)` | Selected row/chip background |
| `--accent-line` | `rgb(111 164 220 / 0.34)` | Selected control border |
| `--warn-soft` | `rgb(224 176 98 / 0.10)` | Warning surface background |
| `--warn-line` | `rgb(224 176 98 / 0.26)` | Warning surface border |
| `--row-hover` | `rgb(255 255 255 / 0.05)` | Row hover |

### 3.6 Light theme

Derived and shipped. The ladder keeps the same ordering in both themes —
`sunken < background < card < high < highest` — and only the direction of
"further from the ground" flips.

| Role | Light | Dark |
|---|---|---|
| `--surface-sunken` | `oklch(0.902 0.004 248)` | `oklch(0.191 0.003 248)` |
| `--background` | `oklch(0.935 0.003 248)` | `oklch(0.208 0.003 248)` |
| `--card` | `oklch(0.972 0.002 248)` | `oklch(0.242 0.005 248)` |
| `--surface-high` | `oklch(0.99 0.002 248)` | `oklch(0.276 0.006 248)` |
| `--surface-highest` | `oklch(0.999 0.001 248)` | `oklch(0.315 0.007 248)` |
| `--brand` | `oklch(0.52 0.115 248)` | `oklch(0.704 0.1 251)` |
| `--faint-foreground` | `oklch(0.545 0.014 248)` | `oklch(0.62 0.013 248)` |

Strokes flip base too: white-alpha in dark, ink-alpha in light. The 3D viewport
stays dark in both themes — it is the artwork, not chrome.

---

## 4. Type

One family (system sans). Monospace **only** for values, never for labels.

| Use | Size | Weight | Notes |
|---|---|---|---|
| Tile / panel title | 10px | 600 | uppercase, `letter-spacing: 0.7px`, `--muted-foreground` |
| Body, row label | 11px | 400 | |
| Emphasis, stage title, format name | 11px | 600 | |
| Micro-label above a field group | 9px | 400 | `letter-spacing: 0.5px`, `--faint-foreground` |
| Numeric value | 11px | 400 | monospace, `tabular-nums` |
| Unit suffix | 9px | 400 | `--faint-foreground`, inline after value |
| Hint / readout (right-aligned) | 10px | 400 | monospace, `--faint-foreground` |

**Nothing in the chrome exceeds 13px.** If a heading wants to be bigger, the
layout is wrong.

**Casing:** sentence case for labels. Never rely on the data's casing —
`formatFieldLabel()` in `src/components/inspector/index.tsx` already handles
this (`fov` → `FOV`, `castShadow` → `Cast shadow`); reuse it rather than
re-implementing.

---

## 5. Geometry and space

### 5.1 Radii

| Element | Radius |
|---|---|
| Tile | 10px |
| Control (input, button, chip, tab) | 5px |
| Row (hover/selection) | 4px |
| Menu / popover | 10px (tile radius — overlays are tiles, not controls) |
| Dialog | 12px |
| Atlas map, preview frame | 6px |

The current `--radius: 0.625rem` (10px) applied to *controls* is what makes the
app read as a web dashboard. Tiles keep 10px; controls drop to 5px.

### 5.2 Borders and shadows

- Every surface: **1px `--stroke`**. Never thicker.
- **No `box-shadow` anywhere.** Depth is tonal. The only permitted `box-shadow`
  is `inset 0 0 0 1px` used as a hairline separator inside the atlas map.
- Selection is a **2px accent bar** on the leading edge of a row, plus
  `--accent-soft` background. Never a glow ring.

### 5.3 Spacing

| Gap | Value |
|---|---|
| Between tiles (shell gutter) | 8px |
| Tile padding | 8px |
| Tile title → body | 7px |
| Between control groups in a tile | 6–8px |
| Between fields in a group | 4px |
| Between pipeline stages | 14px |
| Stage header → stage content | 8px |

Spacing was explicitly called out in review — when in doubt, err generous.
Never claw back spacing to fit content; give the container more room instead.

### 5.4 Heights

| Element | Height |
|---|---|
| Top bar | 34px |
| Panel header row | 36px (`min-h-9`) |
| Tree / list row | 22px |
| Tab | 22px |
| Chip | 19px |
| Numeric field (axis) | 22px |
| Scrub field | 24px |
| Icon button | 26×24px |
| Primary action button | 30px |

---

## 6. Components

### 6.1 Tile

The unit of structure. Replaces the bordered-card-per-section pattern.

```
background: var(--card)        /* or --surface-high for raised */
border: 1px solid var(--stroke)
border-radius: 10px
padding: 8px
```

Optional header row: uppercase 10px/600 title left, monospace 10px hint right.

### 6.2 PanelHeader — **already implemented**

`src/components/panels/panel-header.tsx`. Fixed `min-h-9`, 15px muted icon,
`text-xs font-semibold` title, right-aligned hint, trailing actions. Already
adopted across both rails, the materials workbench and pose studio. **Reuse it;
do not create a fourth header implementation** (there were three before
consolidation).

### 6.3 PanelEmpty / PanelTabs — **already implemented**

`panel-empty.tsx`, `panel-tabs.tsx`. Same rule: reuse.

### 6.4 ScrubField

The signature control. Bento's shape carrying DCC's scrub affordance.

- 24px tall, `--surface-sunken`, 1px `--stroke`, 5px radius
- Label left (10px, `--muted-foreground`), value right (11px mono)
- **A 2px accent bar along the bottom edge**, width = value's position in range
- `cursor: ew-resize`; drag horizontally to change
- Hover: border → `--stroke-strong`

The fill is on the **bottom edge, not full-height**. A full-height fill (the
Blender idiom) bisects the label mid-word at low values and reads as a rendering
fault. On the edge it also doubles as Fluent's accent underline — one mark
serving two purposes.

### 6.5 AxisField

For X/Y/Z triples where a label would be noise. 22px, sunken, 5px radius,
centred monospace value, same scrub affordance and hover.

### 6.6 Row (tree item, list item, menu item)

- 22px tall, 4px radius
- Unselected: `--muted-foreground`
- Hover: `--row-hover` background
- Selected: `--accent-soft` background + 2px accent bar on the leading edge, text → `--foreground`
- **Type icons are required** in the scene explorer (camera / light / model),
  tinted `--accent` on the selected row, `--faint-foreground` otherwise

### 6.7 Chip (sequence selector)

19px, 5px radius. Selected: `--accent-soft` + transparent border + 600 weight.
Unselected: transparent + `--stroke` border. Trailing count in 9px mono
`--faint-foreground`.

### 6.8 Pipeline stage

The export rail's organising structure. **A status map, not a wizard** — every
stage stays reachable, because the workflow is loopy (people re-record after
seeing the atlas).

Order is **Scene → Capture → Effects → Pack → Export**, and each stage depends
only on those above it.

- **Capture** owns interval, frame size and safe margin — editing them
  invalidates everything downstream.
- **Pack** owns layout, padding, extrude, sprite margin, max size, scale and
  multi-page. They sit directly under the atlas map, so changing one re-packs
  the page in view. They used to live in the export dialog, which meant opening
  a modal to change how packing works and closing it to see the result.

Structure — a **two-column grid, always**:

```
14px marker column │ 1fr content column
```

- Marker: 14px circle, 1px border in the state colour
- Connector: 1px `--stroke`, `flex: 1` below the marker

| State | Mark | Colour |
|---|---|---|
| done | Check glyph, 9px | `--ok` |
| active | **CSS disc, 6px** | `--brand` (+ `--brand-soft` fill) |
| warn / blocked | Alert glyph, 9px | `--warn` / `--destructive` |
| todo | **nothing — the ring is the empty state** | `--faint-foreground` |

Two of these are deliberately *not* icons. Lucide's `Dot` centres its circle at
`(12.1, 12.1)` in a 24-unit box rather than `(12, 12)`, and needs
`stroke-width: 8` to register at 14px — which renders a blob that is both
off-centre and wider than the ring containing it. A CSS disc is centred exactly
by the grid and costs nothing. `todo` draws no glyph at all: the ring already
*is* the empty state, and an inner circle only doubled it.

### 6.8b Atlas map

The map draws **the real captured frames**, not solid blocks. A grid of blocks
tells you the packing worked; the frames tell you whether it packed the right
thing — a wrong sequence or an empty capture is visible here and nowhere else
before export. Frames sit on the `.checkerboard` utility, so transparency reads
as transparency.

**Content must never span into the marker column.** Doing so breaks the
connector, so the one stage with a problem is also the one that looks detached
from the run — exactly backwards. This was a real bug; do not reintroduce it to
reclaim ~20px of width.

### 6.9 Warning surface

Never loose coloured prose. Always a surface:

```
background: var(--warn-soft)
border: 1px solid var(--warn-line)
border-radius: 6px
padding: 7px 8px
```

Alert glyph + 10px/600 `--warn` headline + 10px `--muted-foreground` detail +
inline fix action.

### 6.10 Buttons

| Kind | Spec |
|---|---|
| Primary | `--accent` fill, `--accent-foreground` text, 5–6px radius, 600–700 weight. Hover `filter: brightness(1.07)`. |
| Secondary / ghost | transparent, 1px `--stroke`, `--muted-foreground`. Hover: `--surface-highest` bg, `--foreground` text. |
| Icon | 26×24px, 5px radius, transparent → `--surface-highest` on hover. |

One primary action per surface.

### 6.10b Writes tree

What an export is about to write, rendered as a tree rather than a flat list of
full paths. Exporters emit real structure — `assets/spritesheet.png` beside
`src/main.rs` and a bare `Cargo.toml.snippet` — and a flat list makes the reader
parse that structure one row at a time. Files at the archive root sit flush;
nested files hang off a guide line under a folder row.

**Never key these rows by filename.** Two sequences may share a label, so two
rows can carry the same path; a filename key collides in reconciliation and
stale rows survive a format switch. See §12.6.

### 6.11 Format mark (export dialog)

**Brand logos and our own icons get different substrates, deliberately.**

- Our icons are ours to theme: dark tile (`--surface-high`), `--accent` when selected.
- A third-party logo is **not ours to recolour**. Several ship with black fills
  that vanish on dark, and only Unity has a dark variant. Every brand logo gets
  a **light chip** (`#e9eaec`, 24px, 6px radius) — the background it was drawn
  for.

Logos live in `public/`. See §12 for a bug in the current mapping.

### 6.12 Workflow dialog

**The shot on the left, the plan on the right.** A preview large enough to judge
framing, and a grid of every animation against every direction. Both answer the
question the dialog exists for — *what am I about to make?* — so neither is
tucked into a corner. The pieces live in `src/components/workflows/`.

**Draw the data's real shape.** A workflow captures each clip from each angle:
that is a multiplication, and the grid draws it as one. Rows are animations,
columns are directions, a filled cell is a sequence that will exist. This
replaced a nested list of checkboxes where the sequence count was a number you
had to take on faith, turning off one angle across the board meant unticking a
row per animation, and the two things you can select — an animation, an angle —
had no relationship on screen. As axes, they do.

Rules that keep it legible:

- **Cells toggle, headers select.** A row header picks the animation the capture
  settings apply to; a column header picks the direction the camera frames. One
  selection model, expressed spatially, instead of a mode line reading "editing
  all directions" in the opposite corner from the thing it described.
- **Progress is the same picture as the plan.** During a run the fills sweep
  down the grid — captured cells go `--ok`, the current one pulses `--brand`.
  No second list of steps with spinners beside it.
- **Sections, not nested cards.** The right column is three sections divided by
  hairlines. Cards inside a dialog read as three dialogs.
- **Controls from the ladder**: `ScrubField` for every number, 17px segmented
  controls for either/or choices, text actions for verbs. No `h-8` inputs, no
  slider paired with a number field, no button where a link will do.
- **Every number in one place.** Frames per animation sit in the grid's last
  column; the run's total sits above the button. The button says what it does.
- **A pair of opposites is one control.** Pin/Unpin is one text action that
  reports its state, not a Save button beside a Clear button.

**The preview is shaped like the sprite.** Its box takes the export's aspect
ratio, so what fills the frame here fills the frame there. In a fixed letterbox
the model sat in a field of empty grid — a wider viewport at the same camera
distance just shows more world, which made the largest element in the dialog
the one carrying the least information. Fitting it needs measurement, not
`aspect-ratio`: that property drops the ratio the moment both a width cap and a
height cap are definite, which rendered a 3:1 sprite 1920px wide inside a 760px
column and clipped it. `useFittedBox` measures the container and returns the
largest box of that ratio which fits.

**Full-screen is not permission to stretch.** The dialog fills the viewport, but
the stage inside it is a centred column of a fixed measure. Letting the camera
controls span the full width gave three number fields 450px each, with every
value marooned from its label. Space around a composition is framing; space
inside a control is a defect.

**Minimal needs contrast, not uniformity.** An early pass put nearly everything
at 10–11px muted, which removed noise and hierarchy together — no section led,
and values read at the weight of their own labels. Labels stay 9–10px uppercase
`--faint-foreground`; values step up to 11–12px `--foreground`; the number that
answers "what will this cost me" sits at 14px semibold beside the button that
spends it.

**A hint line is a bug report about an affordance.** Toggling a whole row began
as a double-click on its name, which worked and then needed a sentence under the
grid explaining that it did. The sentence was the tell. Rows, columns and the
whole grid now carry a *master square* — the same shape as the cells it
commands, one step quieter, showing all / some / none — so the header is part of
the grid rather than a control bolted to it, and nothing needs explaining.

**One family of controls.** A select sitting beside a `ScrubField` must be the
same object: 24px, `--surface-sunken`, hairline, value right-aligned, with a
chevron as the only difference. A stock `<select>` next to a scrub pill reads as
two design systems meeting. And drop the inner label when the row already names
the control — `Looping · playback only ⟨Loop once ▾⟩`, not `⟨Mode Loop once ▾⟩`.

**Let the UI offer the fix it just exposed.** Framing the preview like the sprite
made it plain that a preset's default distance can leave the character a speck in
the frame. Auto-fit already solved that — but only from the CLI's `--fit auto`.
It is in the dialog now, next to the picture that makes the case for it, and the
distance field reads `Distance · solved` while it is on.

### 6.13 Pose Studio

**Name the tool after the thing the user wants, not the technique.** The palette
offered Select / FK Rotate / FK Move / IK / Global Rotate / Global Move — six
buttons that assume the reader already animates for a living. It is really two
questions: *what am I moving* (a bone, a limb by its hand, the whole figure) and
*what does the gizmo do* (rotate, move). Asked separately, the second question
disappears for the targets it does not apply to, and "IK" becomes **Reach** —
drag a hand or foot, the limb follows. `composePoseTool` puts the two answers
back together, so everything downstream still reads one `PoseStudioTool`.

**Empty is not an error.** The studio opened reporting `Poor 0%` and a red
banner, because no pose had been detected yet — a verdict on work nobody had
done. Nothing detected is a *prompt*, in the neutral tone, saying what to do
next; warnings describe a pose that exists. The same split applies to the
detector: "Loading" is `Clock`-marked and quiet, not an alert.

**One action, one place.** Save sat in the header *and* at the bottom of an
inspector tab, each beside its own copy of the clip-name field — two ways to
name one clip and two buttons to write it. The name and the button live together
in the header; the tab, now **Review**, is a pre-flight readout of what is about
to be written and states the name it will use.

**A destructive control should not be the brightest thing on screen.** The
timeline's `Frame` button was a filled red primary sitting next to two outlined
trims. It is a ghost button now, taking `--destructive` only on hover, and every
label says what it removes: *Trim start*, *Trim end*, *Delete frame*, *Clear
all*.

**Semantic tokens, or the theme is a coin flip.** `amber-500/10` on
`text-amber-800`, `bg-red-600`, `text-emerald-500` — literals that resolve in one
theme and fail in the other. Warnings are `--warn`, good states `--ok`, selection
`--brand`, and the recording chip is `--destructive` with a pulsing dot.

---

## 7. Layout

**Tiles on a ground, not panes sharing borders.** The shell paints
`--background`, pads 8px, and lays six tiles on it with 8px gutters. Every tile
carries its own hairline and sits a step up the ladder. Resize handles are the
gutters — transparent, revealing a grip only on hover.

```
┌─ top bar ────────────────────────────────────────────────────┐
├──────────────┬─────────────────────────────┬─────────────────┤
│ Scene tile   │  Scene view tile            │ Export pipeline │
│              │  └ Preview PiP (draggable)  │ tile            │
├──────────────┤                             │                 │
│ Inspector    ├─────────────────────────────┤                 │
│ tile         │  Sequence tile              ├─────────────────┤
│              │  (hidden until recorded)    │ Action tile     │
└──────────────┴─────────────────────────────┴─────────────────┘
```

Columns: `20% | 1fr | 20%`, all resizable.

### The sequence belongs to the centre column

It is a **viewing** surface — you watch it, the way you watch the scene view
and the camera preview. Putting it in the export rail made the rail scroll past
the thing you were trying to look at. The rail beside it is for deciding.

It collapses to nothing until something has been recorded, so an empty project
gives the whole column to the viewport.

### The three views — keep these distinct

This was got wrong once. They are three different things:

1. **Scene view** — where objects are *moved*. Keeps the grid and gizmos. The
   editing surface.
2. **Preview (camera)** — what the render camera sees, i.e. exactly what will be
   captured. A draggable panel nested in the scene view, clamped to it. The
   camera panel *is* the capture bounds — do not also draw bounds in the scene
   view.
3. **Sequence** — playback of already-recorded frames. Height is the scarce
   dimension under the viewport, so the panel is one header row and one
   transport row:

   ```
   SEQUENCE  [idle 6][walk 5][attack 3]            [⟲ Loop]   4 / 6
   ‹  [frame ⁴]  ›    ▷ ▬▬▬▬▬▬
                      [✎ Edit frame 4] [◈ Edit sequence]
   ```

   - Sequences are **chips, not a stacked list** — picking one to watch is a
     single click, and a list of expandable rows spends height on editing that
     most of the time nobody is doing.
   - The steppers flank **the frame**, not the strip: you are moving through
     frames, so it reads as a carousel rather than a scrolling list.
   - The scrubber is **the frames themselves**, not an abstract bar. These are
     exactly what gets written into the spritesheet, in the order it will write
     them, so the strip doubles as the export's contents and as the timeline you
     scrub. Click any frame to jump to it.
   - While playing, the active frame is kept **centred** in the strip
     (`scrollIntoView({ inline: "center" })`). `nearest` parks it at whichever
     edge it entered from, which reads as the playhead drifting. Frames at
     either end sit off-centre by design — centring them would scroll past the
     content edge.
   - The frame tile zooms on wheel, pans on drag and resets on double-click.
     The pointer is the control, so the tile stays a frame instead of becoming
     a toolbar.
   - **Two edit scopes**, so the target is never ambiguous: `Edit frame N`
     names the frame beside it and opens the frame manager; `Edit sequence`
     reveals rename, frame size and delete for the chip selected above.

**Do not put scene-view information (model name, frame counter) in the preview.**
It reads as clutter because it belongs to a different surface.

## 8. Interaction

| Behaviour | Spec |
|---|---|
| Transition | 120ms `ease-out` for colour/background/border; 150ms for layout |
| Row hover | background → `--row-hover` |
| Control hover | border → `--stroke-strong` |
| Primary button hover | `filter: brightness(1.07)` |
| Numeric fields | horizontal drag to scrub, `cursor: ew-resize` |
| Camera PiP | draggable by its header (grip cue, `grab`/`grabbing`), **clamped inside its parent** |
| Focus | visible ring using `--accent`; never remove outlines |

Respect `prefers-reduced-motion`.

---

## 9. Decision log

These were argued and settled. Do not re-litigate without new evidence.

### 9.1 Tonal surfaces, no shadows
M3 carries elevation as tone *and* shadow. We keep the ladder and drop the
shadows. Rationale: the depth was wanted; soft edges beside artwork were not.
This is also what resolved the objection to Material generally.

### 9.2 Tiles with dense interiors
Bento spends width on gutters; DCC spends it on content. We keep the tiles —
they carry the structure — and run DCC density *inside* them. Gutters stay,
interior padding does not.

### 9.3 Steel accent, not violet
The ask was Material *surfaces*, not Material violet. The ladder is seeded from
hue 248, already present as `--ring`. A violet-tinted neutral beside a sprite is
the exact failure mode §1 prohibits.

### 9.4 One warning, progressive detail
Warning copy is **shared strings**, not per-surface prose. The headline is
identical everywhere; the rail spends its remaining room on the *fix*, the dialog
on the *arithmetic*. A surface that paraphrases a warning makes the reader wonder
whether it is a different one. Model: `{ title, short, detail, fix }`.

### 9.5 Connector continuity beats width
See §6.8.

### 9.6 The export dialog answers one question
*What exactly is about to be written, and where.* Format left (the only real
choice), consequences right.

That includes the two things that decide what gets written — which sheet each
sequence packs into, and how the packing runs. Both live here as well as in the
rail, from the same components, because the dialog shows the map they change:
the rule is not "no controls in the dialog", it is **no control without its
consequence in view**. A setting you have to close the dialog to evaluate does
not belong in it.

**The atlas readout beside the map.** The map's width is its aspect ratio times
its height cap, so it can never fill a `1fr` column — given one, it hugs the
left edge and leaves the numbers stranded at the far right. The map takes
exactly its own width; the readout takes the rest, capped (`max-w-md`) so a
10:1 atlas that fills the row and pushes the readout onto its own line does not
fling labels to opposite edges of the dialog. Inside it, every fact is a
micro-label with its value directly underneath — never a label column and a
value column, whose gap changes width with the atlas. The coverage bar is the
one element that stretches, because stretching is what a bar is for.

### 9.7 A control says which side of the export it is on

Some settings shape the exported frames; some only shape what you see while
setting them up. When both kinds sit in one group, the ones that do not export
carry it in their label — the workflow dialog's **Looping · playback** sits
between two fields that do change the capture, and without the qualifier it
reads as a third one. Prefer stating it over moving the control somewhere it
does not belong: looping is edited next to the trim it interacts with.

The same goes for units. The workflow dialog counts frames twice — the clip's
own frames at its native rate, and the frames a capture takes at the capture
rate — so each panel names its rate in its hint (`30 fps clip`, `10 fps`)
rather than leaving two different numbers labelled "frames" side by side.

---

## 10. Implementation plan

### 10.0 First: remove the lab

The design lab is temporary and must not ship.

- Delete `src/__design_lab/`
- Delete `.claude-design/`
- Revert the `?design_lab=true` branch in `src/main.tsx` (only file touched)

Extract anything worth keeping first — the mocks are the reference for §6.

### 10.1 Landed earlier (commit `5697e82`)

- `PanelHeader`, `PanelEmpty`, `PanelTabs` primitives + adoption
- Consolidation of three duplicate `PanelHeader` implementations
- `formatFieldLabel()` in the inspector
- Export rail restructured into disclosure sections
- "Graphite Instrument" palette at hue 265

### 10.2 Ordered work

1. **Tokens** — `src/index.css`. Move the ladder to hue 248, add the surface,
   alpha and semantic tokens from §3. Drop `--radius` for controls to 5px.
   *Blocked on §11.1 for light mode.*
2. **Kill shadows** — remove `shadow-sm` from `src/components/ui/tabs.tsx` and
   any other `shadow-*` in chrome.
3. **Tile primitive** — new `src/components/panels/panel-tile.tsx` per §6.1.
4. **ScrubField / AxisField** — new controls per §6.4–6.5. Highest-value change
   for daily use; wire into the inspector's `vector3` and `number` field kinds.
5. **Scene explorer** — row spec §6.6. Icons are already present.
6. **Export rail → pipeline** — `src/components/export-workbench.tsx`. The
   largest change. Replace `PanelSection` disclosures with pipeline stages
   (§6.8). Requires a stage-state model derived from existing validation.
7. **Warning surfaces** — §6.9, and refactor `export-validation` messages to the
   `{ title, short, detail, fix }` shape (§9.4).
8. **Sequence transport** — §7, view 3. Loop, stepping, dual edit scopes.
9. **Camera PiP** — extract from the floating "Preview Canvas"; make it
   draggable and clamped.
10. **Export dialog** — §9.6, §6.11.
11. **Workflow dialog** — §6.12. The last surface still speaking shadcn
    defaults: 15px labels, `h-8` inputs, native selects, sliders paired with
    number fields, and the sequence list buried under the settings.
12. **Pose Studio** — the *actual* last surface, and the one furthest from the
    ladder: `h-7`/`h-8` controls, `text-xs` throughout, hard-coded `amber-500`
    and `red-600` that only resolve in one theme, and six tools named after
    rigging technique.

### 10.2b What each step actually produced

| # | Outcome |
|---|---|
| 1 | Both themes reseeded to hue 248; surface/alpha/semantic tokens added; radius scale mapped to roles (sm 4 / md 5 / lg 10 / xl 12), which lands the geometry without editing each shadcn primitive. |
| 2 | Elevation shadows stripped from every `ui/` primitive. Overlay surfaces keep a stroke and sit a step up the ladder instead. |
| 3 | `panels/panel-tile.tsx`. |
| 4 | `ui/scrub-field.tsx`, wired into the inspector's `number` and `vector3` fields. **The separate slider under bounded number fields is gone** — the field's own fill bar replaces it, so one control reports the value instead of two describing it. |
| 5 | Tree rows to 22px/11px; react-complex-tree vars now read from the token ladder instead of their own hex palette; type icons take the accent on the selected row. |
| 6 | Export rail rebuilt as the pipeline. Sequences moved inside Capture, which is the step that produces them. |
| 7 | `ExportValidationMessage` gained `stage`, `detail` and `fix`. Messages are routed to the stage that owns them; the footer shows only unstaged ones, so nothing is reported twice. |
| 8 | Sequence transport unwrapped from its own collapsible — it sits inside the Capture stage, which already names it. |
| 9 | The Preview Canvas was *already* draggable and clamped; what it needed was the surface language. See §12.2–12.4 for three real defects found there. |
| 10 | Export dialog: brand-token selection, format marks per §6.11, and `ValidationNote` with full detail. |
| 11 | Workflow dialog rebuilt per §6.12 and split into `components/workflows/`: sequences take the left column, the camera the right, and the 2,258-line panel came down to 1,276. |
| 12 | Pose Studio: chips to 19px, tabs and bone buttons to 22px, readouts to the 9px-label/11px-mono pairing, and every literal colour replaced by `--ok`/`--warn`/`--brand`. The tool palette asks two questions (what you are moving, what the gizmo does) instead of listing six named modes; the clip name and Save live once, in the header. `camera-animation-capture/` — the old wizard's name — is gone: its live components moved into `pose-studio/` and the alias re-export shim with them. |

### 10.3 Verification

Screenshot both themes with Puppeteer (already in `devDependencies`) before and after
each step. The lab used a headless script at 2× DPR; that approach works — the
3D viewport needs `--use-gl=swiftshader --enable-unsafe-swiftshader` and
`waitUntil: "domcontentloaded"` plus a fixed delay, since `networkidle2` never
settles.

Run `npm run typecheck`, `npm run lint`, `npm test` on every step.

---

## 11. Open questions

### 11.1 Light theme — blocking
N is dark-only. Someone must derive the light ladder. Guidance:
- Keep hue 248 and the same accent.
- Invert the ladder, but **the viewport must remain the darkest element** — do
  not make it light just because the chrome is.
- Inputs stay *below* their surroundings (inset), as the current light palette
  already does.

### 11.2 Density at real volume — unverified
N was only ever rendered at 540–588px against tidy fixtures: 5 scene objects,
3 sequences, short filenames. It has **not** been tested against a 40-object
scene, a full effects stack, or long filenames. Do this before committing to
row heights.

### 11.3 Accessibility — the known failure is fixed

`--faint-foreground` was 3.31:1 on `--card`, failing AA. It was retuned to
`oklch(0.62 0.013 248)` in dark (4.50:1) and `oklch(0.545 0.014 248)` in light
(4.56:1). Every content token now clears AA for body text:

| Token | Dark | Light |
|---|---|---|
| `--foreground` | 13.30:1 | 13.44:1 |
| `--muted-foreground` | 6.27:1 | 5.52:1 |
| `--faint-foreground` | 4.50:1 | 4.56:1 |
| `--brand` | 6.24:1 | 5.05:1 |
| `--warn` | 8.22:1 | 5.16:1 |
| `--ok` | 7.42:1 | 4.94:1 |

Still outstanding: hover and selected states have not been measured, and no
screen-reader pass has been done.

### 11.4 Undecided
- Whether the top bar keeps icon-only buttons or gains text labels.
- Whether Effects becomes a pipeline stage with real inline content or stays a summary row.
- Whether the atlas map should adopt Blueprint's dimension lines (§2) — the one idea worth salvaging from a rejected direction.

---

## 12. Bugs found during this work

All fixed unless marked otherwise.

### 12.1 `npm run typecheck` checked nothing — **the important one**

`tsconfig.json` has `"files": []` and only project references. With
`--composite false` and no `--build`, `tsc -p tsconfig.json` compiled **zero
files**, so the script passed unconditionally no matter what was in `src/`.

Found by writing code that referenced two undefined variables and watching
typecheck report success. It also explains an earlier silent breakage during
the design exploration, where a deleted component was caught by the browser
console rather than by the compiler.

Fixed in `package.json`:

```diff
- tsc --noEmit -p tsconfig.json --composite false
+ tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json
```

**If you are continuing this work, trust `npm run typecheck` only from this
commit onward.** Anything merged before it was never type-checked in CI.

### 12.2 Godot logo served HTML instead of an image

`export-workbench.tsx` mapped Godot to `/godot.svg`; `public/` ships
`godot.png`. Doubly invisible: `<img alt="" aria-hidden>` fails silently, *and*
the dev server's SPA fallback answered the request with `index.html` at
**status 200**, so no 404 ever appeared in the network panel. Confirmed by
comparing content types (`image/png` vs `text/html`). Fixed.

### 12.3 Preview canvas composited to mid-grey in light mode

The preview body used `bg-black/20` over a light panel, producing a grey wash
directly behind the sprite — the exact contamination §1 prohibits. It now uses
the `.checkerboard` utility, which states "transparent" and stays neutral in
both themes.

### 12.4 `border-accent-800` was never a colour

The preview canvas asked for a Tailwind shade this theme does not define, so it
rendered no border at all. Replaced with `border-stroke-strong`.

### 12.5 Duplicate output filenames overwrote each other

Two sequences may share a label — two rows both called "Animation" is normal —
but the files they produce may not. `gifExporter` wrote `${row.label}.gif` for
each row, so exporting two identically-named sequences produced **one** file in
the archive, silently, with no error. `dedupeFileNames()` in
`utils/exports/helpers.ts` now suffixes collisions before the extension
(`Animation.gif`, `Animation-2.gif`); the exporter and the dialog preview share
it, so what the dialog promises is what the archive contains. Covered by
`tests/unit/dedupe-file-names.test.ts`.

### 12.6 Stale rows survived a format switch

The export dialog keyed its file rows by filename. Because gif could emit the
same name twice (§12.5), React saw duplicate keys and kept stale rows alive:
switching to GIF and back left `Animation.gif` in the list, accumulating on
every switch. Fixed by the dedupe plus positional keys in `WritesTree`.

Reproduced before fixing — one sequence was not enough to trigger it, which is
why it survived earlier passes.

### 12.7 Frame strip grew instead of scrolling

The strip sat in a flex row with no `min-w-0`. A flex item defaults to
`min-width: auto`, so instead of overflowing and scrolling inside its own
container, the strip pushed the whole row wider than the panel — and the
centre-on-play behaviour silently never fired, because nothing ever overflowed.
Verified by asserting `scrollWidth > clientWidth` and measuring the active
frame's offset from the container centre, rather than by eye.

### 12.8 Capture interval was destroyed by integer rounding — **exported data**

`row.fps` — the value written into the exported spritesheet manifest as
`animations[].fps`, and the one the preview plays at — was computed as
`Math.round(1000 / intervalMs)`. Integer rounding is lossy at the slow end and
catastrophic past two seconds:

| Capture interval | Stored fps | Plays / exports at | |
|---|---|---|---|
| 100ms | 10 | 100ms | ok |
| 500ms | 2 | 500ms | ok |
| 700ms | 1 | 1000ms | **43% wrong** |
| 1500ms | 1 | 1000ms | **33% wrong** |
| 2500ms | **0** | — | **`fps: 0` in the manifest** |

Three separate faults compounded it:

1. `row.fps ?? 12` in the manifest did not catch the zero — `??` is nullish
   coalescing, and zero is not nullish, so `fps: 0` shipped to consumers.
2. The preview clamped with `Math.max(1, fps)`, so every sub-1fps sequence
   played at 1000ms no matter how far apart its frames were captured — hiding
   the fault from anyone checking by eye.
3. There were **two** capture paths computing fps independently (single frame
   and recorded sequence). Fixing one and not the other made the two disagree,
   which the reproducibility e2e would have caught.

Now one helper, `fpsFromCaptureInterval()`, used by both paths, keeping six
decimals — enough to round-trip every interval the UI allows to well under a
millisecond, while whole rates stay whole (100ms is still exactly 10). The
preview reads it back through `captureIntervalFromFps()`. Covered by
`tests/unit/capture-interval.test.ts`.

### 12.9 See also

`improvements.md` documents unrelated model-cache defects found earlier.

## 13. Glossary

| Term | Meaning |
|---|---|
| **Rail** | A full-height side column (left = scene/inspector, right = export) |
| **Tile** | A bordered, rounded surface inside a rail (§6.1) |
| **Stage** | One step of the export pipeline (§6.8) |
| **PiP** | The camera preview nested in the scene view (§7) |
| **Scrub** | Changing a numeric by horizontal drag (§6.4) |
| **Ladder** | The tonal surface scale (§3.2) |
