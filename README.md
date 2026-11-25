# Universe AR — Avengers & Wibu 2-Hand AI Studio

Real-time WebGL2 HDR & MediaPipe AI Augmented Reality studio right in the browser (Desktop & Mobile).

## Live Demo
- https://ai-hero-hand-studio.nmhieu04091999.workers.dev

## Features

### 1. Avengers Universe (Marvel 2-Hand AI)
- **Doctor Strange (`arcane.js` + `arcane_webgl.js`)**: Photorealistic WebGL2 HDR FBM fire, 2,800 ballistic welding sparks, Dual-Kawase optical bloom, ACES Filmic tone mapping, 2-hand Full-Screen Grand Mandala fusion & single-color 3D Chưởng shockwaves, plus `👌` pinch quick-switch across 4 elements.
- **Iron Man (`ironman.js`)**: Repulsor blasts, Red Laser, and Unibeam 400%.
- **Wolverine (`wolverine.js`)**: Fist-triggered Adamantium & Hot Berserker claws with X-Slash sparks.
- **Thor (`thor.js`)**: Mjolnir / Stormbreaker summon, throw, and Ragnarok sky lightning.
- **Thanos (`thanos.js`)**: 6 Infinity Stones meteor pull & Infinity Snap dusting effect.
- **Spider-Man (`spider.js`)**: Elastic web-shooting, Miles Morales Venom electric webs, web bombs, and Mysterio drones.
- **Air Canvas 2-Hand (`app.js`)**: Dual-hand air drawing with pinch detection and PNG snapshot export.

### 2. Wibu Universe (Anime AR Cosplay & 2-Hand Techniques)
- **Real-Time AR Cosplay (`cosplay.js`)**: Powered by MediaPipe **FaceLandmarker (478 pts + Iris)** + **PoseLandmarker (33 body pts)** with live ambient room-lighting sync, eyelid-clipped anime eyes, and torso garments:
  - **Akatsuki (Itachi)**: High-collar red-lined cloud cloak, curved yaw-reactive steel Konoha rogue headband, Sharingan / Mangekyou eyes.
  - **Gojo Satoru**: Jujutsu uniform with golden swirl button, Six Eyes, round dark glasses / blindfold toggle.
  - **Tanjiro (Demon Slayer)**: Checkered green/black Haori, skin-blended forehead mark, pendulum-physics Hanafuda earrings.
  - **Kaneki (Tokyo Ghoul)**: Jaw-conforming leather zipper mask that reacts when you open your mouth + Kakugan eye.
  - **Sung Jinwoo (Solo Leveling)**: Shadow Monarch dark coat + glowing cobalt eyes with animated eye-corner flame trails.
- **Anime 2-Hand Techniques (`anime.js`)**:
  - **Gojo Satoru**: Lapse Blue (Left), Reversal Red (Right), 2-hand Hollow Purple fusion, Unlimited Void Domain Expansion.
  - **Ryomen Sukuna**: Hand-swipe Dismantle/Cleave slashes & Malevolent Shrine domain.
  - **Sung Jinwoo**: Shadow Monarch aura & upward hand-lift **ARISE!** burst.
  - **Son Goku**: Super Saiyan / SSJ Blue / Ultra Instinct aura & 2-hand Kamehameha.
  - **Naruto**: Rasengan (Left), Chidori (Right), and 2-hand Rasenshuriken.

## Local Development & Deployment

```bash
npm install
npm start        # http://localhost:3456
npm run build    # Build clean static ./dist bundle
npm run deploy   # Build & deploy to Cloudflare via Wrangler
```
