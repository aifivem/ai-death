# ai-death

Death and hospitals: a downed character waits for a medic (medikit revive) or, after a timer, wakes up at the nearest hospital for a fee; paid check-in treatment when few medics are on duty. Depends on ai-core (metadata, money, duty counts, prompts, admin panel); the active inventory through ai-core's inventory layer (lib `inventory`) (medikit, optional clearing).

## Decisions

- GTA's own health refill is a panel switch (`healthRegen`, default off, owner decision): the client sets `SetPlayerHealthRechargeMultiplier` to 0 or 1 at start, on every ped change (the multiplier resets when a clothing script swaps the ped) and on a settings change.
- Deaths come from ai-core's `CORE.playerDiedEvent` (FXServer's `onPedDeath`; no client health watch). Down state: server memory, ai-core metadata `isdead` (a reconnect while down comes back down, QB's key) and the player state bag `dead`.
- While down the ped stays dead (the game blocks control, no spawnmanager respawns it); the countdown runs on the client clock and ai-core's prompt offers the hospital when it ends. The server checks the time again.
- Revive is in place (`NetworkResurrectLocalPlayer` at the ped's position); respawn is at the nearest hospital's wake-up spot. A fee nobody can pay is waived.
- The medikit: an on-duty medic revives the closest downed player within 3 m; anyone else heals themselves.
- Down state on load follows lib `onCharacter` (also the players already in the game after a restart of ai-death: a stored `isdead` puts them down again); EMS counts and duty come from lib `online`.
- Hospital blips: per hospital `blip` switch plus a `blipStyle` (panel `blip` widget).

## Contracts

- Events: `resource/common/death.ts`. Exports `Revive(source)`, `IsDead(source)`, `Heal(source)` (typed in `@aicore-fivem/shared` `AiDeathServerExports`) (`qbx_medical` `Revive` / `IsDead` too); client event `hospital:client:Revive` from the server revives (QB scripts, admin menus).
- `Heal` on a downed player gets the ped up but keeps the down state: callers `Revive` first (`IsDead`).

## Entry points

- Server: down state, respawn, treatment, medikit `resource/server/index.ts`; panel `server/schema.ts`.
- Client: down screen, revive, hospitals (lib `RecordObjects`: an edited hospital rebuilds only its check-in point and blip, the treatment price setting all) `resource/client/index.ts`.
- NUI: the down overlay `web/src/App.tsx` (`bun run webdev`, `?ready=1`).
