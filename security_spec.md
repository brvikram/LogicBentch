# LogicBench Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path not explicitly matched is denied (`allow read, write: if false;`).
2. **Verified Identity & Path Isolation**: Only a signed-in user with `request.auth.token.email_verified == true` whose `request.auth.uid == userId` may read, list, create, update, or delete documents under `/users/{userId}/projects/{projectId}`.
3. **Path Variable Hardening**: Both `userId` and `projectId` must match `^[a-zA-Z0-9_\-]+$` with length `1..128`, and `incoming().id == projectId` and `incoming().ownerId == userId`.
4. **Strict Keys & Anti-Shadow-Field Blueprint**: `isValidCircuitProject(data)` requires exact keys `['id', 'ownerId', 'schema', 'name', 'description', 'circuit', 'experimentNotes', 'createdAt', 'updatedAt']` (`hasAll` and `hasOnly`), bounded string sizes, bounded `placedICs` (`size() <= 5`) and `wires` (`size() <= 200`), and `schema == 'logicbench-project/v1'`.
5. **Temporal & Immutable Integrity**: On `create`, `createdAt == request.time` and `updatedAt == request.time`. On `update`, `id`, `ownerId`, `schema`, and `createdAt` are immutable, `updatedAt == request.time`, and `affectedKeys().hasOnly(['name', 'description', 'circuit', 'experimentNotes', 'updatedAt'])`.
6. **Secure List Queries**: `allow list` explicitly checks `request.auth.uid == userId && resource.data.ownerId == request.auth.uid`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: `auth = null` attempting `create` on `/users/u1/projects/p1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth = { uid: 'u1', email_verified: false }` attempting `create` -> `PERMISSION_DENIED`.
3. **Cross-User Tenant Escape**: `auth = { uid: 'attacker', email_verified: true }` writing to `/users/victim/projects/p1` -> `PERMISSION_DENIED`.
4. **OwnerId Spoofing**: `auth = { uid: 'u1' }` writing payload with `ownerId: 'u2'` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: Payload includes extra key `isAdmin: true` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Document ID contains illegal characters or >128 chars -> `PERMISSION_DENIED`.
7. **Denial-of-Wallet Oversized Name**: `name` exceeds 120 characters -> `PERMISSION_DENIED`.
8. **Invalid Schema Version**: `schema: 'malicious/v2'` -> `PERMISSION_DENIED`.
9. **Forged Client Timestamp on Create**: `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.
10. **Immutable Field Mutation on Update**: Updating `createdAt` or `ownerId` on an existing project -> `PERMISSION_DENIED`.
11. **Value Poisoning on Update**: Updating `name` to a non-string or oversized string -> `PERMISSION_DENIED`.
12. **Unauthorized Cross-User List Scraping**: Listing `/users/victim/projects` as `attacker` -> `PERMISSION_DENIED`.
