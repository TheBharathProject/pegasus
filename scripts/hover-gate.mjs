/**
 * hover-gate.mjs
 *
 * Wraps every :hover rule block in globals.css inside @media (hover: hover) { ... }
 * Handles rules already inside other @media blocks by adding nested @media
 * (nested @media is valid CSS and supported in all modern browsers).
 *
 * Usage: node scripts/hover-gate.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const cssPath = resolve(process.cwd(), "app/globals.css");
const original = readFileSync(cssPath, "utf8");
const originalHoverCount = (original.match(/:hover/g) || []).length;
console.log(`Original :hover count: ${originalHoverCount}`);

const lines = original.split("\n");
const n = lines.length;

// ---- Build brace depth and @media context arrays ----

// For each line, track:
//   - braceDepthBefore[i]: brace depth before processing line i
//   - isInsideMediaBlock[i]: true if line i is inside any @media block
// We also need to know which @media block contains each line so we can
// avoid double-wrapping.

// Simple tokenizer: count { and } per line, track @media opens
const braceDepthBefore = new Array(n).fill(0);
const mediaStack = []; // stack of { query, depth } for currently open @media blocks

let depth = 0;
for (let i = 0; i < n; i++) {
  braceDepthBefore[i] = depth;
  const line = lines[i];

  // Count braces
  for (const ch of line) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
}

// ---- Find all :hover rule blocks ----
// A "hover rule block" is a CSS rule whose selector contains ":hover".
// Structure:
//   .selector:hover,           <- selector line(s)
//   .other:hover {             <- opening brace
//     property: value;
//   }                          <- closing brace
//
// We scan forward. When we encounter a line with ":hover" outside a comment,
// we trace back to find the full selector start, and forward to find the
// matching close brace.

function isInsideComment(allLines, lineIdx) {
  // Very rough: check if the line is between /* and */
  // (Doesn't handle all edge cases but good enough for this file)
  const lineContent = allLines[lineIdx].trim();
  return lineContent.startsWith("*") || lineContent.startsWith("/*") || lineContent.startsWith("//");
}

function findMatchingClose(allLines, openLine) {
  // openLine has the opening { — find the matching }
  let d = 0;
  for (let i = openLine; i < allLines.length; i++) {
    for (const ch of allLines[i]) {
      if (ch === "{") d++;
      else if (ch === "}") {
        d--;
        if (d === 0) return i;
      }
    }
  }
  return -1;
}

// Collect hover blocks (as ranges to transform)
// We'll process the file by tracking which lines to wrap
const hoverBlocks = []; // { start, end } — line ranges (inclusive) to wrap in @media (hover: hover)

let i = 0;
while (i < n) {
  const line = lines[i];

  if (isInsideComment(lines, i)) {
    i++;
    continue;
  }

  if (!line.includes(":hover")) {
    i++;
    continue;
  }

  // This line has :hover — find the selector start (may span back through comma lines)
  let selectorStart = i;
  let k = i - 1;
  while (k >= 0) {
    const prevLine = lines[k].trim();
    // A continuation selector line ends with "," and doesn't contain "{"
    if (prevLine.endsWith(",") && !prevLine.includes("{") && !prevLine.startsWith("/*") && !prevLine.startsWith("//") && prevLine !== "") {
      selectorStart = k;
      k--;
    } else {
      break;
    }
  }

  // Find the opening { (may be on the same line as :hover or a later line)
  let openBraceLine = i;
  while (openBraceLine < n && !lines[openBraceLine].includes("{")) {
    openBraceLine++;
  }

  if (openBraceLine >= n) {
    i++;
    continue;
  }

  const closeBraceLine = findMatchingClose(lines, openBraceLine);
  if (closeBraceLine < 0) {
    i++;
    continue;
  }

  hoverBlocks.push({ start: selectorStart, end: closeBraceLine });

  // Skip past this block
  i = closeBraceLine + 1;
}

console.log(`Found ${hoverBlocks.length} :hover rule blocks`);

// ---- Build transformed output ----
// Process blocks from last to first to preserve line numbers
hoverBlocks.sort((a, b) => b.start - a.start);

const outputLines = [...lines];

for (const { start, end } of hoverBlocks) {
  const blockContent = outputLines.slice(start, end + 1);

  // Check if the block is already inside an @media block by looking at the
  // brace depth before the selector start line.
  // If depth > 0, we're inside some block (could be @media, but also could be a
  // nested rule — for this CSS file, depth > 0 at a selector means it's inside @media).
  const depthAtStart = braceDepthBefore[start];

  // Determine indent: if already inside an @media, the selector is indented with 2 spaces
  // We add another 2 spaces of indent for the content inside our new @media block
  const baseIndent = depthAtStart > 0 ? "  " : ""; // 2 spaces if already nested
  const innerIndent = "  "; // additional 2 spaces for inside our @media wrapper

  // Indent the block lines
  const indented = blockContent.map((l) => innerIndent + l);

  // If we're already inside an @media block, we need to close the parent @media,
  // add our @media (hover: hover) block, then reopen... that's very complex.
  // Instead: use nested @media (valid CSS Nesting level 5, supported by all modern browsers).
  // Just add @media (hover: hover) { ... } around the rule lines.
  const wrapped = [
    `${baseIndent}@media (hover: hover) {`,
    ...indented,
    `${baseIndent}}`,
  ];

  outputLines.splice(start, end - start + 1, ...wrapped);
}

const output = outputLines.join("\n");
const afterHoverCount = (output.match(/:hover/g) || []).length;
console.log(`After :hover count: ${afterHoverCount} (original: ${originalHoverCount})`);

if (afterHoverCount !== originalHoverCount) {
  console.error("ERROR: :hover count changed! Aborting write.");
  process.exit(1);
}

const mediaHoverCount = (output.match(/@media \(hover: hover\)/g) || []).length;
console.log(`@media (hover: hover) blocks added: ${mediaHoverCount}`);

writeFileSync(cssPath, output, "utf8");
console.log("Written successfully.");
