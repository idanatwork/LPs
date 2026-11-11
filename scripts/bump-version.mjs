import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const root = new URL("..", import.meta.url).pathname;
const versionFile = join(root, "tefila/version.json");
const current = JSON.parse(readFileSync(versionFile, "utf8"));
const next = process.argv[2] || String(Number(current.v) + 1);
writeFileSync(versionFile, JSON.stringify({ v: String(next) }, null, 2) + "\n");

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (/\.(html|mjs|js)$/.test(name) && !path.endsWith("bump-version.mjs")) out.push(path);
  }
  return out;
}

const meta = `<meta name="tefila-build" content="${next}">`;
for (const path of walk(root, [])) {
  let text = readFileSync(path, "utf8");
  const updated = text.replace(/\?v=\d+/g, "?v=" + next);
  let nextText = updated;
  if (path.endsWith(".html")) {
    if (/name="tefila-build"/.test(nextText)) {
      nextText = nextText.replace(/<meta name="tefila-build" content="[^"]*">/, meta);
    } else if (nextText.includes("<head>")) {
      nextText = nextText.replace("<head>", "<head>\n" + meta);
    }
  }
  if (nextText !== text) {
    writeFileSync(path, nextText);
    console.log("updated", path.slice(root.length));
  }
}
console.log("version", next);
