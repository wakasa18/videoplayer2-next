import { cp, mkdir, rm } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

const projectRoot = process.cwd();
const outputRoot = resolve(projectRoot, "..");
const output = join(outputRoot, `${basename(projectRoot)}-clean-release`);

const excludedDirectories = new Set([
  ".git",
  ".next",
  ".vercel",
  "node_modules",
  "coverage",
  "out",
  "build",
]);
const excludedFiles = new Set([
  "tsconfig.tsbuildinfo",
  "npm-debug.log",
  "yarn-error.log",
]);

await rm(output, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

await cp(projectRoot, output, {
  recursive: true,
  filter(source) {
    const path = relative(projectRoot, source);
    if (!path) return true;
    const segments = path.split(sep);
    if (segments.some((segment) => excludedDirectories.has(segment))) return false;

    const name = basename(source);
    if (excludedFiles.has(name)) return false;
    if (name.startsWith(".env") && name !== ".env.example") return false;
    if (/\.(?:pem|key|p12|pfx)$/i.test(name)) return false;
    return true;
  },
});

console.log(`Clean release created at: ${output}`);
console.log("Review the folder, then compress only that generated folder.");
