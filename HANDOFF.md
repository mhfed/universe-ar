# Universe AR studio rewrite

Status: implemented and verified locally. The studio has 6 Avengers and 8 Wibu characters, two selectable modes, a camera-free demo, manual cast and PNG capture. Air Canvas and the old effect engines were removed to focus on AR.

Contract: camera is opt-in and local. Effects use the hand model. Outfits use the face and pose models and render 2D accessories and clothes. Inference uses one frame in flight on a worker, with a throttled main-thread fallback. Mode switches or camera stop cancel old sessions. The renderer expires stale overlays and uses elapsed time.

Changed: `app.js`, `index.html`, `styles.css`, `studio/{catalog,renderer,runtime,tracking,tracking-worker,vision}.js`, `test/runtime.test.js`, `public-files.mjs`, `build-dist.mjs`, `server.mjs`, `package.json`, `package-lock.json`, `README.md`. Removed `anime.js`, `arcane.js`, `arcane_webgl.js`, `cosplay.js`, `ironman.js`, `spider.js`, `thanos.js`, `thor.js`, `wolverine.js`.

Verification:
- `npm test` passed (5 regressions, including stream cleanup and simulation at 30/60/120 FPS).
- `npm run build` and `git diff --check` passed.
- `python3 -m http.server 3479 --bind 127.0.0.1 --directory dist` + `node /tmp/universe-smoke.cjs` passed. Chrome tested both rosters and modes, animated canvas, PNG, no model fetch before opt-in, all three actual assets in the worker with a fake camera, denial, shutdown, and forced worker failure on the main-thread fallback.
- `node /Users/hieuminh/.agents/skills/design-taste-frontend/scripts/lint.mjs` passed. `node /Users/hieuminh/.agents/skills/design-taste-frontend/scripts/inspect.mjs http://127.0.0.1:3478 --out /tmp/universe-inspection --widths 1440,768,390 --app --allow font-not-dealt` passed. Avenir Next/system fonts were chosen to avoid an external font fetch. Desktop, phone and costume preview screenshots inspected.
- Read-only independent review completed. Fixed the stale-overlay case it identified.

Remaining gate: verify landmark alignment, gesture sensitivity and frame pacing with a physical webcam on mobile Safari and Android Chrome before rollout. Production deployment was not run.

Rework: 4 cycles for screenshot timing, the first lint adjustment, the lint annotation fix and the final phone layout/video label adjustments. Token usage: unavailable.

## Visual realism pass

Status: integrated. A 140 KiB photo plate replaces the line mannequin in demo. Costumes now use material gradients, beveled panels, fabric grain and forehead/nose/chin anchors. Powers have emissive cores, spill and moving ember trails. Preview and camera share the effect renderer and PNG export.

Contract and limits: assets and inference remain local. Clothing is still 2D compositing with approximate lighting and no per-pixel body/hair occlusion. A separate generated armor atlas request was rejected by ImageGen, so the implemented armor is drawn in Canvas with procedurally shaded materials. Next gate for realism: one body-tracked GLB costume with PBR materials, head rotation calibration and foreground hand/hair occlusion, verified on a physical camera while turning and moving.

Changed: `studio/demo.jpg`, `studio/outfits.js`, `studio/renderer.js`, `studio/vision.js`, `server.mjs`, `styles.css`.

Verification:
- `npm test` (5), `npm run build` and `git diff --check` passed.
- `node /Users/hieuminh/.agents/skills/design-taste-frontend/scripts/lint.mjs --app` passed.
- `node /Users/hieuminh/.agents/skills/design-taste-frontend/scripts/inspect.mjs http://127.0.0.1:3481 --out /tmp/universe-realism-inspection --widths 1440,768,390 --app` passed.
- `PORT=3481 node server.mjs` + `node /tmp/universe-look-smoke.cjs` passed on Chrome. Exercised both modes for all 14 characters, animated demo, PNG, and positive MediaPipe face/shoulder/hand results from the photo fixture through a fake camera. Inspected close frames for Strange, Iron Man and mobile Gojo. A 950 ms Chrome animation sample reported 58 callbacks and changing pixels. Physical cameras and low-end phones were not run.

Rework: 3 cycles for JPEG conversion after the local ffmpeg lacked a WebP encoder, app-mode lint/color annotation, and procedural armor detail after the atlas rejection. Token usage: unavailable.

Photo generated with built-in ImageGen, then resized to JPEG. Prompt:

