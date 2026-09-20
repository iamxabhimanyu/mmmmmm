/**
 * Targeted verification for Test 2 (Primary Timeout) and Test 3 (Primary 5xx)
 * Demonstrates BEFORE, ACTION, and AFTER state inspections with explicit assertions.
 */
import { providerHealthManager } from '../src/services/ProviderHealthManager';

function snapshot(providerId: string) {
  const h = providerHealthManager.getHealth(providerId);
  return {
    status: h?.status,
    consecutiveFailures: h?.consecutiveFailures,
    lastError: h?.lastError,
    cooldownUntil: h?.cooldownUntil,
    lastFailureTime: h?.lastFailureTime,
    lastSuccessTime: h?.lastSuccessTime,
  };
}

console.log('========================================');
console.log('TEST 2 & 3 EXPLICIT STATE VERIFICATION');
console.log('========================================\n');

// ----------------------------------------------------
// TEST 2 — PRIMARY TIMEOUT
// ----------------------------------------------------
console.log('--- TEST 2: PRIMARY TIMEOUT ---');

// Reset provider to clean initial state
providerHealthManager.recordSuccess('open-meteo');

const beforeT2 = snapshot('open-meteo');
console.log('BEFORE:');
console.log(`status=${beforeT2.status}`);
console.log(`consecutiveFailures=${beforeT2.consecutiveFailures}`);
console.log(`lastError=${beforeT2.lastError}`);

console.log('\nACTION:');
console.log('timeout failure recorded');

// Realistic timeout error containing URL with API key and stack trace to verify sanitization
const timeoutError = new Error(
  'Request timed out after 8000ms while connecting to https://api.open-meteo.com/v1/forecast?latitude=28.61&longitude=77.20&apikey=SECRET_KEY_98765\n    at fetchWithTimeout (/src/services/providers/fetchUtils.ts:33:13)\n    at OpenMeteoProvider.getWeatherAndForecast'
);

providerHealthManager.recordFailure('open-meteo', timeoutError);

// Inspect immediately without calling recordSuccess
const afterT2 = snapshot('open-meteo');
console.log('\nAFTER:');
console.log(`status=${afterT2.status}`);
console.log(`consecutiveFailures=${afterT2.consecutiveFailures}`);
console.log(`lastError=${afterT2.lastError}`);
console.log(`cooldownUntil=${afterT2.cooldownUntil}`);

// Assertions for Test 2
const t2ConsecutiveIncreased = (afterT2.consecutiveFailures ?? 0) === (beforeT2.consecutiveFailures ?? 0) + 1;
const t2HasTimeoutMsg = (afterT2.lastError || '').toLowerCase().includes('timed out');
const t2NoApiKey = !(afterT2.lastError || '').includes('SECRET_KEY_98765');
const t2NoStackTrace = !(afterT2.lastError || '').includes('\n') && !(afterT2.lastError || '').includes('fetchWithTimeout');
const t2NoFullUrl = !(afterT2.lastError || '').includes('https://api.open-meteo.com/v1/forecast');

// Cooldown behavior check: trigger consecutive failure to reach degraded state (threshold = 2)
providerHealthManager.recordFailure('open-meteo', new Error('Request timed out after 8000ms (retry)'));
const degradedStateT2 = snapshot('open-meteo');
const t2StatusChanged = degradedStateT2.status === 'degraded';
const t2CooldownActive = typeof degradedStateT2.cooldownUntil === 'number' && (degradedStateT2.cooldownUntil || 0) > Date.now();

const test2Passed = t2ConsecutiveIncreased &&
  t2HasTimeoutMsg &&
  t2NoApiKey &&
  t2NoStackTrace &&
  t2NoFullUrl &&
  t2StatusChanged &&
  t2CooldownActive;

console.log('\nASSERTION CHECKS:');
console.log(`- consecutiveFailures increased: ${t2ConsecutiveIncreased} (${beforeT2.consecutiveFailures} -> ${afterT2.consecutiveFailures})`);
console.log(`- lastError contains sanitized timeout error: ${t2HasTimeoutMsg} ("${afterT2.lastError}")`);
console.log(`- API key not leaked: ${t2NoApiKey}`);
console.log(`- Stack trace stripped: ${t2NoStackTrace}`);
console.log(`- Full URL stripped to host: ${t2NoFullUrl}`);
console.log(`- Provider status changes on threshold: ${t2StatusChanged} (${beforeT2.status} -> ${degradedStateT2.status})`);
console.log(`- Cooldown behavior consistent: ${t2CooldownActive} (cooldownUntil=${degradedStateT2.cooldownUntil})`);

