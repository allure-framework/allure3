#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultDemoPath = join(__dirname, '..', '..', '..', '..', 'demo', 'job_678450', 'allure-results');

const API_URL = process.env.API_URL || 'http://localhost:3000/api/v1';
const DATA_DIR = process.env.DATA_DIR || (existsSync(defaultDemoPath) ? defaultDemoPath : '/tmp/allure_test_data');
const REPORT_DIR = process.env.REPORT_DIR; // Optional: path to static report (e.g. .../job_678450/report) for variables/metadata

async function createLaunch(name) {
  const response = await fetch(`${API_URL}/launches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, startTime: new Date().toISOString() })
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
    let jsonBody;
    try {
      jsonBody = JSON.stringify(results);
      JSON.parse(jsonBody);
    } catch (jsonError) {
      reject(new Error(`Invalid JSON: ${jsonError.message}`));
      return;
    }
    const bodyBuffer = Buffer.from(jsonBody, 'utf8');
    const url = new URL(`${API_URL}/launches/${launchId}/results`);
    const isHttps = url.protocol === 'https:';
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': bodyBuffer.length
      }
    };
    const req = (isHttps ? https : http).request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) {
          reject(new Error(`Failed to upload results: ${res.statusCode} ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Invalid response JSON: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

function loadResultFiles(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...loadResultFiles(fullPath));
    } else if (entry.name.endsWith('-result.json')) {
      const content = readFileSync(fullPath, 'utf-8');
      const result = JSON.parse(content);
      // Convert Allure 3 format to TestResultDTO format
      const dto = convertToDTO(result);
      files.push(dto);
    }
  }
  
  return files;
}

function convertToDTO(result) {
  // Convert Allure 2/3 JSON format to TestResultDTO (statusDetails → error)
  const MAX_STRING_LENGTH = 100_000;
  const cleanString = (str) => {
    if (str == null || typeof str !== 'string') return str;
    let s = str
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');
    if (s.length > MAX_STRING_LENGTH) s = s.slice(0, MAX_STRING_LENGTH);
    return s;
  };

  function deepSanitize(obj) {
    if (obj == null) return obj;
    if (typeof obj === 'string') return cleanString(obj);
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) return obj.map(deepSanitize);
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[cleanString(String(k))] = deepSanitize(v);
    }
    return out;
  }

  function extractError(obj) {
    const details = obj.statusDetails || {};
    const message = cleanString(details.message ?? obj.message ?? '');
    const trace = cleanString(details.trace ?? obj.trace ?? '');
    if (!message && !trace) return undefined;
    return { message: message || undefined, trace: trace || undefined };
  }

  function mapStep(step) {
    const err = extractError(step);
    const steps = (step.steps || []).map(mapStep);
    const out = deepSanitize({ ...step, steps, type: 'step' });
    if (err) out.error = err;
    return out;
  }

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
    labels: (result.labels || []).map(label => ({
      name: cleanString(label.name || ''),
      value: label.value ? cleanString(label.value) : undefined
    })),
    parameters: (result.parameters || []).map(param => {
      let paramValue = param.value;
      if (paramValue !== undefined && paramValue !== null) {
        if (typeof paramValue === 'string' && paramValue.startsWith('{')) {
          paramValue = cleanString(paramValue);
        } else {
          paramValue = cleanString(String(paramValue));
        }
      }
      const mode = param.mode || (param.hidden ? 'hidden' : 'visible');
      return {
        name: cleanString(param.name || ''),
        value: paramValue,
        hidden: mode === 'hidden',
        excluded: mode === 'excluded',
        masked: mode === 'masked'
      };
    }),
    links: (result.links || []).map(link => ({
      name: link.name ? cleanString(link.name) : undefined,
      url: cleanString(link.url || ''),
      type: link.type ? cleanString(link.type) : undefined
    })),
    steps: (result.steps || []).map(step => mapStep(step)),
    attachments: (result.attachments || []).map(att => ({
      name: cleanString(att.name || ''),
      source: cleanString(att.source || ''),
      type: cleanString(att.type || '')
    })),
    sourceMetadata: {
      readerId: 'allure3',
      metadata: {}
    }
  };
  return deepSanitize(dto);
}