> A photorealistic wide 3:2 cinematic webcam portrait for an augmented reality effects demo, no costumes or effects or text added. Frame chest to just above the head, subject slightly left of center (head center at x=40%, y=32%), an adult Vietnamese man with short dark hair and plain textured black crew neck shirt, neutral focus, fully visible both shoulders, his left open hand clearly raised at the right of the image around x=67%, y=54%, anatomically correct five fingers and palm facing lens, natural one-handed pose, hand and face fairly sharp. Moody dark industrial photography studio background with lightly visible gray wall and a soft practical light far behind, real skin pores and texture, soft directional warm key from upper left, cool dark fill, skin remains clearly visible, subtle cinema grain. Contemporary handheld camera look, medium focal length with natural head and hands. Populate whole frame edge to edge, no framing lines, no panels or graphic symbols, no logos or props. This is the clean plate beneath live costume effects.

## Gojo Live pilot

Status: the local pilot runs in Universe AR. Selecting Gojo opens a combined mode with a high collar and blindfold, red/blue energy that fuses into purple, a cast animation and PNG capture. Snap Web SDK 1.22.0 integration compiles and has lifecycle tests. A Snap Developer account with Web access and an authored/published Gojo Lens is not available, so real Garment Transfer has not been run.

Contract: MediaPipe provides face, shoulders, elbows, wrists, hips and hand landmarks from the existing stream. The fallback warps an alpha cutout across a small tracked mesh and restores camera hand pixels over clothes using an approximate mask. No data leaves the local host in this path. The optional Camera Kit path replaces the base camera image with the Lens output and uses its capture target for PNG. Existing gesture controls and other characters remain usable.

Changed: `app.js`, `index.html`, `styles.css`, `studio/{gojo-geometry,gojo-outfit,gojo-power,renderer,vision,snap-config,snap-gojo}.js`, `studio/gojo-jacket.webp`, `assets/lens/gojo-reference.jpg`, `test/gojo.test.js`, `server.mjs`, `build-dist.mjs`, `build-snap.mjs`, `package.json`, `package-lock.json`, `.gitignore`, `README.md`.

Verification:
- `npm test` passed (10 tests). New cases exercise the texture affine transform, power fusion, shared Snap source, cleanup on abort and rejected Lens.
- `npm run build`, `npm run build:snap`, `node /Users/hieuminh/.agents/skills/design-taste-frontend/scripts/lint.mjs --app` and `git diff --check` passed.
- `PORT=3482 node server.mjs` + `node /tmp/universe-gojo-live.cjs` passed in Chrome with the portrait-backed fake webcam. Positive face/body/hand results occurred together, PNG downloaded, local requests stayed on localhost, switching to Tanjiro restored the regular mode, and camera shutdown cleared the stream. Inspected desktop demo, live fixture, cast frame and mobile demo screenshots. No physical webcam, iOS/Android performance or real Snap Lens validation was performed.
- One bounded independent code review found no high-impact integration issues.

Next gate: create and publish the Gojo Garment Transfer Lens to a Snap staging group, connect the three Web values from the portal, then test cross-arm, rotation and light-change motion on physical iPhone and Android devices. The local mesh still shows some seams with raised arms.

Rework: 3 cycles for the local Playwright package becoming available, the first shoulder/collar join correction, and the second correction to prevent a folded upper band and reversed hand mask. Token usage: unavailable.

Built-in ImageGen asset prompts:

- `assets/lens/gojo-reference.jpg`: Photoreal upper-body clothing reference for an augmented reality garment transfer tool. One adult East Asian male model in a front-facing static fitting pose, covered by a single understated dark ink navy Japanese school uniform cosplay jacket, exactly centered. Important jacket design: tall folded stand collar zipped closed, asymmetric concealed center placket, subtle diagonal chest seam, relaxed shoulder, straight long set-in sleeves, hip length, no pockets on chest, matte expensive tightly woven wool twill with realistic creases and defined seam structure. No logos, illustrations, text, graphics or blindfold. Both arms hang naturally slightly apart at the sides without obscuring any part of the jacket, all jacket from neck to hem fully visible, full upper body including wrists and waist, waist-level framing on 4:5 landscape-friendly crop. Flat light grey background contrasting with the garment, evenly lit neutral softbox with true black detail, no stylistic grading, realistic product reference, clean studio.
- `studio/gojo-jacket.webp`: Transparent-background photorealistic ghost-mannequin front orthographic garment product cutout for a webcam fashion overlay. One matte deep ink-navy heavyweight wool-twill Japanese school uniform cosplay jacket, high structured closed stand collar, asymmetric hidden placket across the front, realistic faint vertical weave, fine stitching, subtle tailored folds along upper sleeves and shoulders. Neutral softbox illumination with readable dark details and deep shadowing in folds. Exact symmetric A-pose sleeve layout: shoulders LEVEL and horizontally aligned, sleeves extend diagonally down and out from each shoulder, elbows very slightly bent, cuffs end around height of the bottom hem or slightly lower. The neckline to full hem and both full sleeves are visible and self-contained, all margins at least 8%. No person, face, hands, mannequin parts, stand, text, logos, accessories, decorative outline, background or cast shadow. This is the garment alone hollow inside, exported on a true transparent alpha background. Square image, garment fills the frame.

