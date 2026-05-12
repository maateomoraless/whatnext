/**
 * Regenera public/icon.svg vía scripts/build-wn-icon-svg.py (fonttools + paths reales).
 * Requiere: python3 y `pip install fonttools`
 */
const { spawnSync } = require("child_process");
const path = require("path");

const script = path.join(__dirname, "build-wn-icon-svg.py");
const r = spawnSync("python3", [script], { stdio: "inherit", cwd: path.join(__dirname, "..") });
if (r.error) {
  if (r.error.code === "ENOENT") {
    console.warn("python3 no encontrado; se mantiene public/icon.svg");
    process.exit(0);
  }
  console.error(r.error.message);
  process.exit(1);
}
if (r.status !== 0) {
  console.warn(`build-wn-icon-svg.py salió con código ${r.status}; se mantiene public/icon.svg`);
  process.exit(0);
}
process.exit(0);
