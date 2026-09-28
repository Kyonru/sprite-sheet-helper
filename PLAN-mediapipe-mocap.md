# PLAN: Make the in-app MediaPipe capture production-grade

> **This file is a self-contained instruction to Claude.** Re-read it in full at
> the start of any session that touches Pose Studio capture, then continue from
> "Current state". It carries its own acceptance criteria — do not treat a task
> as done because it compiles or because a sprite sheet appeared. Done means the
> acceptance criteria below are met *and demonstrated with numbers*.

## The instruction

Work on Sprite Sheet Helper's **in-app MediaPipe motion capture** until it meets
the same bar the EasyMocap proof of concept was held to, and keep working
through the checklist below rather than stopping at the first plausible result.

The standard is inherited verbatim from the EasyMocap experiment brief:

- **Prioritise proving or disproving with measurable evidence.** No claim of
  improvement without a before/after number produced by a repeatable command.
- **Expose where errors originate** — 3D recovery, coordinate conversion,
  skeleton mapping, rest-pose mismatch, retargeting, root motion, GLB export,
  or playback. A metric that cannot attribute a fault is not enough.
- **Do not hide a bad recovery behind smoothing.** Every cleanup step stays
  optional and non-destructive, and raw vs cleaned must remain comparable.
- **Deterministic tests** with synthetic fixtures, no network, no licensed
  models.
- **Do not regress** existing GLB/FBX loading, embedded animation playback, the
  timeline, exports, or CLI workflows.
- **Run formatting, static checks and tests before finishing.**
- **Report honestly**: if something failed, say so with the output; if a step
  was skipped, say that.

Constraint that decides the architecture: **local, free for users, and
commercially distributable.** MediaPipe (Apache-2.0) satisfies this; EasyMocap
does not. That is settled — see `LICENSE-NOTES.md` on branch
`experiment/easymocap-poc`.

## Why this work exists

The EasyMocap experiment (branch `experiment/easymocap-poc`, see its
`report.md`) proved the whole video → sprite-sheet pipeline works, then
concluded EasyMocap cannot ship: research-only licence, AGPL yolov5, SMPL
registration, 1.8 GB of assets, ten packaging defects. MediaPipe is the viable
provider. On the same 3 s walking clip, with the experiment's processing
applied, MediaPipe measured:

| | EasyMocap | MediaPipe (experiment) |
| --- | ---: | ---: |
| Inference | 149 ms/frame | **83 ms/frame** |
| Angular jitter | 308 deg/s² | **222** |
| Bone-length variance | 2.46e-30 | **1.77e-30** |
| Root jitter | **0.011** | 0.028 |
| Foot slide (mean) | **3.2 mm** | 6.1 mm |
| Torso-axis agreement | — | **4.2°** |

So MediaPipe is faster and temporally *better* than EasyMocap once processed
properly, and still worse on root motion. The processing is the product.

## Findings to port into the app

Each was measured in the experiment. Numbers are from `walking.mp4`
(768×432, 3.0 s, 71 frames, one person in profile).

1. **World landmarks are hip-centred — they contain ZERO root translation.**
   The world hip centre stayed within 1 mm of the origin for the whole clip
   while the screen hip centre crossed the frame. Root motion must be recovered
   from *screen* landmarks via weak perspective. The experiment's estimate gave
   2.60 m of travel against EasyMocap's 2.85 m, and derived a focal length of
   576 px — exactly the value EasyMocap independently assumed.

2. **Aiming the neck at the nose tips the head down by ~2×.** The nose sits
   forward of the head axis, so a straight-up rest direction books a fixed
   anatomical offset as rotation: 56.5° of head lean against EasyMocap's 28.0°.
   Fix = aim at the **ear midpoint** *and* calibrate that bone's rest direction
   from the clip's median in the torso frame. Result: 4.7°, and overall body
   lean landed on 9.1°, matching EasyMocap to 0.1°.

3. **Smoothing belongs on the input landmarks, not the output quaternions.**
   Output rotations are already coupled by the kinematic chain, so filtering
   them mixes error between joints.
   *Correction after reading the app:* it already does upstream landmark
   smoothing — `JointSmoother` in `model-preview.tsx` filters raw joint
   positions before bone directions are computed. It also runs a second,
   downstream pass over the output quaternions (`PoseSmoother` in
   `buildSmoothedFrame`). So the ordering is already right; the outstanding
   issues are the tuning and the timestep, not the placement.
   **Remaining defect:** `JointSmoother` is driven by `useFrame`'s render
   delta, so for file capture the same landmarks get filtered repeatedly at
   render rate rather than once per source frame — over-smoothing that varies
   with machine speed.

4. **One Euro tuning, measured by sweep** (angular jitter vs torso agreement):
   raw 1436 deg/s² → 0.5/0.02 gives 212 with only 0.25° of pose given up.
   The app uses `PoseSmoother(0.4)` with **beta 0.3**, ~15× more responsive
   than measured-optimal.