## Hư Thức Tử visual pass

Status: implemented for Gojo Live and Gojo's effects-only view. The new WebGL tile samples the local scene to refract and shade the camera around a dark violet volume. Two hands blend smoothly into the purple core. Cast compresses into the palm, releases a moving core with a broken filament trail, then dissipates. The existing Canvas renderer composites the result into PNG and uses a simpler effect if WebGL is unavailable. The preview, camera and garment assets were reused.

Changed: `studio/gojo-shader.js`, `studio/gojo-power.js`, `studio/renderer.js`, `test/gojo-vfx.test.js`, `HANDOFF.md`.

Verification:
- `npm test` passed (12, including cast timing and both launch directions).
- `npm run build`, `git diff --check`, and `node /Users/hieuminh/.agents/skills/design-taste-frontend/scripts/lint.mjs --app` passed.
- `PORT=3483 node server.mjs` + `node /tmp/universe-plasma-qa.cjs` passed. The harness checks actual shader renders and GL errors, caption/controls at phone width, positive face/body/hand data on Chrome fake media, PNG capture, released camera and the forced Canvas fallback with reduced motion.
- Inspected demo, desktop and mobile compositions and the live fixture during launch. Played the local browser recording at 1x (49 displayed frames), then transcoded it with `ffmpeg -i /tmp/gojo-plasma-preview.webm -vf 'fps=30,pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p' -movflags +faststart /tmp/gojo-hu-thuc-tu.mp4`. `ffprobe` verified 980×592 at 30 fps and 49 frames. These are preview playback values, not a physical device performance result.

Remaining gate: verify moving hands, auto-exposure and thermal performance on representative physical phones. The optional Snap Lens still requires staging access and a published lens. No live camera or deployment was used.

Rework: 2 cycles. The first visual pass needed stronger core definition and less uniform cast trails. The first clip export inherited the phone viewport and an odd height, so the harness now waits for the desktop Canvas resize and exports even dimensions. Token usage: unavailable.

## FASHN webcam capture

Status: implemented and exercised with real FASHN VTON v1.5 output on Apple Metal. Gojo freezes one unmirrored webcam frame, releases the stream, shows progress, then mirrors the generated image into the stage. Hư Thức Tử uses a recent hand position if available and can still be cast manually. PNG export and retake remain available after the result.

Contract: local Node uses one persistent Python process with one job at a time and expiring in-memory results. Cloudflare Worker uses the same photo/status/result contract with FASHN Try-On v1.6 quality mode, a server-side key, a per-IP rate limit, signed job identifiers and no HTTP caching. Health reports unavailable until the secret is set. Live video stays in the browser.

Changed: `app.js`, `index.html`, `styles.css`, `studio/{try-on,renderer,vision,gojo-outfit}.js`, `studio/gojo-preview.webp`, `backend/{fashn-local,try-on,worker}.mjs`, `backend/fashn_worker.py`, `server.mjs`, `build-dist.mjs`, `wrangler.jsonc`, `test/fashn-{jobs,worker}.test.js`, `.gitignore`, `README.md`.

Verification:
- `npm test` (17 tests), `npm run build`, `npx wrangler deploy --dry-run` and `git diff --cached --check` passed.
- `PORT=3462 node server.mjs` and `node /tmp/universe-fashn-browser.cjs` passed on Chrome with a portrait-backed fake webcam feeding genuine local FASHN inference. Verified camera release on capture, completed PNG, cast, export and retake. `GOJO_SMOKE=resume node /tmp/universe-fashn-browser.cjs` rechecked the final scene against the real job output. `GOJO_SMOKE=fixture node /tmp/universe-fashn-browser.cjs` passed using a recorded response. Reviewed desktop and phone screenshots.
- `node /Users/hieuminh/.agents/skills/design-taste-frontend/scripts/lint.mjs --app` and `node /Users/hieuminh/.agents/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:3462 --out /tmp/universe-fashn-inspection --widths 1440,768,390 --app` passed. Inspected the screenshots.
- `npx wrangler secret list` succeeded with an empty list. Live Cloudflare-to-FASHN inference and physical phone camera checks were not run.