async function postJson(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function importReportMetadata(launchId) {
  if (!REPORT_DIR || !existsSync(REPORT_DIR)) return;
  const widgetsDir = join(REPORT_DIR, 'widgets');
  if (!existsSync(widgetsDir)) return;

  // Metadata (allure_environment): widgets/environment.json (Allure 2) or widgets/allure_environment.json
  let allureEnvironment = [];
  const envPath = existsSync(join(widgetsDir, 'environment.json'))
    ? join(widgetsDir, 'environment.json')
    : join(widgetsDir, 'allure_environment.json');
  if (existsSync(envPath)) {
    const env = JSON.parse(readFileSync(envPath, 'utf-8'));
    allureEnvironment = Array.isArray(env)
      ? env.map((e) => ({ name: e.name || '', values: Array.isArray(e.values) ? e.values : [String(e.value ?? '')] }))
      : [];
    if (allureEnvironment.length > 0) {
      await postJson(`/launches/${launchId}/globals`, { allureEnvironment });
      console.log(`  ✓ Imported metadata (${allureEnvironment.length} items) from environment.json`);
    }
  }

  // Variables: widgets/variables.json or derive from environment
  let variables = {};
  const varsPath = join(widgetsDir, 'variables.json');
  if (existsSync(varsPath)) {
    const raw = JSON.parse(readFileSync(varsPath, 'utf-8'));
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      variables = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ? v : String(v ?? '')])
      );
    }
  }
  if (Object.keys(variables).length === 0 && allureEnvironment.length > 0) {
    variables = Object.fromEntries(
      allureEnvironment.map((e) => [e.name, (e.values && e.values[0]) || ''])
    );
  }
  if (Object.keys(variables).length > 0) {
    await postJson(`/launches/${launchId}/variables`, variables);
    console.log(`  ✓ Imported variables (${Object.keys(variables).length} keys)`);
  }
}

async function main() {
  try {
    if (!existsSync(DATA_DIR)) {
      console.error(`Data directory not found: ${DATA_DIR}`);
      console.log('Please extract test data archives first');
      process.exit(1);
    }
    
    console.log('Loading test data from:', DATA_DIR);
    const results = loadResultFiles(DATA_DIR);
    console.log(`Found ${results.length} test results`);
    
    if (results.length === 0) {
      console.log('No test results found');
      return;
    }
    
    console.log('\nCreating launch...');
    const launchId = await createLaunch('Allure Test Data Import');
    console.log(`✓ Launch created with ID: ${launchId}`);
    
    console.log('\nUploading test results...');
    const batchSize = 20;
    let uploaded = 0;
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      try {
        const uploadResponse = await uploadResults(launchId, batch);
        uploaded += uploadResponse.data?.uploadedCount || batch.length;
        console.log(`  ✓ Uploaded batch ${Math.floor(i / batchSize) + 1}: ${uploaded}/${results.length} results`);
      } catch (error) {
        console.error(`  ✗ Failed to upload batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        // Continue with next batch
        if (i === 0) {
          // If first batch fails, show the problematic data
          console.error('  First result data:', JSON.stringify(batch[0], null, 2).substring(0, 500));
        }
      }
    }

    if (REPORT_DIR) {
      console.log('\nImporting metadata and variables from report...');
      try {
        await importReportMetadata(launchId);
      } catch (e) {
        console.warn('  ⚠ Could not import report metadata:', e.message);
      }
    }
    
    console.log('\n✅ Success!');
    console.log(`Launch ID: ${launchId}`);
    console.log(`Total results uploaded: ${uploaded}`);
    console.log(`\nView launch: ${API_URL}/launches/${launchId}`);
    console.log(`Report: http://localhost:8080/report?launch_id=${launchId}`);
    console.log(`API docs: http://localhost:3000/api-docs`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
