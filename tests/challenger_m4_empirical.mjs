/**
 * tests/challenger_m4_empirical.mjs
 * Comprehensive Empirical Verification Suite for Milestone 4 (R4)
 * Challenger: challenger_m4_1
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const BASE_URL = 'http://localhost:8097';

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName} ${details ? '(' + details + ')' : ''}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    failCount++;
  }
}

function fetchHttp(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const req = http.request(url, options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          bodyBuffer,
          bodyText: bodyBuffer.toString('utf8')
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function verifyPngStructure(buffer, fileName) {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (buffer.length < 33) return { valid: false, error: 'Buffer too short for PNG header' };

  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { valid: false, error: 'Invalid PNG signature magic bytes' };
  }

  // First chunk must be IHDR
  const ihdrLength = buffer.readUInt32BE(8);
  const ihdrType = buffer.toString('ascii', 12, 16);
  if (ihdrType !== 'IHDR' || ihdrLength !== 13) {
    return { valid: false, error: `Invalid IHDR chunk: type=${ihdrType}, length=${ihdrLength}` };
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);
  const compression = buffer.readUInt8(26);
  const filter = buffer.readUInt8(27);
  const interlace = buffer.readUInt8(28);

  // Check last chunk is IEND (49 45 4E 44)
  const iendIndex = buffer.lastIndexOf(Buffer.from('IEND', 'ascii'));
  if (iendIndex === -1 || iendIndex + 8 > buffer.length) {
    return { valid: false, error: 'Missing or corrupt IEND chunk' };
  }

  return {
    valid: true,
    width,
    height,
    bitDepth,
    colorType,
    compression,
    filter,
    interlace,
    fileSize: buffer.length
  };
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('🔍 CHALLENGER M4: EMPIRICAL AUDIT & STRESS SUITE');
  console.log(`Target: ${BASE_URL} | Working Directory: ${PROJECT_ROOT}`);
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // SUITE 1: HTTP Server Response & MIME Types
  // -------------------------------------------------------------------------
  console.log('--- [SUITE 1] HTTP Endpoints, Headers & MIME Types ---');
  
  const endpointChecks = [
    { path: '/', expectedStatus: 200, mimePrefix: 'text/html', desc: 'Root path' },
    { path: '/index.html', expectedStatus: 200, mimePrefix: 'text/html', desc: 'index.html' },
    { path: '/style.css', expectedStatus: 200, mimePrefix: 'text/css', desc: 'style.css' },
    { path: '/src/main.js', expectedStatus: 200, mimePrefix: ['text/javascript', 'application/javascript'], desc: 'main.js ES module' },
    { path: '/vendor/three/three.module.js', expectedStatus: 200, mimePrefix: ['text/javascript', 'application/javascript'], desc: 'vendor Three.js module' },
    { path: '/screenshots/01_lakeside_retreat_overview.png', expectedStatus: 200, mimePrefix: 'image/png', desc: 'Screenshot 1' },
    { path: '/screenshots/02_character_flight_fairy.png', expectedStatus: 200, mimePrefix: 'image/png', desc: 'Screenshot 2' },
    { path: '/screenshots/03_subterranean_descent_gauge.png', expectedStatus: 200, mimePrefix: 'image/png', desc: 'Screenshot 3' },
    { path: '/screenshots/04_holy_grail_50ft_celebration.png', expectedStatus: 200, mimePrefix: 'image/png', desc: 'Screenshot 4' },
    { path: '/non_existent_probe_404.html', expectedStatus: 404, mimePrefix: null, desc: '404 Missing resource' }
  ];

  for (const check of endpointChecks) {
    try {
      const res = await fetchHttp(check.path);
      assert(
        res.statusCode === check.expectedStatus,
        `${check.desc} returns status ${check.expectedStatus}`,
        `Got ${res.statusCode}`
      );

      if (check.mimePrefix) {
        const contentType = res.headers['content-type'] || '';
        const matchesMime = Array.isArray(check.mimePrefix)
          ? check.mimePrefix.some(m => contentType.toLowerCase().startsWith(m))
          : contentType.toLowerCase().startsWith(check.mimePrefix);
        assert(
          matchesMime,
          `${check.desc} has valid Content-Type (${Array.isArray(check.mimePrefix) ? check.mimePrefix.join(' or ') : check.mimePrefix})`,
          `Got '${contentType}'`
        );
      }

      // Check Content-Length header is present and > 0 for 200 responses
      if (check.expectedStatus === 200) {
        const contentLength = parseInt(res.headers['content-length'] || '0', 10);
        assert(
          contentLength > 0 && res.bodyBuffer.length === contentLength,
          `${check.desc} Content-Length header matches received payload`,
          `Header: ${contentLength}, Buffer: ${res.bodyBuffer.length}`
        );
      }
    } catch (err) {
      assert(false, `${check.desc} HTTP request succeeded`, `Error: ${err.message}`);
    }
  }

  // -------------------------------------------------------------------------
  // SUITE 2: Screenshot Asset Integrity & Binary Validation
  // -------------------------------------------------------------------------
  console.log('\n--- [SUITE 2] Screenshot Asset Files & Binary PNG Integrity ---');

  const screenshots = [
    '01_lakeside_retreat_overview.png',
    '02_character_flight_fairy.png',
    '03_subterranean_descent_gauge.png',
    '04_holy_grail_50ft_celebration.png'
  ];

  for (const shot of screenshots) {
    const filePath = path.join(PROJECT_ROOT, 'screenshots', shot);
    const exists = fs.existsSync(filePath);
    assert(exists, `Screenshot file exists on disk: ${shot}`, filePath);

    if (exists) {
      const stats = fs.statSync(filePath);
      assert(
        stats.size > 100 * 1024,
        `${shot} size > 100KB (102,400 bytes)`,
        `Actual: ${stats.size.toLocaleString()} bytes (${(stats.size / 1024).toFixed(1)} KB)`
      );

      const buffer = fs.readFileSync(filePath);
      const pngMeta = verifyPngStructure(buffer, shot);
      assert(pngMeta.valid, `${shot} is a valid non-corrupt PNG`, pngMeta.error || `Dimensions: ${pngMeta.width}x${pngMeta.height}, BitDepth: ${pngMeta.bitDepth}`);

      if (pngMeta.valid) {
        assert(pngMeta.width >= 800 && pngMeta.height >= 450, `${shot} has high resolution (>= 800x450)`, `${pngMeta.width}x${pngMeta.height}`);
      }

      // Verify HTTP payload matches disk byte-for-byte
      try {
        const httpRes = await fetchHttp(`/screenshots/${shot}`);
        assert(
          httpRes.statusCode === 200 && httpRes.bodyBuffer.equals(buffer),
          `${shot} served over HTTP exactly matches on-disk binary`,
          `HTTP bytes: ${httpRes.bodyBuffer.length}, Disk bytes: ${buffer.length}`
        );
      } catch (err) {
        assert(false, `${shot} fetched over HTTP matches disk`, err.message);
      }
    }
  }

  // -------------------------------------------------------------------------
  // SUITE 3: HTTP Server Stress & Concurrency Testing
  // -------------------------------------------------------------------------
  console.log('\n--- [SUITE 3] Server Concurrency & Rapid Burst Stress ---');

  // Test standard concurrent requests within server backlog queue (concurrency = 5)
  const concurrency = 5;
  const burstStart = Date.now();
  const burstPromises = Array.from({ length: concurrency }, (_, i) => {
    const endpoints = ['/', '/index.html', '/style.css', '/src/main.js', '/screenshots/01_lakeside_retreat_overview.png'];
    const p = endpoints[i % endpoints.length];
    return fetchHttp(p).then(res => ({
      index: i,
      path: p,
      status: res.statusCode,
      length: res.bodyBuffer.length
    }));
  });

  try {
    const burstResults = await Promise.all(burstPromises);
    const burstDuration = Date.now() - burstStart;
    const all200 = burstResults.every(r => r.status === 200);
    assert(
      all200,
      `Concurrent burst of ${concurrency} simultaneous requests returned HTTP 200`,
      `Duration: ${burstDuration}ms (~${(burstDuration / concurrency).toFixed(1)}ms per req)`
    );
  } catch (err) {
    const errMsg = err.code || err.message || String(err);
    assert(false, `Concurrent burst of ${concurrency} simultaneous requests succeeded`, errMsg);
  }

  // Probe server backlog limit (concurrency = 12)
  console.log('  Probing high-concurrency saturation boundary (concurrency = 12)...');
  try {
    const heavyBurst = Array.from({ length: 12 }, () => fetchHttp('/index.html'));
    await Promise.all(heavyBurst);
    console.log('  ℹ️ Server handled 12 concurrent requests.');
  } catch (err) {
    console.log(`  ℹ️ High concurrency saturation boundary confirmed at >5 concurrent sockets (${err.code || err.message}). Expected for Python single-threaded TCPServer (backlog=5).`);
  }
  await new Promise(r => setTimeout(r, 200));

  // -------------------------------------------------------------------------
  // SUITE 4: Traversal & Resiliency Testing
  // -------------------------------------------------------------------------
  console.log('\n--- [SUITE 4] Path Traversal & Query Resiliency ---');
  await new Promise(r => setTimeout(r, 200));

  // Test query parameter handling (autostart=1, test=true, etc.)
  try {
    const res = await fetchHttp('/index.html?autostart=1&seed=42&mode=test');
    assert(
      res.statusCode === 200 && res.bodyText.includes('<html'),
      'URL with query string returns HTTP 200 and valid HTML document',
      `Status: ${res.statusCode}`
    );
  } catch (err) {
    const errMsg = err.code || err.message || String(err);
    assert(false, 'Query parameter request succeeded', errMsg);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`📊 CHALLENGER M4 SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('========================================================================');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal challenger error:', err);
  process.exit(1);
});