10. **`PoseSmoother` recomputed its timestep per track, not per frame.** Each
    `smoothVec`/`smoothQuat` call advanced a shared wall clock, so with ~37
    tracks per pose exactly one saw a real interval and the rest saw ~1e-7 s.
    Measured directly: `16.7 ms, 4.6e-7, 2.1e-7, 8.4e-8, 8.3e-8`. A One Euro
    alpha is `1/(1 + tau/dt)`, so those tracks stopped tracking — 34% behind on
    a ramp. **FIXED** (`beginFrame(time)`); this also removed the wall clock, so
    the same video now yields the same animation on any machine.

5. **Hip-across is fragile in profile.** The across-axis points near the view
   axis where MediaPipe depth is weakest; hip and shoulder lines disagreed
   12.6° mean / 22.4° max, and shoulder width measured 0.26 m against a real
   ~0.38 m. Combine both lines, visibility-weighted.

6. **A fixed skeleton solved once per clip.** Landmark bone lengths wobble
   5.6% (median absolute deviation). Solving median lengths once, and forcing
   left/right symmetry, removes that from every downstream quantity.

7. **Recovered motion is in CAMERA space.** A performer walking across frame
   faces +X while Mixamo rigs and the `platformer` workflow expect +Z. Every
   automated check passed on a visibly wrong sprite sheet; only the rendered
   PNG revealed it. Needs a facing-canonicalisation step.

8. **`--root-motion preserve` is unusable for sprite sheets** under a
   perspective workflow camera — apparent size swings wildly between direction
   rows. In-place should be the default.

9. **Low-visibility landmarks should hold, not guess.** The occluded far arm in
   a profile shot measured visibility 0.053. A held joint is stale; a guessed
   one is wrong.

## Current state

- Branch `main`. The experiment lives on `experiment/easymocap-poc` and is
  reachable with `git show experiment/easymocap-poc:experiments/easymocap-poc/<path>`.
- Reference artifacts from the experiment runs are still on disk (gitignored)
  under `experiments/easymocap-poc/output/` — `real-run/` (EasyMocap) and
  `mp-run/` (MediaPipe), both on `walking.mp4`.
- **Done so far:** M0 (harness), M1 (timestep bug), M10 (sign continuity), all
  with tests. M3 was **already implemented** in the app. **M2 investigated and
  DISPROVEN.** **M7 done** — a real 100× bug fixed and four root-recovery
  methods built and compared. **M9 partially done** — contact detection works
  and foot slide is now a real measurement. See "M7/M9 status" below.

### Baseline — `walking.mp4`, the app's own solve

```
npm run pose:capture -- --video /path/walking.mp4 --out .pose-bench/walking.landmarks.json
npm run pose:bench   -- --landmarks .pose-bench/walking.landmarks.json \
                        --character example_animation.glb --json .pose-bench/baseline.json
```

| Metric | Baseline | Target | Status |
| --- | ---: | ---: | --- |
| frames / detected | 71 / 71 | — | ✅ |
| inference / solve | 87 / 0.11 ms per frame | — | ✅ inference dominates |
| stature (rig units) | 1.452 | — | plausible |
| bone-length variance | 1.47e-17 | ≤1e-12 | ✅ rotation-only, rigid |
| angular jitter | **225.50 deg/s²** | ≤250 | ✅ |
| error vs lag-free reference | 5.49° | as low as possible | see M2 |
| pelvic yaw peak-to-peak | 18.04° | 8-16° (walking) | ⚠️ over range; see M6 |
| ground offset before alignment | 0.1377 units | 0 | ✅ fixed by `--ground-align` |
| root jitter | 6.7e-06 | <0.028 | ✅ trivially — almost no root motion exists |
| quaternion flips | 0 | 0 | ✅ |
| **foot contacts** | **1** | >0 | ⚠️ barely; 2 contact frames of 71 |
| foot slide mean | 2.53 mm | ≤6.5 mm | ⚠️ from 2 frames — not yet meaningful |
| **frames with held bones** | **71 / 71** | lower | ❌ every frame has an occluded bone |

The remaining real gap is **root motion**: with only 2 contact frames the
slide figure rests on almost no data. That is finding 1 reproduced through the
app's own path — world landmarks are hip-centred, the body barely moves, and
almost nothing is ever slow enough to count as planted. M7 is what fixes it.

**Bone-length variance:** the ≤1e-25 threshold in the original acceptance
criteria was an artefact of one clip landing near floating-point zero. Anything
below ~1e-12 means "rotation only, nothing stretching". Do not chase the
exponent.

### M2: retuning the smoothing — investigated, not warranted

The premise was that `PoseSmoother`'s `beta = 0.3` is ~15× less smoothing than
the experiment measured as optimal (0.02). That finding **does not transfer**:
the app has two smoothing stages and a different solve, and measurement says
the current tuning is already on the frontier.

Measured with the lag-free reference (raw = 1536.3 jitter / 2.32° error):

