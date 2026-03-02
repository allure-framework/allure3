#!/usr/bin/env node
/**
 * Load demo data: parent launch + children (with tests if DEMO_ROOT exists) + one child WITHOUT tests
 * (simulates failed provisioning - child finished before any tests ran).
 *
 * Usage:
 *   API_URL=http://localhost:3000/api/v1 node scripts/load_demo_parent_with_empty_child.js
 *   DEMO_ROOT=/path/to/allure2_custom/demo node scripts/load_demo_parent_with_empty_child.js
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultDemoRoot = join(__dirname, '..', '..', '..', '..', 'allure2_custom', 'demo');

const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
const DEMO_ROOT = process.env.DEMO_ROOT || defaultDemoRoot;

const JOBS_WITH_FAILURES = ['job_678447', 'job_678529', 'job_678531'];
const EMPTY_CHILD_NAME = 'Provisioning Failed (no tests)';

async function createLaunch(body) {
  const response = await fetch(`${API_URL}/launches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create launch: ${response.status} ${text}`);
  }
  const data = await response.json();
  return data.data.id;
}

function uploadResults(launchId, results) {
  return new Promise((resolve, reject) => {
    const jsonBody = JSON.stringify(results);
    const bodyBuffer = Buffer.from(jsonBody, 'utf8');
    const url = new URL(`${API_URL}/launches/${launchId}/results`);
    const isHttps = url.protocol === 'https:';
    const req = (isHttps ? https : http).request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': bodyBuffer.length
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode >= 400) reject(new Error(`Upload failed: ${res.statusCode} ${body}`));
          else {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error(`Invalid response: ${e.message}`));
            }
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

function loadResultFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...loadResultFiles(fullPath));
    } else if (entry.name.endsWith('-result.json')) {
      const result = JSON.parse(readFileSync(fullPath, 'utf-8'));
      files.push(convertToDTO(result));
    }
  }
  return files;
}

function convertToDTO(result) {
  const MAX_STRING_LENGTH = 100_000;
  const cleanString = (str) => {
    if (str == null || typeof str !== 'string') return str;
    let s = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (s.length > MAX_STRING_LENGTH) s = s.slice(0, MAX_STRING_LENGTH);
    return s;
  };
  const deepSanitize = (obj) => {
    if (obj == null) return obj;
    if (typeof obj === 'string') return cleanString(obj);
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) return obj.map(deepSanitize);
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[cleanString(String(k))] = deepSanitize(v);
    return out;
  };
  const extractError = (obj) => {
    const details = obj.statusDetails || {};
    const message = cleanString(details.message ?? obj.message ?? '');
    const trace = cleanString(details.trace ?? obj.trace ?? '');
    if (!message && !trace) return undefined;
    return { message: message || undefined, trace: trace || undefined };
  };
  const mapStep = (step) => {
    const err = extractError(step);
    const steps = (step.steps || []).map(mapStep);
    const out = deepSanitize({ ...step, steps, type: 'step' });
    if (err) out.error = err;
    return out;
  };
  const error = extractError(result);
  const dto = {
    id: result.uuid || result.id,
    name: cleanString(result.name || ''),
    fullName: cleanString(result.fullName || result.name || ''),
    status: result.status,
    error,
    flaky: result.flaky || false,
    muted: result.muted || false,
    known: result.known || false,
    hidden: result.hidden || false,
    historyId: result.historyId ? cleanString(result.historyId) : undefined,
    testCaseId: result.testCaseId ? cleanString(result.testCaseId) : undefined,
    start: result.start,
    stop: result.stop,
    duration: result.duration ?? (result.start != null && result.stop != null ? result.stop - result.start : undefined),
    labels: (result.labels || []).map((l) => ({ name: cleanString(l.name || ''), value: l.value ? cleanString(l.value) : undefined })),
    parameters: (result.parameters || []).map((p) => {
      const mode = p.mode || (p.hidden ? 'hidden' : 'visible');
      return {
        name: cleanString(p.name || ''),
        value: p.value !== undefined && p.value !== null ? (typeof p.value === 'string' ? cleanString(p.value) : String(p.value)) : '',
        hidden: mode === 'hidden',
        excluded: mode === 'excluded',
        masked: mode === 'masked'
      };
    }),
    links: (result.links || []).map((l) => ({ name: l.name ? cleanString(l.name) : undefined, url: cleanString(l.url || ''), type: l.type ? cleanString(l.type) : undefined })),
    steps: (result.steps || []).map(mapStep),
    attachments: (result.attachments || []).map((a) => ({ name: cleanString(a.name || ''), source: cleanString(a.source || ''), type: cleanString(a.type || '') })),
    sourceMetadata: { readerId: 'allure3', metadata: {} }
  };
  return deepSanitize(dto);
}

async function postJson(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function getDisplayNameFromReport(reportDir) {
  const widgetsDir = join(reportDir, 'widgets');
  if (!existsSync(widgetsDir)) return null;
  const envPath = existsSync(join(widgetsDir, 'environment.json'))
    ? join(widgetsDir, 'environment.json')
    : join(widgetsDir, 'allure_environment.json');
  if (existsSync(envPath)) {
    const env = JSON.parse(readFileSync(envPath, 'utf-8'));
    const arr = Array.isArray(env) ? env : [];
    const entry = arr.find(
      (e) =>
        (e.name || '').toLowerCase() === 'environment' ||
        (e.name || '').toLowerCase() === 'name' ||
        (e.name || '').toLowerCase() === 'job_name'
    );
    const val = entry?.values?.[0] ?? entry?.value;
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  const varsPath = join(widgetsDir, 'variables.json');
  if (existsSync(varsPath)) {
    const raw = JSON.parse(readFileSync(varsPath, 'utf-8'));
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const keys = ['ENVIRONMENT', 'Environment', 'JOB_NAME', 'JobName', 'Name'];
      for (const k of keys) {
        const v = raw[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    }
  }
  return null;
}

async function importReportMetadata(launchId, reportDir) {
  const widgetsDir = join(reportDir, 'widgets');
  if (!existsSync(widgetsDir)) return;

  let allureEnvironment = [];
  const envPath = existsSync(join(widgetsDir, 'environment.json')) ? join(widgetsDir, 'environment.json') : join(widgetsDir, 'allure_environment.json');
  if (existsSync(envPath)) {
    const env = JSON.parse(readFileSync(envPath, 'utf-8'));
    allureEnvironment = Array.isArray(env) ? env.map((e) => ({ name: e.name || '', values: Array.isArray(e.values) ? e.values : [String(e.value ?? '')] })) : [];
    if (allureEnvironment.length > 0) {
      await postJson(`/launches/${launchId}/globals`, { allureEnvironment });
    }
  }

  let variables = {};
  const varsPath = join(widgetsDir, 'variables.json');
  if (existsSync(varsPath)) {
    const raw = JSON.parse(readFileSync(varsPath, 'utf-8'));
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      variables = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ? v : String(v ?? '')]));
    }
  }
  if (Object.keys(variables).length === 0 && allureEnvironment.length > 0) {
    variables = Object.fromEntries(allureEnvironment.map((e) => [e.name, (e.values && e.values[0]) || '']));
  }
  if (Object.keys(variables).length > 0) {
    await postJson(`/launches/${launchId}/variables`, variables);
  }
}

async function main() {
  console.log('Loading demo: parent + children (with tests if available) + child WITHOUT tests (provisioning failed)');
  console.log('Demo root:', DEMO_ROOT);

  // 1. Create parent launch
  console.log('\n1. Creating parent launch...');
  const parentId = await createLaunch({
    name: 'Parent Launch (Demo Run)',
    variables: {
      parent_meta: 'test-run-2026',
      parent_var: 'parent_value',
      run_type: 'regression'
    }
  });
  console.log(`   ✓ Parent launch ID: ${parentId}`);

  // 2. Add metadata to parent
  console.log('\n2. Adding metadata to parent...');
  await postJson(`/launches/${parentId}/globals`, {
    allureEnvironment: [
      { name: 'Parent', values: ['Demo Parent Launch'] },
      { name: 'RunType', values: ['regression'] }
    ]
  });
  console.log('   ✓ Metadata added');

  const childIds = [];

  // 3. Create child launches WITH tests (if DEMO_ROOT exists)
  if (existsSync(DEMO_ROOT)) {
    for (const jobName of JOBS_WITH_FAILURES) {
      const jobDir = join(DEMO_ROOT, jobName);
      const resultsDir = join(jobDir, 'allure-results');
      const reportDir = join(jobDir, 'report');

      if (!existsSync(resultsDir)) {
        console.warn(`   ⚠ Skipping ${jobName}: allure-results not found`);
        continue;
      }

      const displayName = existsSync(reportDir) ? getDisplayNameFromReport(reportDir) : null;
      const envName = displayName || jobName;
      console.log(`\n3. Child (with tests): ${jobName}${displayName ? ` (display: ${displayName})` : ''}`);
      const childId = await createLaunch({
        parent_launch_id: parentId,
        environment_name: envName
      });
      childIds.push({ job: jobName, id: childId, hasTests: true });
      console.log(`   ✓ Child launch ID: ${childId}`);

      const results = loadResultFiles(resultsDir);
      console.log(`   Uploading ${results.length} test results...`);
      const batchSize = 20;
      for (let i = 0; i < results.length; i += batchSize) {
        const batch = results.slice(i, i + batchSize);
        const resp = await uploadResults(childId, batch);
        const uploaded = resp.data?.uploadedCount ?? batch.length;
        console.log(`   ✓ Batch ${Math.floor(i / batchSize) + 1}: ${uploaded} results`);
      }

      if (existsSync(reportDir)) {
        await importReportMetadata(childId, reportDir);
        console.log('   ✓ Report metadata imported');
      }
    }
  } else {
    console.log('\n3. ⚠ DEMO_ROOT not found, skipping children with tests');
  }

  // 4. Create child WITHOUT tests (provisioning failed) - always
  console.log(`\n4. Creating child WITHOUT tests (provisioning failed): ${EMPTY_CHILD_NAME}`);
  const emptyChildId = await createLaunch({
    parent_launch_id: parentId,
    environment_name: EMPTY_CHILD_NAME
  });
  childIds.push({ job: EMPTY_CHILD_NAME, id: emptyChildId, hasTests: false });
  console.log(`   ✓ Child launch ID: ${emptyChildId} (no results uploaded)`);

  // 5. Add globals (errors, exitCode) for empty child - marks launch as failed
  console.log('   Adding globals (errors, exitCode=1) for provisioning-failed child...');
  await postJson(`/launches/${emptyChildId}/globals`, {
    exitCode: { original: 1 },
    errors: [
      {
        message: 'Launch failed during provisioning. No tests were executed.',
        trace: 'The run failed before any tests could start (e.g. environment setup, resource allocation, or pre-run step failed).'
      }
    ]
  });
  console.log('   ✓ Globals added (errors, exitCode=1)');

  console.log('\n✅ Done!');
  console.log(`Parent launch: ${parentId}`);
  console.log(`Child launches: ${childIds.map((c) => `${c.job}=${c.id} (tests: ${c.hasTests ? 'yes' : 'no'})`).join(', ')}`);
  console.log(`\nView parent: http://localhost:8080/report?launch_id=${parentId}`);
  for (const c of childIds) {
    console.log(`View ${c.job}: http://localhost:8080/report?launch_id=${c.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
