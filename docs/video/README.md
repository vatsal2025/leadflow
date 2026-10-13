# Product walkthrough

[Watch on Google Drive](https://drive.google.com/file/d/1zipQsRm-RT7pSH17aVuU-XLjd_XPhM_f/view). This link opens the video viewer; press Play to stream without downloading or signing in. The MP4, captions, and poster are also available as optional [GitHub release downloads](https://github.com/vatsal2025/leadflow/releases/tag/v1.1.0).

A narrated English walkthrough covering the required lead list, creation and timeline flows; search, filters, reminders, and persistence; pipeline, priorities, editable contacts, activity types, archive/restore, calendar and CSV downloads; mobile behavior; and the repository's setup, Docker, seed, and verification deliverables.

The finished video uses actual browser recordings from an isolated demo database, synthetic English narration, chapter labels, captions, and a branded opening and closing. It does not record passwords or modify the user's existing local records.

## Reproduce the media

The media toolchain is separate from the application's dependencies. From the repository root, install `scripts/video/requirements.txt` into `.tools/media-deps` with pip's `--target` option. Install frontend dependencies and Playwright Chromium using the main README. The renderer currently uses Windows Segoe UI font files; adjust its font paths for another platform.

1. Run `python scripts/video/narrate.py` to produce the scene audio and timing metadata from `storyboard.json`. Speech synthesis requires network access. The script caches narration by text.
2. Start a fresh isolated API with `python scripts/e2e_api.py`, and the built frontend with `npm run start` from `frontend`. Stop other processes on ports 3000/8000 first. This creates separate demo data, never the existing local database.
3. Run `node scripts/video/capture.mjs`. The default recording login matches the isolated test API. To use a deliberately prepared demonstration deployment, supply `LEADFLOW_URL` and `LEADFLOW_PASSWORD` privately. The script creates and edits a fictional Sofia Bennett lead; use a fresh demo database for each complete recording.
4. Run `python scripts/video/render.py`. It exports a 1920×1080, 30fps H.264/AAC MP4, an SRT caption file, a poster, and a verification record under ignored `deliverables/`. It performs a full video decode and checks that the duration stays between two and three minutes.

`deliverables/` and temporary recording assets are excluded from source control. Publish only the intended MP4, captions, and poster as release assets; never upload private deployment access files.