| landmark / pose tuning | jitter (deg/s²) | error vs reference |
| --- | ---: | ---: |
| 3.0/1.0 · 2.0/1.0 | 518.5 | 2.95° |
| 2.0/0.5 · 1.5/0.5 | 379.0 | 3.79° |
| 1.5/0.8 · 1.0/0.5 | 359.9 | 4.16° |
| 1.0/0.5 · 1.0/0.5 | 303.4 | 4.75° |
| 1.5/0.5 · 0.4/0.3 | 266.0 | 5.15° |
| **1.0/0.5 · 0.4/0.3 (current)** | **241.7** | **5.57°** |
| 0.5/0.15 · 0.4/0.3 | 147.6 | 6.91° |
| 0.3/0.02 · 0.2/0.02 | 23.4 | 8.12° |

The trade is monotonic and nothing dominates. **The current default is the only
configuration tested that meets the ≤250 jitter target**, and it sits on the
frontier. Changing it would trade a target the plan sets for one it does not.

Also measured: each stage alone reaches ~490–513 deg/s²; together they reach
241.7 from a raw 1536.3. Both stages are earning their place.

**Limitation, stated plainly:** the reference is the raw landmarks smoothed
non-causally, so it inherits any systematic MediaPipe bias. It measures lag and
bandwidth, not absolute truth. A verdict on absolute accuracy needs ground-truth
mocap, which this project does not have.

### Corrections to the harness, worth remembering

The harness itself has now been wrong **seven** times, and each time it produced
a confident, plausible, wrong number. Distrust a measurement before trusting the
thing it measures. Items 1-4 are below; 5-7 are in "M6: the across-axis".

1. **The jitter metric measured rotation STEP SIZE.** A unit test caught that
   this scores **zero** for a joint alternating between two poses — the most
   common jitter pattern there is. Now extrapolates the previous step and
   measures the error against the actual frame. The experiment's
   `compare-clips.ts` has the same blind spot.
2. **The bench skipped the record-time smoothing stage**, so it measured the
   preview rather than what is actually recorded. This made the first baseline
   read 512.79 deg/s² and "0 foot contacts"; the true figures are 241.74 and 1.
3. **The "raw" reference used already-smoothed landmarks**, making the metric
   blind to landmark-stage lag and producing the nonsense result that heavier
   smoothing *improved* fidelity. The reference is now solved from genuinely
   raw landmarks, and a separate zero-phase (forward-backward) reference gives
   a lag-free target to measure real error against.

### App code that matters

| File | Role | Known issue |
| --- | --- | --- |
| `src/hooks/next/use-mediapipe.ts` | Landmarker setup, model tiers | — |
| `src/utils/mediapipe-to-bones.ts` | Landmarks → `JointPositions` | `toLH` drops nothing but the mapping is positions-only |
| `src/utils/pose-retargeting.ts` | Quality scoring, `applyRetargetedPose` (swing via `setFromUnitVectors`), calibration, anatomical clamp | per-frame, no temporal model |
| `src/utils/animation-smoothing.ts` | `PoseSmoother`, One Euro | beta 0.3 (M1 fixed the timestep) |
| `src/utils/pose-solve.ts` | **NEW** — the landmarks→rig solve, extracted and pure | M5 and M6 done; `solveAcrossAxis`/`restoreAxisDepth` both default to off |
| `src/utils/pose-skeleton.ts` | **NEW** — fixed skeleton per clip | inert for this solve by construction (M4) |
| `src/utils/pose-metrics.ts` | **NEW** — objective metrics | accepts external contacts |
| `src/utils/pose-root-motion.ts` | **NEW** — screen/foot root recovery, motion modes | screen source is the worst; kept for comparison |
| `src/utils/pose-contacts.ts` | **NEW** — contact detection + rig-space root solve | the winning path |
| `scripts/pose-capture.mjs`, `scripts/pose-bench.ts` | **NEW** — the harness | now typechecked via `tsconfig.scripts.json` |
| `src/components/pose-studio/model-preview.tsx` | Drives retargeting onto the rig | now delegates to `pose-solve.ts` |
| `src/components/pose-studio/pose-studio-shell.tsx` | Capture loop, frames, clip build | `buildSmoothedFrame` smooths output |
| `src/utils/pose-to-animation.ts` | Frames → `THREE.AnimationClip` | M10 fixed |

## Work items

Ordered by measured value. Tick only with a number attached.

- [x] **M0. Measurement harness.** DONE.
      `npm run pose:capture` (Puppeteer + the app's exact MediaPipe version and
      model) and `npm run pose:bench` (the app's own solve, headless, with
      `--compare` for before/after). Required extracting the solve out of
      `model-preview.tsx`'s `useFrame` into `src/utils/pose-solve.ts` — a
      benchmark that re-implements the solve measures the benchmark. Metrics
      live in `src/utils/pose-metrics.ts` with 9 synthetic tests.
      `compareBoneDirections` carries both corrections from the experiment:
      root-local directions only, never local quaternions across providers and
      never world directions across clips with different facings.
