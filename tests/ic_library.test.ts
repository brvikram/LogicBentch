import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllICDefinitions,
  getICDefinition,
  canInsertIntoZif,
  canPlaceOnBreadboard,
} from '../src/ic-library';

test('IC library contains exactly all 25 required IC models with verified pin counts', () => {
  const all = getAllICDefinitions();
  assert.equal(all.length, 25);

  const expectedParts = [
    '7400', '7402', '7404', '7408', '7410', '7420', '7427', '7432', '7486', '4077',
    '7483', '7485', '74138', '7446', '7447', '74148', '74153', '74139', '74151',
    '7474', '7476', '7490', '74192', '7495',
    '6116',
  ];

  for (const part of expectedParts) {
    const ic = getICDefinition(part);
    assert.ok(ic, `Missing IC ${part}`);
    assert.equal(ic.pins.length, ic.pinCount, `Pin count mismatch on ${part}`);
    const pinNums = new Set(ic.pins.map((p) => p.pin));
    assert.equal(pinNums.size, ic.pinCount, `Duplicate pin numbers on ${part}`);
  }
});

test('Non-standard power pins and CMOS vs TTL families are accurately defined', () => {
  assert.equal(getICDefinition('4077')?.family, 'CMOS');
  assert.equal(getICDefinition('7486')?.family, 'TTL');
  assert.equal(getICDefinition('7483')?.pins.find((p) => p.direction === 'power-vcc')?.pin, 5);
  assert.equal(getICDefinition('7483')?.pins.find((p) => p.direction === 'power-gnd')?.pin, 12);
  assert.equal(getICDefinition('7476')?.pins.find((p) => p.direction === 'power-vcc')?.pin, 5);
  assert.equal(getICDefinition('7476')?.pins.find((p) => p.direction === 'power-gnd')?.pin, 13);
  assert.equal(getICDefinition('7490')?.pins.find((p) => p.direction === 'power-vcc')?.pin, 5);
  assert.equal(getICDefinition('7490')?.pins.find((p) => p.direction === 'power-gnd')?.pin, 10);
});

test('Socket compatibility validates 14/16-pin ICs in ZIF1..ZIF4 and 24-pin 6116 RAM in ZIF5', () => {
  assert.equal(canInsertIntoZif('7400', 'ZIF1').ok, true);
  assert.equal(canInsertIntoZif('7447', 'ZIF4').ok, true);
  assert.equal(canInsertIntoZif('6116', 'ZIF1').ok, false);
  assert.equal(canInsertIntoZif('6116', 'ZIF5').ok, true);
  assert.equal(canInsertIntoZif('7400', 'ZIF5').ok, false);

  assert.equal(canPlaceOnBreadboard('6116', 1, []).ok, true);
  assert.equal(canPlaceOnBreadboard('6116', 29, []).ok, true);
  assert.equal(canPlaceOnBreadboard('6116', 30, []).ok, false);
});