Release gate: commit and push main, then run `npm run deploy` and verify the public site and health endpoint over HTTPS. Set `FASHN_API_KEY` with Wrangler to enable online generation, then verify on the live API with a sample photo.

Rework: 3 cycles for reading sampling progress from tqdm metadata, correcting the saved hand-coordinate shape, and verifying the Mac patch installation commands. Token usage: unavailable.

## Doctor Strange WebGL restoration

Status: restored the shader sources and visual behaviors from `3d34dc5`. Strange again renders rotating mandalas, welding sparks, fist vortices, two-hand Grand Seal and prism shockwaves in the current studio.

Contract: the existing hand tracker feeds screen-space landmarks to Strange. F or the cast button launches a shockwave, hold or G controls Grand Seal, and keys 1–4 or a pinch select the original four elements. A dedicated WebGL2 canvas composites above the scene and is included in PNG exports. The simpler effect is the fallback for unavailable WebGL2 and reduced motion. The scope is the original visual effects and gestures.

Changed: `app.js`, `index.html`, `studio/{renderer,arcane,arcane-webgl}.js`, `HANDOFF.md`.

Verification:
- `npm test` (17), `npm run build` and `git diff --check` passed. Compared all six GLSL source strings against `3d34dc5:arcane_webgl.js` for exact equality.
- `node /tmp/universe-arcane-qa.cjs` passed on Chrome against localhost. Checked WebGL rendering, desktop and 390 px screenshots, mouse hold, element switching, PNG, real MediaPipe landmarks from a fake webcam, reduced motion and Gojo mode. The desktop recording had 120 WebGL frames in 1.99 seconds. Chrome played 59 video frames at 1×, and `ffprobe` reported 30 fps for the recording.
- `node /tmp/universe-arcane-two-hands.cjs` passed with controlled hand landmarks. Verified two-hand fusion, pinch cycling and G toggle.
- `GOJO_SMOKE=fixture node /tmp/universe-fashn-strange-regression.cjs` passed with a recorded FASHN response. Physical camera and device performance checks were not run.

Release gate: commit, push main, run `npm run deploy`, then repeat the Strange browser smoke on the public URL.

Rework: 0 cycles. Token usage: unavailable.

## Doctor Strange render performance

Status: optimized the existing effects pipeline. The HDR scene shader runs inside the visible hand and wave bounds, with full-stage rendering for Grand Seal god rays. Wave geometry is calculated once per frame. Grand Seal skips filament calculations outside the mandala. Offscreen sparks keep their physics and skip instance uploads. The Strange stage pauses outside the viewport and draws a fresh frame for PNG export.

Changed: `studio/arcane-webgl.js`, `studio/arcane.js`, `studio/renderer.js`, `HANDOFF.md`.

Verification:
- `npm test` (17), `npm run build` and `git diff --check` passed.
- `node /tmp/universe-arcane-perf.cjs` and `SOFTWARE_GL=1 node /tmp/universe-arcane-perf.cjs` compared deterministic inputs with commit `7270714`. Median SwiftShader milliseconds per frame were 62.03 to 26.74 for the desktop shield, 8.49 to 4.59 for the phone-sized shield, 69.39 to 47.58 for Grand Seal, and 67.68 to 42.26 for waves. On Apple M1 Pro, desktop shield was 0.344 to 0.294 ms and the smaller shield was 0.200 to 0.211 ms in this synthetic test. The shield and Grand Seal fixtures matched pixel for pixel, and waves differed by at most one channel level.
- `RGBM=1 node /tmp/universe-arcane-perf.cjs` passed the forced RGBA8 test. The moved shield and sparks outside the clipping region matched pixel for pixel. Wave channels differed by at most two levels with a mean absolute difference below 0.001.
- `CHECK_OFFSCREEN=1 node /tmp/universe-arcane-qa.cjs` passed on Chrome. Checked camera fixture, PNG, offscreen pause with one-frame export, viewport resume, reduced motion and the Gojo switch. Inspected desktop and mobile screenshots. Chrome played 60 frames at 1× in the two-second recording.
- `node /tmp/universe-arcane-two-hands.cjs` and `GOJO_SMOKE=fixture node /tmp/universe-fashn-strange-regression.cjs` passed. Physical phone timing and live FASHN inference were not measured in this phase.

Release gate: push main, deploy with `npm run deploy` and repeat the offscreen browser smoke over HTTPS.

