import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('Phase 0 Security TDD: firestore.rules & firebase-blueprint.json enforce Eight Pillars & block Dirty Dozen payloads', () => {
  const rulesText = fs.readFileSync(rulesPath, 'utf-8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));

  // Verify blueprint structure
  assert.ok(blueprint.entities?.CircuitProject, 'CircuitProject entity must exist in blueprint');
  assert.ok(
    blueprint.firestore?.['/users/{userId}/projects/{projectId}'],
    'Firestore path /users/{userId}/projects/{projectId} must exist in blueprint'
  );

  // Pillar 1: Global Default-Deny Safety Net
  assert.match(rulesText, /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s*false;/);

  // Pillar 2: Validation Blueprint & Anti-Update-Gap
  assert.match(rulesText, /function\s+isValidCircuitProject\(/);
  assert.match(rulesText, /data\.keys\(\)\.hasAll\(/);
  assert.match(rulesText, /data\.keys\(\)\.hasOnly\(/);

  // Pillar 3: Path Variable Hardening
  assert.match(rulesText, /isValidId\(userId\)/);
  assert.match(rulesText, /isValidId\(projectId\)/);

  // Pillar 4 & 5: Action-Based Update with affectedKeys().hasOnly() & Array size guards
  assert.match(rulesText, /affectedKeys\(\)\.hasOnly\(/);
  assert.match(rulesText, /circuit\.placedICs\.size\(\)\s*<=\s*5/);
  assert.match(rulesText, /circuit\.wires\.size\(\)\s*<=\s*200/);

  // Pillar 6 & 8: Verified Email & Secure List Queries
  assert.match(rulesText, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(rulesText, /allow\s+list:\s*if\s+isVerified\(\)[\s\S]*existing\(\)\.ownerId\s*==\s*request\.auth\.uid/);

  // Temporal & Immutable Integrity
  assert.match(rulesText, /incoming\(\)\.createdAt\s*==\s*request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt\s*==\s*request\.time/);
  assert.match(rulesText, /incoming\(\)\.ownerId\s*==\s*existing\(\)\.ownerId/);
});
