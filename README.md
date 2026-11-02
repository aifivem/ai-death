# ai-death

Death, respawn at hospitals, EMS revive and treatment.

Part of [AI Core](https://aifivem.com): a TypeScript FiveM framework where every script is configured in one in-game admin panel, and ESX, QBCore and Qbox scripts run unchanged.

## Install

The [AI Core txAdmin recipe](https://github.com/aifivem/aicore-server) installs it with everything it needs. By hand: unzip `ai-death.zip` from the [latest release](https://github.com/aifivem/ai-death/releases/latest) into `resources/[ai]/` and add `ensure ai-death` to `server.cfg` after `ensure ai-core`. It needs `ai-core`. The zip is built and ready, so no build tools are needed to run it; its source builds with `bun install && bun run build` in the folder. `ai-death-runtime.zip` holds only the files the server runs, without the source.

Settings live in the in-game admin panel (`/aiadmin`), not in config files.

## Documentation

[aifivem.com/docs](https://aifivem.com/docs)

## Credits

AI Core learned from and builds on the open-source FiveM community (ESX, QBCore, Qbox, Overextended and many script authors): see [CREDITS.md](https://github.com/aifivem/aicore-server/blob/main/CREDITS.md).

## License

GPL-3.0-only.
