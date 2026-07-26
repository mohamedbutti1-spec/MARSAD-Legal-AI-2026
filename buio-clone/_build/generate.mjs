#!/usr/bin/env node
/**
 * Dev-time generator only. Stitches shared head/header/footer partials
 * around each page's body content and writes plain, dependency-free
 * static HTML files to buio-clone/*.html. The generated output requires
 * no build step to view — this script just avoids hand-duplicating the
 * header/footer markup across 16 files.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const partialsDir = path.join(__dirname, "partials");
const pagesDir = path.join(__dirname, "pages");

const head = readFileSync(path.join(partialsDir, "head.html"), "utf8");
const header = readFileSync(path.join(partialsDir, "header.html"), "utf8");
const footer = readFileSync(path.join(partialsDir, "footer.html"), "utf8");

const pageFiles = readdirSync(pagesDir).filter((f) => f.endsWith(".html"));

for (const file of pageFiles) {
  const raw = readFileSync(path.join(pagesDir, file), "utf8");
  const metaMatch = raw.match(/^<!--META\s*([\s\S]*?)\s*-->\s*/);
  if (!metaMatch) {
    throw new Error(`${file}: missing leading <!--META {...}--> block`);
  }
  const meta = JSON.parse(metaMatch[1]);
  const body = raw.slice(metaMatch[0].length);

  const pageHead = head
    .replace("{{TITLE}}", meta.title)
    .replace("{{DESCRIPTION}}", meta.description);

  const bodyClass = meta.bodyClass ? ` class="${meta.bodyClass}"` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
${pageHead}
</head>
<body${bodyClass}>
${header}
${body}
${footer}
</body>
</html>
`;

  writeFileSync(path.join(root, file), html, "utf8");
  console.log(`built ${file}`);
}
