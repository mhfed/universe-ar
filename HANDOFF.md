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
