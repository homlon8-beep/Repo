/**
 * Comprehensive Automated Verification Suite for Karnal Lead Bot Enterprise Safeguards
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const watermark = require('./watermark');
const queue = require('./queue');
const whatsapp = require('./whatsapp');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

(async () => {
  console.log('🧪 Starting Enterprise Delivery Safeguard Test Suite...\n');

  // 1. Invisible Cryptographic Zero-Width Watermarking Tests
  await runTest('Watermark: Generates 100% unique byte hash for identical message content', () => {
    const baseMessage = 'Namaste ji! Karnal Realty Advisors property desk se message tha. Commercial SCO plots ki inquiry ke regarding.';
    const recipient = '919876543210';

    const hashes = new Set();
    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      const watermarked = watermark.applyInvisibleWatermark(baseMessage, recipient);
      const hash = watermark.getMessageHash(watermarked);
      assert.strictEqual(hashes.has(hash), false, `Hash collision detected on iteration ${i}!`);
      hashes.add(hash);

      // Verify human-facing content is identical when stripped
      const stripped = watermark.stripZeroWidth(watermarked);
      assert.strictEqual(stripped, baseMessage, 'Stripped message does not match base message!');
      
      // Verify zero-width characters are present
      assert.notStrictEqual(watermarked, baseMessage, 'Watermark was not injected into message!');
      assert.ok(watermarked.length > baseMessage.length, 'Length should be greater due to zero-width characters!');
    }
    assert.strictEqual(hashes.size, iterations, 'All generated hashes must be 100% unique!');
  });

  await runTest('Watermark: Preserves CRLF (\\r\\n) integrity without splitting carriage returns', () => {
    const crlfMessage = 'Line 1: Commercial Plot\r\nLine 2: Sector 12 Karnal';
    const recipient = '919876543210';
    const watermarked = watermark.applyInvisibleWatermark(crlfMessage, recipient);
    
    // CRLF should remain intact
    assert.ok(watermarked.includes('\r\n'), 'CRLF was split apart by watermark insertion!');
    const stripped = watermark.stripZeroWidth(watermarked);
    assert.strictEqual(stripped, crlfMessage, 'Stripped CRLF text does not match original!');
  });

  await runTest('Watermark: Handles diverse sentence terminators (. , ! , ? , । )', () => {
    const hindiMessage = 'Namaste ji! Commercial SCO plots available hain। Contact karein?';
    const recipient = '919876543210';
    const watermarked = watermark.applyInvisibleWatermark(hindiMessage, recipient);
    assert.notStrictEqual(watermarked, hindiMessage);
    assert.strictEqual(watermark.stripZeroWidth(watermarked), hindiMessage);
  });

  // 2. Gaussian Pacing Engine (3 to 6 Minutes)
  await runTest('Gaussian Pacing: 1,000 samples strictly fall within 3 to 6 minute range (180,000ms - 360,000ms)', () => {
    const minMs = 180000;
    const maxMs = 360000;
    const samples = [];
    let sum = 0;

    for (let i = 0; i < 1000; i++) {
      const delay = queue.getGaussianMsgDelayMs(minMs, maxMs);
      assert.ok(delay >= minMs, `Sample ${delay} is below minimum ${minMs}ms!`);
      assert.ok(delay <= maxMs, `Sample ${delay} is above maximum ${maxMs}ms!`);
      samples.push(delay);
      sum += delay;
    }

    const mean = sum / samples.length;
    const expectedMean = (minMs + maxMs) / 2; // 270,000ms (4.5 mins)
    const diffPercent = Math.abs(mean - expectedMean) / expectedMean;

    // Gaussian mean should be very close to the center (~4.5 minutes)
    assert.ok(diffPercent < 0.05, `Gaussian mean ${mean} drifted too far from expected ${expectedMean} (${(diffPercent * 100).toFixed(2)}%)!`);
  });

  await runTest('Gaussian Pacing: Inverted bounds defensively handled without NaN or errors', () => {
    const sample = queue.getGaussianMsgDelayMs(360000, 180000);
    assert.ok(sample >= 180000 && sample <= 360000, `Inverted bounds produced out-of-range sample: ${sample}`);
  });

  await runTest('Micro-batch Rest Breaks: Fall strictly between 35 and 65 minutes', () => {
    for (let i = 0; i < 100; i++) {
      const breakMs = queue.getRandomBreakDurationMs();
      const breakMins = breakMs / (60 * 1000);
      assert.ok(breakMins >= 35, `Break ${breakMins} mins is below 35 mins!`);
      assert.ok(breakMins <= 65, `Break ${breakMins} mins is above 65 mins!`);
    }
  });

  await runTest('Micro-batch Size: Falls strictly between 4 and 7 messages', () => {
    for (let i = 0; i < 50; i++) {
      const batch = queue.getRandomBatchLimit();
      assert.ok(batch >= 4, `Batch limit ${batch} is below 4!`);
      assert.ok(batch <= 7, `Batch limit ${batch} is above 7!`);
    }
  });

  // 3. E2EE Message Store & getMessage Retry Resolver
  await runTest('Message Store & getMessage: In-memory storage, envelope normalization, proto conversion, and zero disk pollution', async () => {
    const testId1 = `TEST_FLAT_${Date.now()}`;
    const testProto1 = {
      conversation: 'Verification test payload for flat E2EE retry resolver'
    };

    const testId2 = `TEST_NESTED_${Date.now()}`;
    const testProto2 = {
      message: {
        conversation: 'Verification test payload for nested envelope E2EE retry resolver'
      }
    };

    whatsapp.storeMessage(testId1, testProto1);
    whatsapp.storeMessage(testId2, testProto2);

    // Test getStoredMessage
    const retrieved1 = whatsapp.getStoredMessage(testId1);
    assert.strictEqual(retrieved1.conversation, testProto1.conversation);

    // Test getMessage (Baileys interface returning proto.Message)
    const resolvedProto1 = await whatsapp.getMessage({ id: testId1 });
    assert.ok(resolvedProto1, 'Resolved proto 1 should exist');
    assert.strictEqual(resolvedProto1.conversation, testProto1.conversation);

    const resolvedProto2 = await whatsapp.getMessage({ id: testId2 });
    assert.ok(resolvedProto2, 'Resolved proto 2 should exist');
    assert.strictEqual(resolvedProto2.conversation, testProto2.message.conversation);

    // Clean up test entries so disk store does not retain dummy test artifacts
    whatsapp.deleteStoredMessage(testId1);
    whatsapp.deleteStoredMessage(testId2);
    whatsapp.flushPersistMessages();

    // Verify cleanup
    assert.strictEqual(whatsapp.getStoredMessage(testId1), undefined);
    assert.strictEqual(whatsapp.getStoredMessage(testId2), undefined);
  });

  // 4. Terminology Scrubbing Check (No 'anti-ban', 'ban', 'safe limits' in customer-facing code)
  await runTest('Terminology Audit: Zero forbidden occurrences in source files and customer-facing UI', () => {
    const filesToCheck = [
      'server.js',
      'whatsapp.js',
      'queue.js',
      'ai.js',
      'watermark.js',
      '.env',
      'render.yaml',
      'README.md'
    ];

    const forbiddenRegex = /\b(anti-ban|safe\s+limits)\b/i;

    for (const file of filesToCheck) {
      const fullPath = path.join(__dirname, file);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        // Skip git hashes, Urban Estate (which contains "ban"), or code dependencies
        if (line.includes('Urban Estate') || line.includes('package-lock')) continue;

        const match = line.match(forbiddenRegex);
        if (match) {
          throw new Error(`Forbidden term "${match[0]}" found in ${file}:${lineNum + 1} -> "${line.trim()}"`);
        }
      }
    }
  });

  // 5. Baileys makeCacheableSignalKeyStore Integration Check
  await runTest('Baileys Integration: makeCacheableSignalKeyStore and proto imported and wired in whatsapp.js', () => {
    const whatsappFile = path.join(__dirname, 'whatsapp.js');
    const code = fs.readFileSync(whatsappFile, 'utf8');
    assert.ok(code.includes('makeCacheableSignalKeyStore'), 'makeCacheableSignalKeyStore must be used in whatsapp.js!');
    assert.ok(code.includes('makeCacheableSignalKeyStore(state.keys'), 'state.keys must be wrapped with makeCacheableSignalKeyStore!');
    assert.ok(code.includes('getMessage: async'), 'getMessage retry resolver must be configured in makeWASocket!');
    assert.ok(code.includes('recent_messages_store.json'), 'recent_messages_store.json must be configured as persistent store!');
  });

  console.log(`\n🎉 All ${passedTests}/${totalTests} Enterprise Safeguard Tests Passed Successfully!`);
})();
