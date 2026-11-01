import { onCharacter } from "@aicore-fivem/lib/server";
import { DEAD_META } from "common/death";
import { core } from "./core";
import { downed } from "./downed";

// A character stored down comes back down (also the players already in the game after a restart of this resource).
onCharacter({
  loaded: (source) => {
    if (core.GetMeta(source, DEAD_META) === true)
      setTimeout(() => downed.down(source), 2000);
  },
  unloaded: (source) => downed.drop(source),
});
