<div align="center">
  <img src="/assets/banner.png" alt="Moodist Logo Banner" />
  <h2>Moodist 🌲</h2>
  <p>Ambient sounds for focus and calm.</p>
  <p>A fork of <a href="https://github.com/remvze/moodist">Moodist</a> by <a href="https://github.com/remvze">remvze</a>, with a Morning Routine mode. Sounds and the mixer are Moodist's.</p>
  <a href="https://moodist.mvze.net">Visit <strong>Moodist</strong></a> | <a href="https://buymeacoffee.com/remvze">Buy Me a Coffee</a>
  <br/><br/>
  <div>
    <a href="https://gitviews.com/">
      <img src="https://gitviews.com/repo/remvze/moodist.svg" alt="Repo Views" />
    </a>
  </div>
</div>

---

## Features

- 84 curated ambient sounds you can layer into custom soundscapes.
- Smooth fade transitions on play/stop and sleep timer shutdown.
- Shareable mixes via URL with one-click import.
- Presets to save, rename, delete, and instantly reapply mixes.
- Built-in binaural beat and isochronic tone generators.
- Built-in breathing exercise, Pomodoro, countdown, todo, and notepad tools.
- Installable PWA with offline caching.
- Open-source and self-hostable with Docker.
- Morning Routine: a hands-off Pacific-time schedule that crossfades Moodist mixes.
- And much more!

## Morning Routine

Open `/routine` from the home page (**Morning Routine**) or the mixer menu. Tap **Start** once and leave it running. When the sound changes, move on to the next block. **Preview** plays about 18 seconds of each block. The clock is America/Los_Angeles time.

The page lists today's blocks in a quiet side panel (under the controls on a narrow screen). Times follow Auto / Weekday / Weekend and any Delay or Skip for today. The current block is highlighted, earlier blocks are dimmed, and a skipped block is struck through.

Weekday:

- 8:00–8:15 Wake up & Meditation (singing bowl and wind)
- 8:15–9:40 Daily Briefing (cafe)
- 9:40–10:15 Spanish class with Grok Bot Professor Laura (light rain)
- 10:15–10:25 Break (birds and river)
- 10:25–11:00 ACSM with Grok Bot Professor Livy (brown noise)
- 11:00 Done. Nice work.

Weekend drops meditation, so Daily Briefing starts at 8:00. Later blocks, including the 11:00 end, stay put.

**Delay** (5, 10, or 15 minutes) lengthens the current block and shortens the next ones so the day still ends at 11:00. No block is squeezed under 5 minutes. **Skip** crossfades to the next block immediately; that block keeps the leftover time. Both ask for a reason (Overslept, Tired, Something came up, Low energy, or your own words). The last block, ACSM, cannot be delayed or skipped. Adjustments apply to today only. **Log** keeps them newest first, and **Export** copies them as Markdown. The screen stays awake while the routine is running.

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:4321/routine`. `pnpm test` covers the schedule rules. `pnpm build` writes a static `dist/` folder (Astro's default), so the site can be hosted on Vercel with the Astro preset and no environment variables, or on GitHub Pages by publishing `dist`. If Pages serves the repo from a subpath, set Astro `site` and `base` to that path. No tokens are required.

## Self-Hosting

### 1. Run with Docker

```bash
docker run -d \
  --name moodist \
  -p 8080:8080 \
  ghcr.io/remvze/moodist:latest
```

The open:

```
http://localhost:8080
```

### 2. Run with Docker Compose

A `docker-compose.yml` is included at the project root.

Run:

```bash
docker compose up -d
```

Then open:

```
http://localhost:8080
```

## Contributing

Please check [CONTRIBUTING.md](CONTRIBUTING.md) file.

## Support Moodist

Please give a star if you liked this project.

You can also [Buy Me a Coffee](https://buymeacoffee.com/remvze) to help me maintain Moodist.

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Third-Party Assets

Some sounds used in this project are sourced from third-party providers and **are subject to different licenses**:

- Sounds licensed under the **Pixabay Content License**: [Pixabay Content License](https://pixabay.com/service/license-summary/)
- Sounds licensed under **CC0**: [Creative Commons Zero License](https://creativecommons.org/publicdomain/zero/1.0/)