Rework: 1 cycle to force a GPU readback in the benchmark after the first timing method returned zero. Token usage: unavailable.

## Doctor Strange one-hand casts

Status: implemented a forward palm push and four directional swipes. The forward cast expands from the palm with a hot front and secondary ring. Horizontal swipes throw a curved flame front and vertical swipes throw a narrower rising or descending pulse. The nearby shield briefly dims as the cast releases.

Contract: a gesture consumes fresh MediaPipe samples in mirrored stage coordinates. Forward uses growth across both palm axes with limited planar travel. Swipes use dominant-axis displacement, speed and a stable palm size. Open fingers, retraction, freshness and cooldown distinguish casts from shield poses, pinch and jitter. F casts forward and Shift + arrow keys preview a direction. Casts share the HDR bloom pass and clipped bounds. The two-hand Grand Seal and its original waves remain available.

Changed: `app.js`, `index.html`, `studio/{strange-gesture,arcane,arcane-webgl,renderer}.js`, `test/strange-gesture.test.js`, `HANDOFF.md`.

Verification:
- `npm test` (23), `npm run build` and `git diff --check` passed.
- `node /tmp/universe-strange-casts.cjs` verified all five gesture directions with deterministic landmarks in Chrome, plus keyboard previews, mobile layout, export and Gojo. The 3.33 s clip rendered 201 WebGL frames and played 101 video frames at 1×.
- `REAL_TRACKING=1 node /tmp/universe-strange-casts.cjs` passed with real MediaPipe on the zooming synthetic webcam fixture. The same command with `REAL_TRACKING_DIRECTION=left`, `right`, `up` and `down` passed on corresponding moving fixtures. Inspected forward, horizontal and vertical frames. Physical webcams were not exercised.
- `node /tmp/universe-strange-casts-perf.cjs` compared the existing shield, Grand Seal and wave frames with `83276f4`. They matched pixel for pixel with the new casts idle. `CHECK_OFFSCREEN=1 node /tmp/universe-arcane-qa.cjs` and `node /tmp/universe-arcane-two-hands.cjs` passed.
- `GOJO_SMOKE=fixture node /tmp/universe-fashn-strange-regression.cjs` passed with recorded FASHN output.

Release gate: commit, push main, run `npm run deploy` and repeat the five-direction smoke over HTTPS.

Rework: 3 cycles for push rearming after retraction, keeping directional heads visible near frame edges, and reducing shield glow during release. Token usage: unavailable.

## Doctor Strange cast power and light spill

Status: cast size, brightness, spark count and duration respond to hand speed. Forward casts use the rate of apparent palm growth and offer a longer window for gentle pushes. Directional casts use normalized screen-space velocity. The original manual keys use a fixed medium power.

Contract: gesture speed is measured on video sample timestamps. A 275 ms colored flash follows local face and casting-hand anchors, with distance falloff and a screen blend that preserves webcam detail. The optional face landmark model loads when Strange requests it and samples no more than once per 175 ms. The same lighting layer is composited into saved PNGs and is hidden between casts.

Changed: `app.js`, `index.html`, `styles.css`, `studio/{arcane,renderer,strange-gesture,strange-light,tracking,tracking-worker,vision}.js`, `test/strange-gesture.test.js`, `HANDOFF.md`.

Verification:
- `npm test` (25), `npm run build` and `git diff --check` passed.
- `node /tmp/universe-strange-power-qa.cjs` passed in Chrome. With the same displacement, gentle and fast casts reached 54.9 and 93.3 px after approximately 165 ms. The face and palm regions both received a stronger light pulse, the far corner received none, and PNG export and pulse expiry passed. Inspected both PNGs.
- `REAL_TRACKING=1 node /tmp/universe-strange-power-qa.cjs` passed with genuine MediaPipe face and hand landmarks on a moving webcam fixture. Actual room lighting and physical webcams were not exercised.
- `node /tmp/universe-strange-casts.cjs` passed all five directions with the lighting layer in its recording, plus keyboard, mobile, PNG and the Gojo switch. Chrome played all 101 frames at 1×. `CHECK_OFFSCREEN=1 node /tmp/universe-arcane-qa.cjs`, `node /tmp/universe-arcane-two-hands.cjs`, and `GOJO_SMOKE=fixture node /tmp/universe-fashn-strange-regression.cjs` passed.

Release gate: commit, push main, run `npm run deploy`, then repeat the gentle and strong camera smoke over HTTPS.

Rework: 1 cycle to separate wave travel from fade duration and make the size difference visible at equal elapsed time. Token usage: unavailable.
