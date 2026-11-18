import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewProject,
  parseAndValidateProject,
  serializeProject,
} from '../src/storage/projectStorage';

test('Test 8: Project serialization and validation preserves exact ICs, wires, switches, and notes', () => {
  const proj = createNewProject('Counter Verification', '7490 + 7447 test');
  proj.circuit.powerOn = true;
  proj.circuit.switches[0] = 1;
  proj.circuit.switches[3] = 1;
  proj.circuit.placedICs = [
    { instanceId: 'ic_1', partNumber: '7490', placement: { kind: 'zif', socketId: 'ZIF1' } },
    { instanceId: 'ic_2', partNumber: '6116', placement: { kind: 'breadboard', startCol: 4 } },
  ];
  proj.circuit.wires = [
    {
      id: 'w1',
      from: 'PWR:+5V:0',
      to: 'ZIF1:5',
      color: 'red',
      kind: 'patch-cord',
      controlOffset: { dx: 12, dy: -8 },
    },
  ];
  proj.experimentNotes = {
    'exp-example-7490-decade': {
      observedNotes: 'Counted 0..9 accurately',
      finalResult: 'Passed',
    },
  };

  const json = serializeProject(proj);
  const parsed = parseAndValidateProject(json);
  assert.equal(parsed.ok, true);
  assert.ok(parsed.project);
  assert.equal(parsed.project.name, 'Counter Verification');
  assert.equal(parsed.project.circuit.powerOn, true);
  assert.equal(parsed.project.circuit.switches[0], 1);
  assert.equal(parsed.project.circuit.switches[3], 1);
  assert.equal(parsed.project.circuit.placedICs.length, 2);
  assert.equal(parsed.project.circuit.placedICs[1].placement.kind, 'breadboard');
  assert.deepEqual(parsed.project.circuit.wires[0].controlOffset, { dx: 12, dy: -8 });
  assert.equal(
    parsed.project.experimentNotes?.['exp-example-7490-decade']?.finalResult,
    'Passed'
  );
});

test('Project parser rejects malformed or unsupported schemas', () => {
  const bad1 = parseAndValidateProject('not json');
  assert.equal(bad1.ok, false);

  const bad2 = parseAndValidateProject(JSON.stringify({ schema: 'other/v0' }));
  assert.equal(bad2.ok, false);
});
