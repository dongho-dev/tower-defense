import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const assets = [
  "assets/field/rift-deck-game.webp",
  "assets/nexus-horizon-game.webp",
  ...["pulse", "scatter", "rail", "arc", "flak", "beam", "cryo", "nova"].map(
    (name) => `assets/towers/${name}-game.webp`
  ),
  ...["drone", "skirmisher", "armor", "titan"].map(
    (name) => `assets/enemies/${name}-game.webp`
  )
];

let totalBytes = 0;
for (const relativePath of assets) {
  const url = new URL(relativePath, import.meta.url);
  const metadata = await stat(url);
  assert.ok(metadata.size > 1024, `${relativePath} should contain a real image`);
  totalBytes += metadata.size;

  const bytes = await readFile(url);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${relativePath} should be WebP`);
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${relativePath} should be WebP`);
}

assert.ok(totalBytes < 1_500_000, "runtime image payload should stay below 1.5 MB");

const gameSource = await readFile(new URL("game.mjs", import.meta.url), "utf8");
assert.doesNotMatch(gameSource, /from\s+["']three["']/i, "remake runtime must not load Three.js");
assert.match(gameSource, /canvas2d-single-pass/, "diagnostics should expose the single-pass renderer");
assert.match(gameSource, /projectBoardPoint/, "the battlefield should use the lightweight isometric projection");
assert.match(gameSource, /advanceTowerMotion/, "tower tracking and idle motion should update in simulation");
assert.match(gameSource, /definition\.motion === "turret"/, "directional towers should render split rotating heads");
assert.match(gameSource, /tower\.recoil/, "tower fire should drive visible recoil");

console.log(JSON.stringify({
  assets: assets.length,
  totalBytes,
  totalMiB: Number((totalBytes / 1024 / 1024).toFixed(3)),
  renderer: "canvas2d-single-pass"
}));