- [x] **M1. Fix `dt`.** DONE. `PoseSmoother.beginFrame(time)` fixes one
      timestep per frame from the frame's own timestamp; `buildSmoothedFrame`
      calls it. 8 regression tests in `tests/unit/animation-smoothing.test.ts`.
      This was a real bug, not a tuning issue — see finding 10.
- [x] **M2. Retune smoothing — DISPROVEN, no change made.** The full sweep is
      above: the current tuning is the only one meeting the ≤250 jitter target
      and sits on the jitter/lag frontier. The experiment's 0.5/0.02 finding
      does not transfer to the app's two-stage pipeline.
      **Still outstanding from M2:** `JointSmoother` in the live preview is
      driven by `useFrame`'s render delta, so for file capture the same
      landmarks are refiltered at render rate. The benchmark already drives it
      from the source frame rate; the app should too.
- [x] **M3. Visibility gating** — ALREADY IMPLEMENTED in the app before this
      work: `VIS_THRESHOLD = 0.5` with hold-last-good and a quality-scaled ease
      back toward rest. Now surfaced by the harness as "frames with held
      bones", which reads 71/71 on the reference clip.
- [x] **M4. Fixed skeleton — BUILT, and DISPROVEN for this solve.**
      `src/utils/pose-skeleton.ts`, 10 tests. It is mathematically INERT here,
      and provably so - see "M4: why a fixed skeleton cannot help a
      direction-driven solve" below.
- [x] **M5. Ear-midpoint neck + calibrated rest direction — DONE.**
      neck→head lean 56.4° → 9.4°, total torso lean 17.6° → 10.6°.
- [x] **M6. Combined across-axis — BUILT, REJECTED as specified.** Blending
      improves both available metrics monotonically while pushing pelvic yaw
      out of its physiological range. A better-founded mechanism (depth
      restoration) ships off by default because nothing in a profile clip can
      supply the width it needs. See "M6: the across-axis" below.
- [x] **M7. Root translation recovery — DONE.** Four methods built and
      compared; the rig-space solve wins by 2.1x. Found and fixed a 100x
      pre-existing bug. `src/utils/pose-root-motion.ts` + `pose-contacts.ts`,
      35 tests.
- [x] **M8. Facing canonicalisation — DONE.** `canonicaliseFacing`; applied
      102.37° on the reference clip.
- [x] **M9. Contact detection and ground alignment — DONE.**
      `detectContacts` works on hip-relative height and finds 6 intervals /
      100% grounded on the reference clip. Foot slide is now measured against
      real contacts (91 frames) instead of 1-2, so it is a real number for the
      first time. `solveGroundOffset` now aligns the clip to the floor: the
      reference walk was floating **0.1377 rig units**, about 9% of stature.
      It does NOT touch foot slide, and the plan was wrong to list it as the
      last lever on it - see below.
- [x] **M10. Quaternion sign continuity** in `buildAnimationClip`. DONE —
      `enforceQuaternionContinuity`, applied to the hips and every bone track,
      with tests.
- [x] **M11. Surface it in Pose Studio — DONE.** The stress harness remains
      available through `npm run pose:stress`; Pose Studio now carries the
      shared solver's held-bone diagnostics and the shared landmark-jump
      detector into its live capture review UI.
- [x] **M11a. Surface it in Pose Studio — DONE.** Clip-average quality,
      held-frame and held-bone counts, landmark-jump warnings and marked
      timeline frames now survive delete/trim operations. Landmark and recorded
      pose smoothing are independently switchable and lock while recording so
      a clip cannot silently mix cleanup settings.

## M7 / M9 status

### What was fixed: a 100× root-motion bug, pre-existing

`solvePoseOntoRig` wrote root translation straight into `hips.bone.position`.
Bone positions are LOCAL, and a Mixamo FBX→GLB export parents the hips under an
`Armature` node scaled to **0.01** (the original centimetres → metres). So a
world-space delta written locally came out one hundred times too small.
Measured on the reference rig: hips travelled **0.032 units where 3.35 were
intended**.

This also affected the app's own pre-existing vertical root motion, which
measured **0.000 units of travel** before the fix and 0.165 after. `--root-motion`
in Pose Studio was very nearly a no-op on any Mixamo-derived rig.

Fixed by `worldDeltaToLocal()`, which takes the delta through the parent's
inverse world rotation and scale. This is the same defect the EasyMocap
experiment hit; it is apparently a standard trap with these rigs.

### What was built

Two independent ways to recover translation, both in
`src/utils/pose-root-motion.ts`, selectable with `--root-source`:

| | screen (weak perspective) | feet (integration) |
| --- | --- | --- |
| needs a camera model | yes — focal is **assumed** | no |
| recovered travel | 3.06 m | 1.71 m |
| vs stride-implied ~2.6 m | **+18%** | **−34%** |
| drifts over a long take | no | yes (it integrates) |
| handles both feet airborne | yes | no |

