const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const svgPath = path.join(publicDir, "icon.svg");

async function main() {
  if (!fs.existsSync(svgPath)) {
    console.error("Missing public/icon.svg");
    process.exit(1);
  }
  const svg = fs.readFileSync(svgPath);

  await sharp(svg).resize(192, 192).png().toFile(path.join(publicDir, "icon-192.png"));
  await sharp(svg).resize(512, 512).png().toFile(path.join(publicDir, "icon-512.png"));
  await sharp(svg).resize(180, 180).png().toFile(path.join(publicDir, "apple-touch-icon.png"));

  console.log("Generated icon-192.png, icon-512.png, apple-touch-icon.png from icon.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