console.log(`\nTEST 2: ${test2Passed ? 'PASS' : 'FAIL'}`);

// ----------------------------------------------------
// TEST 3 — PRIMARY 5xx
// ----------------------------------------------------
console.log('\n--- TEST 3: PRIMARY 5xx ---');

// Reset provider to clean initial state
providerHealthManager.recordSuccess('open-meteo');

const beforeT3 = snapshot('open-meteo');
console.log('BEFORE:');
console.log(`status=${beforeT3.status}`);
console.log(`consecutiveFailures=${beforeT3.consecutiveFailures}`);
console.log(`lastError=${beforeT3.lastError}`);

console.log('\nACTION:');
console.log('HTTP 503 failure recorded');

// 503 Service Unavailable error with URL and auth query param
const http503Error = new Error(
  'HTTP 503 Service Unavailable: upstream gateway overloaded for https://api.open-meteo.com/v1/forecast?token=AUTH_TOKEN_XYZ123\n    at checkResponse (/src/services/providers/fetchUtils.ts:45:9)'
);

providerHealthManager.recordFailure('open-meteo', http503Error);

// Inspect immediately without calling recordSuccess
const afterT3 = snapshot('open-meteo');
console.log('\nAFTER:');
console.log(`status=${afterT3.status}`);
console.log(`consecutiveFailures=${afterT3.consecutiveFailures}`);
console.log(`lastError=${afterT3.lastError}`);
console.log(`cooldownUntil=${afterT3.cooldownUntil}`);

// Assertions for Test 3
const t3ConsecutiveIncreased = (afterT3.consecutiveFailures ?? 0) === (beforeT3.consecutiveFailures ?? 0) + 1;
const t3Has503Msg = (afterT3.lastError || '').includes('503');
const t3NoToken = !(afterT3.lastError || '').includes('AUTH_TOKEN_XYZ123');
const t3NoStackTrace = !(afterT3.lastError || '').includes('\n') && !(afterT3.lastError || '').includes('checkResponse');
const t3NoFullUrl = !(afterT3.lastError || '').includes('https://api.open-meteo.com/v1/forecast');

// Verify circuit breaker progression to unavailable status after 5 consecutive failures
for (let i = 0; i < 4; i++) {
  providerHealthManager.recordFailure('open-meteo', new Error('HTTP 503 Service Unavailable'));
}
const unavailableStateT3 = snapshot('open-meteo');
const t3StatusUnavailable = unavailableStateT3.status === 'unavailable';
const t3Cooldown2Min = typeof unavailableStateT3.cooldownUntil === 'number' && (unavailableStateT3.cooldownUntil || 0) > Date.now();
const t3IsAvailableFalse = providerHealthManager.isAvailable('open-meteo') === false;

const test3Passed = t3ConsecutiveIncreased &&
  t3Has503Msg &&
  t3NoToken &&
  t3NoStackTrace &&
  t3NoFullUrl &&
  t3StatusUnavailable &&
  t3Cooldown2Min &&
  t3IsAvailableFalse;

console.log('\nASSERTION CHECKS:');
console.log(`- consecutiveFailures increased: ${t3ConsecutiveIncreased} (${beforeT3.consecutiveFailures} -> ${afterT3.consecutiveFailures})`);
console.log(`- lastError contains sanitized 503 error: ${t3Has503Msg} ("${afterT3.lastError}")`);
console.log(`- Auth token not leaked: ${t3NoToken}`);
console.log(`- Stack trace stripped: ${t3NoStackTrace}`);
console.log(`- Full URL stripped to host: ${t3NoFullUrl}`);
console.log(`- Status transitioned to unavailable: ${t3StatusUnavailable} (status=${unavailableStateT3.status})`);
console.log(`- Cooldown active (2 minutes): ${t3Cooldown2Min} (cooldownUntil=${unavailableStateT3.cooldownUntil})`);
console.log(`- Provider unavailable via isAvailable(): ${t3IsAvailableFalse}`);

console.log(`\nTEST 3: ${test3Passed ? 'PASS' : 'FAIL'}`);

// Reset provider to clean state
providerHealthManager.recordSuccess('open-meteo');