Plus `preserve` / `in-place` / `scaled` modes, with `scaled` using hip heights
measured from the data (performer 0.83 m, rig 1.04 m) rather than assumed.

### Contact detection: height, not speed

The speed-based detector could not work, and the reason is worth keeping. A
foot's WORLD speed depends on the root — the very thing foot slide is meant to
judge — so keying on it is circular. It also simply fails: 10th-percentile foot
speed measured 0.33–0.47 rig units/s against a sensible 0.156 threshold, giving
**0–3 contacts out of 71 frames** and a foot-slide figure of 0.0 that looked
perfect and meant nothing.

Hip-relative **height** is clean and needs no root: planted feet sat at ≈ −0.83
and lifted ones at ≈ −0.60, a 0.23 m separation far above the noise. With
hysteresis and a fractional threshold derived from the clip's own range,
`detectContacts` finds **6 intervals, 100 % grounded** — which matches the
2.2 strides visible in the data.

Foot slide is now measured over **91 contact frames** instead of 1–2. It is a
real number for the first time.

### Four root sources, compared on that real number

| root source | travel | slide mean | slide max |
| --- | ---: | ---: | ---: |
| none | 0.000 | 33.6 mm | 94.2 mm |
| screen (weak perspective) | 3.058 | **64.6 mm** | 308 mm |
| feet (landmark velocity) | 1.829 | 43.1 mm | 103 mm |
| contacts (landmark + detector) | 1.934 | 30.7 mm | 93.4 mm |
| **rig (the posed rig's own feet)** | 1.295 | **15.9 mm** | 77.5 mm |

**The rig-space solve wins by 2.1×**, over both the best landmark method and
over having no root at all.

Why it wins: every landmark-derived root leaves a scale mismatch, because the
rig's legs are rarely the performer's length, so its feet sweep a different
distance per stride. Taking the velocity from the rig's own contact foot
cancels exactly, whatever the proportions. It needs the poses first, so it is a
second pass.

Two hypotheses were tested and **rejected** along the way: correcting by the
hip-height ratio (`scaled`) made slide *worse* (34.8 mm vs 30.7 mm), and the
weak-perspective estimate is the worst option of all despite being the most
"principled-looking" — its assumed focal length over-estimates travel by ~18 %.

### Per-foot thresholds: the near/far foot bias

Checking the contact windows against real gait statistics exposed an
asymmetry, not the uniform over-generosity I had assumed:

| | shared threshold | **per-foot** | real walking |
| --- | ---: | ---: | ---: |
| left foot down | 87 % | **69 %** | ~62 % |
| right foot down | 49 % | **56 %** | ~62 % |
| double support | 37 % | **25 %** | 20–25 % |

The left foot is the NEAR one in a profile shot; MediaPipe places the occluded
far foot systematically higher, and a single shared threshold turns that depth
bias straight into a contact bias. Normalising each foot against its own range
cancels it, and brings every gait statistic into the real range.

**Foot slide 15.9 mm → 9.9 mm.**

### Two more hypotheses tested and rejected

**The toe is not a better contact point** — 11.3 mm against the ankle's 9.9 mm.
The toe sits further out along the chain, so noise in the ankle's rotation is
amplified there. Kept switchable (`--contact-toe`) because on a cleaner
reconstruction the physically-correct point should win.

**Trimming the contact intervals does not help, and nearly fooled me.**
Trimming both the solve and the measurement appeared to hit the target:

| trim (solve **and** measure) | slide mean | frames measured |
| ---: | ---: | ---: |
| 0 | 9.9 mm | 83 |
| 2 | **6.0 mm** ✅ | 59 |

But holding the measurement window fixed at 83 frames and trimming only the
SOLVE reverses it completely:

| trim (solve only) | slide mean | frames measured |
| ---: | ---: | ---: |
| 0 | **9.9 mm** | 83 |
| 2 | 12.2 mm | 83 |
| 4 | 14.6 mm | 83 |

So the apparent success came **entirely from measuring fewer frames**, not from
a better root. The target was never met. Default trim is 0, and the test suite
pins it there with that reasoning attached.

*This is the fourth time a measurement produced a confident, plausible, wrong
answer. Always separate "changed the thing" from "changed what is measured".*

### Current best, honestly

Per-foot thresholds + rig-space root + ankle contact points, no trimming:

| metric | value | target | |
| --- | ---: | ---: | --- |
| foot slide mean | **9.9 mm** | ≤6.5 mm | ❌ 1.5× over |
| foot slide max | 69.7 mm | — | |
| contacts / frames | 6 / 83 | >0 | ✅ |
| angular jitter | 241.7 deg/s² | ≤250 | ✅ |
| bone-length variance | 1.47e-17 | ≤1e-12 | ✅ |
| error vs lag-free ref | 5.57° | — | |

### Still outstanding

1. ~~**Ground alignment** is the last untried item that could plausibly move
   foot slide.~~ **Wrong, and provably so.** Foot slide is
   `hypot(dx, dz)` between consecutive contact frames — purely horizontal — so
   a uniform vertical offset cannot change it by a micron. Measured anyway:
   `--ground-align` leaves the mean at 0.0098761 to the last digit. Ground
   alignment was still worth doing, for a different defect: the reference walk
   floats **0.1377 rig units** above the floor, which for a sprite sheet means
   a character skating above the tile's ground line in every frame.
2. The residual 9.9 mm is most likely reconstruction noise in the ankle
   rotation itself, which no root solve can remove. If ground alignment does
   not close the gap, the honest step is to revisit the ≤6.5 mm target: it was
   inherited from an EasyMocap run on a different skeleton and may simply not
   be reachable from MediaPipe landmarks.

## Looking at the render — three bugs no metric caught

Criterion 6 exists because metrics cannot see a character facing the wrong way.
Rendering the walk through the app's own CLI and comparing it frame-by-frame
against the source footage found three defects while every number "passed".

**1. Facing (M8).** The character came out at a three-quarter angle.
`canonicaliseFacing` in `pose-solve.ts` rotates the clip onto the rig's rest
forward; it applied **102.37°**, matching the EasyMocap experiment's 101–106°
and independently confirming the diagnosis. **DONE.**

**2. A frozen T-pose arm.** `leftArm`/`leftForeArm` were held **71/71 frames** —
a profile shot occludes the far arm in every frame, so at the 0.5 visibility
gate they were never driven and stayed in Mixamo's rest pose, sticking straight
out sideways.

Deliberately **not** fixed by fabricating a mirrored swing. MediaPipe still
emits a temporally tracked estimate for an occluded limb; using its real output
is less of an invention than asserting a horizontal arm.

| visibility gate | held frames |
| ---: | ---: |
| 0.5 (app default) | 71 |
| 0.2 | 38 |
| **0.05** | **9** |

**3. The feet, and the posture.** Both were spotted by eye first, then measured.

*Feet:* driven from **ankle→toe**, which mixes the ankle joint's own position
error into the foot's angle. One frame gave a right-foot direction of
`(-0.77, +0.12, -0.62)` — pointing UP and BACKWARD, anatomically impossible
mid-stride. Heel and toe are both on the rigid foot, so `heel→toe` is the
foot's actual axis. **Fixed.**

*Posture:* the render was visibly hunched. Measured, then split:

| | before | ear midpoint | **+ calibrated carriage** | a real walker |
| --- | ---: | ---: | ---: | ---: |
| neck→head lean | 56.4° | 46.5° | **9.4°** | ~0° |
| hips→head lean | 17.6° | 17.2° | **10.6°** | 0–8° |

56.4° reproduces the experiment's 56.5° exactly — the same nose-aiming defect
(finding 2), independently confirmed in the app's own path. The ear midpoint
alone only reaches 46.5°, because shoulder-centre→ear-midpoint is **already**
tilted forward in a neutral pose; `solveHeadAimCorrection` calibrates that out
against the clip's median carriage. **M5 DONE.**

Remaining visible gap: spine lean is 11.3°, a little above a real walker.

## M4: why a fixed skeleton cannot help a direction-driven solve

Finding 6 said landmark bone lengths wobble 5.6% and that solving median
lengths once "removes that from every downstream quantity". Built it
(`src/utils/pose-skeleton.ts`: `solveFixedSkeleton`, `applyFixedSkeleton`,
`segmentLengthVariation`), measured it, and the premise is **false for this
solve**. Measured wobble in the app's own path is 2.5% median MAD, worst
`leftAnkleToe` at 13.0%.

| | baseline | fixed skeleton | + `--skeleton-no-feet` |
| --- | ---: | ---: | ---: |
| angular jitter | 225.50 | **254.90** (+13%) | **225.50** |
| error vs lag-free ref | 5.4852 | 5.7106 | **5.4852** |
| foot slide mean | 9.876 mm | 9.559 mm (−3%) | **9.876 mm** |

Excluding the feet makes it **bit-identical to not running it at all**, in
every digit of every metric. So the entire effect — both the 13% jitter cost
and the 3% slide gain — comes from re-projecting the heel and toe. Everything
else the fixed skeleton does is a no-op.

The reason is structural, not empirical. `applyRetargetedPose` drives each bone
with `setFromUnitVectors` on a segment's **direction**, and re-projecting a
joint *along the direction it was already observed at* cannot change that
direction. Length wobble never enters a direction, so there is nothing there
for a fixed skeleton to remove. It changes exactly one thing: the foot, which
is driven heel→toe from two siblings re-projected off the ankle by *different*
lengths, so their difference vector rotates — feeding the ankle's angular noise
in twice with different lever arms. That costs more than it buys.

Where a fixed skeleton *would* matter is the paths that use absolute positions:
weak-perspective root recovery and contact detection. Both already solve their
own lengths. Kept, off by default, with `segmentLengthVariation` as a
diagnostic — but the finding is that this lever does not exist here.

## M6: the across-axis

### Blending in the shoulder line — rejected

Finding 5 proposed combining the hip and shoulder lines, visibility-weighted.
`solveAcrossAxis` does that. The sweep looks like a clean win:

| shoulder weight | jitter | error vs ref | **pelvic yaw p2p** |
| ---: | ---: | ---: | ---: |
| 0 (hip only) | 225.50 | 5.4852 | **18.04°** |
| 0.5 | 218.63 | 4.9722 | 20.85° |
| 1.0 | 216.32 | 4.7033 | 22.85° |
| 3.0 | 214.74 | 4.2914 | 27.93° |

Both metrics improve **monotonically**, with nothing to pick a stopping point —
which is the signature of plain variance reduction, not of better recovery.
Averaging two noisy estimates always lowers variance, and both available
metrics are variance-like: jitter measures frame-to-frame change, and the
lag-free reference is itself a smoothed version of the same landmarks.

So a metric with an **independent physical reference** was needed.
`yawAmplitudeDeg` measures the root's yaw swing, and pelvic rotation during
level walking has a known range of roughly ±4–8°, so 8–16° peak to peak. It
says the opposite: blending pushes yaw **further out** of range, because the
shoulder line measures *thoracic* yaw, which is genuinely larger — the pelvis
and thorax counter-rotate. Averaging them makes the hips rotate with the chest.
**Rejected**; `--shoulder-across` defaults to 0.

### Depth restoration — right mechanism, missing input

The other half of finding 5 is the real defect, and it reproduced exactly: the
shoulder line measures **26.0 cm** in the app's own path, against the
experiment's 0.26 m and a real biacromial breadth of ~38 cm. Monocular
estimators compress the component along the view direction, and in a profile
shot the across-axis points almost straight down it.

`restoreAxisDepth` puts the missing length back where it went — into depth, by
Pythagoras — which swings the axis off the image plane, where an axis pinned
near the image plane turns small in-plane noise into large apparent yaw. It
moves everything the right way, *including* the independent check:

| hip-width target | jitter | error vs ref | slide | **pelvic yaw p2p** |
| --- | ---: | ---: | ---: | ---: |
| off (measured 22.7 cm) | 225.50 | 5.4852 | 9.876 mm | 18.04° |
| 32 cm | 224.24 | 5.3920 | 9.856 mm | **13.59°** ✅ |
| 40 cm | 223.58 | 5.3307 | 9.845 mm | 10.74° |

But it needs a true hip width, and **nothing available can supply one**:

- **The clip cannot.** The widest frame would be the least foreshortened and so
  a self-calibrating lower bound — but only if the performer turns. On a
  profile walk the hip line is compressed in *every* frame: median 22.7, p90
  23.9, max 24.3 cm, a 7% spread. It never reveals its own length.
- **The rig cannot.** `--hip-width auto` derives it from the rig's own hip
  separation scaled by hip height: 11.2 cm, *below* the observation, so the
  guard correctly makes it a no-op.
- **An anthropometric table would be a guess** about an unknown performer.
  Measured shoulder:hip is 26.0:22.7 = 1.15 where an adult's is ~1.4–2.0, so
  the two lines are compressed by *different* amounts and one ratio cannot fix
  both.

Ships as `--hip-width <metres>`, off by default. Adopting it would mean fitting
one parameter to one physiological prior on one clip, which is the failure mode
this plan already recorded four times.

### Two harness bugs found on the way

5. **`scripts/` was in no tsconfig at all.** The entire measurement harness —
   the source of every number in this document — had no type checking.
   `solveGroundOffset` was handed a `{left: boolean[]}` where a `ContactResult`
   was required; it compiled, ran, and reported "no contacts" on a clip with 83
   of them. Added `tsconfig.scripts.json` to `npm run typecheck`, which
   surfaced 16 errors including that one.
6. **The reference paths solved a different convention.** `rawResult` and
   `refResult` were not given `headAimCorrection` or `visThreshold`, so
   "error vs lag-free reference" was reporting a fixed convention difference as
   pose error: **8.33° with `neck->head` at 40.2°** as the worst segment. These
   references exist to isolate what *smoothing* costs, so they must differ from
   the measured path in nothing else. Fixed: **8.33° → 5.49°**.

7. **`yawAmplitudeDeg` used a plain median as a circular centre.** Caught by
   its own unit test: angles of [176, 179, −179, −176] have a median of 0, so
   every frame reads ~178° from centre and an 8° swing reports as 358°. Now
   uses the circular mean — the same direction-summing `canonicaliseFacing`
   already does, a trap this codebase had already fallen into once.

## Stress test across a corpus

`npm run pose:stress` runs the whole pipeline over eight deliberately awkward
CC0/PD/CC-BY clips and **audits the results automatically**, because a table
nobody reads is not a stress test. Corpus and licences: `scripts/pose-corpus.json`.

| clip | det% | jitter | torso | head | verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| yoga-tadasana (static stand) | 99 | **244** | 10° | 13° | ✅ ok |
| sign-language (upper body only) | 100 | **94** | 7° | 7° | warn: 81/81 frames holding a bone |
| treadmill | 97 | 631 | 12° | 15° | warn: jittery, 3 landmark jumps |
| jacks-burpees | 100 | 665 | 22° | 23° | warn: jittery |
| kickboxing (two fighters) | 100 | 688 | 6° | 11° | warn: jittery |
| seated-dinner | 100 | 863 | 7° | 10° | warn: jittery |
| yoga-trikonasana (deep side bend) | 93 | **2202** | 62° | 66° | ❌ limbs snapping (15 jumps) |
| astronaut-treadmill (montage) | 100 | **2282** | 20° | 39° | ❌ limbs snapping (3 jumps) |

**Nothing crashed, produced NaN, or stretched a bone** on any clip —
bone-length variance stayed at ~1e-17 throughout. Degradation is graceful.

### What the corpus actually found

- **Landmark discontinuity is the dominant failure mode.** The two worst clips
  by jitter are the two with big frame-to-frame landmark jumps.
  `detectLandmarkDiscontinuities` reports them, but **cannot distinguish a shot
  cut from the detector losing the pose** — a montage and an ambiguous
  silhouette look identical to it. It is an attribution hint, never an excuse,
  and jitter stays a failure whichever cause it has.
- **Partial-body footage invents the missing half.** `sign-language` is a
  seated woman filmed from the waist up; the render is a standing figure whose
  legs are pure rest pose. It does not crash and the upper body is the cleanest
  result in the corpus (jitter 94), but nothing tells the user the legs are
  fabricated beyond a held-bone count.
- **Static poses reconstruct best** (tadasana, 244) — as expected, and a useful
  floor for what the pipeline can do.

### Four mistakes I made building it, worth not repeating

1. **Took the first N seconds of each clip.** Three "pipeline failures" were
   nothing of the sort: two clips open with a title card and one with a shot of
   pavement, so MediaPipe correctly detected nobody. The harness now probes the
   whole video at 2 fps and keeps the densest window — detection went from
   46–76 % to 93–100 %.
2. **Chose a clip by its filename.** `Jumping_jack_slow_motion.webm` is an
   *insect*, not a person doing jumping jacks. Look at the footage.
3. **Failed clips for being non-upright.** A trikonasana side bend legitimately
   leans 62°; the audit called that a failure. Lean is now a warning only —
   those thresholds encode a prior about footage, not a fact about bodies.
4. **Let cut-detection downgrade failures to warnings**, which made the suite
   report 8/8. That is gaming the audit; reverted.

## Acceptance criteria

Not done until **all** of these hold, each demonstrated by a command whose
output is pasted into the final report:

1. `npm run typecheck`, `npm run lint`, `npm run test:unit`,
   `npm run test:integration` all pass. Lint error count stays at **0**.
   `npm run typecheck` must cover `scripts/` — the harness produces every
   number here and was unchecked until it silently reported "no contacts" on a
   clip with 83.
2. `npm run test:e2e:goldens` passes, or any golden change is intentional and
   explained.
3. New deterministic unit tests cover: landmark→canonical mapping, the
   coordinate conversion, sign continuity, fixed-skeleton solving, root
   recovery, facing canonicalisation, contact detection, ground alignment,
   across-axis blending, depth restoration, yaw amplitude, and root-motion
   modes. No network, no licensed models.
4. On `walking.mp4`, measured through M0's harness, the in-app path reaches at
   least the experiment's MediaPipe numbers: **angular jitter ≤ 250 deg/s²**,
   **bone-length variance ≤ 1e-25**, **foot slide mean ≤ 6.5 mm**,
   **torso-axis agreement with the EasyMocap reference ≤ 6°**.
5. **Root jitter beats the experiment's 0.028** — this was MediaPipe's one
   clear loss to EasyMocap (0.011) and is the bar that is not yet met.
6. A sprite sheet rendered through the app's own CLI shows a clean profile
   walk cycle — *looked at*, not merely produced. The facing bug passed every
   automated check; a human must view the PNG.
7. Before/after numbers for every work item, in a report, with the exact
   commands to reproduce.
8. No regression in existing GLB/FBX loading, embedded clip playback, timeline
   behaviour, exports, or CLI workflows.

## Working rules

- Prefer improving `src/utils/*` pure functions, which are unit-testable,
  over logic embedded in `pose-studio-shell.tsx` (3.5k lines).
- Keep the interchange **provider-neutral**. If a second provider is ever
  added, only an adapter should change.
- Every cleanup step optional and non-destructive; keep raw alongside cleaned.
- Commit in small, reviewable steps. The user signs commits with GPG and the
  key cannot be unlocked from the agent shell — **stage the work, write the
  message to a file, and ask the user to run `git commit`.** Do not bypass
  signing.
- When a result looks right, render it and *look at it* before believing it.
