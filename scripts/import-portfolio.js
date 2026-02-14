/**
 * import-portfolio.js
 *
 * Reads the Webflow CSV export, downloads all images from the Webflow CDN,
 * and generates Astro content-collection markdown files.
 *
 * Usage:  node scripts/import-portfolio.js
 */

import { createReadStream, existsSync, mkdirSync, createWriteStream } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CSV_PATH = join(ROOT, 'Alan Just - Portfolio Images - 645eca4371e299c55dcf80d1.csv');
const IMAGES_DIR = join(ROOT, 'public', 'images', 'portfolio');
const CONTENT_DIR = join(ROOT, 'src', 'content', 'portfolio');

// ---------------------------------------------------------------------------
// Minimal CSV parser (handles quoted fields with embedded commas / newlines)
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\r' && next === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; }
      else if (ch === '\n' || ch === '\r') { row.push(field); field = ''; rows.push(row); row = []; }
      else { field += ch; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  const headers = rows[0];
  return rows.slice(1).filter(r => r.some(c => c.trim())).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (r[i] || '').trim(); });
    return obj;
  });
}

// ---------------------------------------------------------------------------
// Download a single URL → local file. Resolves to local path on success.
// ---------------------------------------------------------------------------
function download(url, destPath) {
  return new Promise((resolve, reject) => {
    if (existsSync(destPath)) { resolve(destPath); return; }

    const proto = url.startsWith('https') ? https : http;
    const file = createWriteStream(destPath);

    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        download(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Derive a safe local filename from a Webflow CDN URL
// ---------------------------------------------------------------------------
function localFilename(url) {
  // e.g. https://uploads-ssl.webflow.com/abc/defg_My%20Image.webp  → defg_My-Image.webp
  const raw = url.split('/').pop();
  return decodeURIComponent(raw).replace(/\s+/g, '-');
}

// ---------------------------------------------------------------------------
// Strip HTML tags for plain-text usage in frontmatter
// ---------------------------------------------------------------------------
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8203;/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Escape a string for YAML front-matter (wrap in double quotes, escape inner)
// ---------------------------------------------------------------------------
function yamlStr(val) {
  if (!val) return '""';
  const escaped = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(CONTENT_DIR, { recursive: true });

  const text = await import('fs').then(fs => fs.promises.readFile(CSV_PATH, 'utf8'));
  const rows = parseCsv(text);

  console.log(`Found ${rows.length} portfolio items in CSV.\n`);

  for (const row of rows) {
    const slug = row['Slug'];
    if (!slug) continue;

    // ------------------------------------------------------------------
    // Collect all image URLs for this project
    // ------------------------------------------------------------------
    const heroUrl = row['Hero Image'];
    const additionalRaw = row['Additional project images'] || '';
    const additionalUrls = additionalRaw
      .split(';')
      .map(u => u.trim())
      .filter(Boolean);

    const allUrls = [heroUrl, ...additionalUrls].filter(Boolean);

    // ------------------------------------------------------------------
    // Download all images
    // ------------------------------------------------------------------
    const localImages = [];
    for (const url of allUrls) {
      const filename = localFilename(url);
      const destPath = join(IMAGES_DIR, filename);
      try {
        await download(url, destPath);
        localImages.push(`/images/portfolio/${filename}`);
        process.stdout.write(`  ✓ ${filename}\n`);
      } catch (err) {
        console.warn(`  ✗ Failed to download ${url}: ${err.message}`);
        localImages.push(''); // keep index alignment
      }
    }

    const heroLocal = localImages[0] || '';
    const additionalLocal = localImages.slice(1).filter(Boolean);

    // ------------------------------------------------------------------
    // Build markdown content
    // ------------------------------------------------------------------
    const projectName = row['Project Name'] || row['Name'];
    const description = stripHtml(row['Project Description'] || '');
    const rawHtml = (row['Project Description'] || '').trim();
    const category = row['Commissioned by'] || '';
    const sortOrder = parseInt(row['Sort Order'], 10) || 999;
    const featured = row['Featured'] === 'true';
    const showProject = row['Show Project'] !== 'false';

    // Additional images as YAML list
    const additionalYaml = additionalLocal.length
      ? '\nadditionalImages:\n' + additionalLocal.map(p => `  - ${yamlStr(p)}`).join('\n')
      : '';

    const md = `---
title: ${yamlStr(projectName)}
projectSlug: ${slug}
category: ${yamlStr(category)}
sortOrder: ${sortOrder}
featured: ${featured}
showProject: ${showProject}
heroImage: ${yamlStr(heroLocal)}${additionalYaml}
---

${rawHtml ? rawHtml : description}
`;

    const mdPath = join(CONTENT_DIR, `${slug}.md`);
    await writeFile(mdPath, md, 'utf8');
    console.log(`  → wrote ${slug}.md\n`);
  }

  console.log('\nDone! All images downloaded and markdown files generated.');
}

main().catch(err => { console.error(err); process.exit(1); });
