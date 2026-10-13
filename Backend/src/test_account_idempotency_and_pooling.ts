import crypto from 'crypto';
import { pool, poolAdapter } from './db/pool';
import { AuthService } from './domains/auth/auth.service';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('   CREATE ACCOUNT: IDEMPOTENCY, POOLING & RACE CONDITION SUITE');
  console.log('============================================================\n');

  try {
    // -------------------------------------------------------------
    // Test 1: Connection Pool Configuration & poolAdapter
    // -------------------------------------------------------------
    console.log('--- Test 1: Database Connection Pool & Adapter Configuration ---');
    const poolConfig = (pool as any).options;
    assert(poolConfig.max === 10, 'Pool size is locked to 10 per server instance', `Got: ${poolConfig.max}`);
    assert(poolConfig.idleTimeoutMillis === 30000, 'Pool idle timeout is 30,000ms', `Got: ${poolConfig.idleTimeoutMillis}`);
    assert(poolConfig.connectionTimeoutMillis === 5000, 'Pool connection timeout is 5,000ms', `Got: ${poolConfig.connectionTimeoutMillis}`);

    // Verify poolAdapter withClient guarantees checkout and release
    const clientResult = await poolAdapter.withClient(async (client) => {
      const res = await client.query('SELECT 1 as num');
      return res.rows[0].num;
    });
    assert(clientResult === 1, 'poolAdapter.withClient successfully executes and releases client');

    // Verify poolAdapter withTransaction commits and releases
    const txResult = await poolAdapter.withTransaction(async (client) => {
      const res = await client.query('SELECT 42 as num');
      return res.rows[0].num;
    });
    assert(txResult === 42, 'poolAdapter.withTransaction successfully executes, commits, and releases client');

    // -------------------------------------------------------------
    // Test 2: Idempotent Create-Account Replay (Same Key, Same Request)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Idempotent Registration Replay (Same Key, Same Request) ---');
    const testEmail1 = `idemp-test-${Date.now()}@example.com`;
    const idempotencyKey1 = `key-reg-1-${crypto.randomUUID()}`;
    const payload1 = {
      email: testEmail1,
      password: 'StrongPassword123!',
      firstName: 'Ada',
      lastName: 'Lovelace',
    };

    const firstResult = await AuthService.register(payload1, idempotencyKey1);
    assert(!!firstResult?.user?.id, 'Initial registration succeeds with 201 result and valid user ID');
    assert(firstResult.user.email === testEmail1.toLowerCase(), 'User email matches normalized input');
    assert(!!firstResult.accessToken, 'Access token issued');

    // Replay with identical key and payload
    const replayResult = await AuthService.register(payload1, idempotencyKey1);
    assert(replayResult.user.id === firstResult.user.id, 'Replay returns identical user ID');
    assert(replayResult.accessToken === firstResult.accessToken, 'Replay returns identical token session payload without creating duplicates');
    assert(replayResult.user.createdAt === firstResult.user.createdAt, 'Replay returns identical createdAt timestamp');

    // Verify exactly ONE user was created in DB
    const countCheck = await poolAdapter.query('SELECT COUNT(*) as count FROM users WHERE email = $1', [testEmail1.toLowerCase()]);
    assert(parseInt(countCheck.rows[0].count, 10) === 1, 'Exactly 1 user row exists in database for this email');

    // Verify idempotency record state
    const idempRow = await poolAdapter.query(
      `SELECT status, response_code FROM idempotency_keys WHERE scope = 'auth:register' AND key = $1`,
      [idempotencyKey1]
    );
    assert(idempRow.rows[0].status === 'COMPLETED', 'Idempotency record status is COMPLETED');
    assert(idempRow.rows[0].response_code === 201, 'Idempotency response code is 201');

    // -------------------------------------------------------------
    // Test 3: Idempotency Conflict (Same Key, Different Payload)
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Idempotency Conflict (Same Key, Different Payload) ---');
    const mismatchedPayload = {
      email: `different-${Date.now()}@example.com`,
      password: 'StrongPassword123!',
      firstName: 'Grace',
      lastName: 'Hopper',
    };

    let mismatchCaught = false;
    let mismatchCode = '';
    try {
      await AuthService.register(mismatchedPayload, idempotencyKey1);
    } catch (err: any) {
      mismatchCaught = true;
      mismatchCode = err.code;
    }
    assert(mismatchCaught, 'Mismatched payload using same Idempotency-Key is rejected');
    assert(mismatchCode === 'IDEMPOTENCY_MISMATCH', 'Rejected with 409 IDEMPOTENCY_MISMATCH error code', `Got: ${mismatchCode}`);

    // -------------------------------------------------------------
    // Test 4: Race Conditions During Create Account Handled Uniquely
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Concurrent Race Conditions on Email Registration Handled Uniquely ---');
    const raceEmail = `race-test-${Date.now()}@example.com`;
    const racePayload = {
      email: raceEmail,
      password: 'SecurePassword123!',
      firstName: 'Concurrent',
      lastName: 'Tester',
    };

    // Fire 5 simultaneous registration requests with DIFFERENT idempotency keys for the SAME email
    const concurrentRequests = Array.from({ length: 5 }, (_, i) => {
      const key = `race-key-${i}-${crypto.randomUUID()}`;
      return AuthService.register(racePayload, key)
        .then((res) => ({ status: 'fulfilled' as const, value: res }))
        .catch((err) => ({ status: 'rejected' as const, reason: err }));
    });

    const results = await Promise.all(concurrentRequests);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert(fulfilled.length === 1, 'Exactly ONE concurrent registration succeeded', `Fulfilled: ${fulfilled.length}`);
    assert(rejected.length === 4, 'Exactly FOUR concurrent registrations were rejected gracefully', `Rejected: ${rejected.length}`);

    // Verify all rejections are clean EMAIL_ALREADY_EXISTS 409 (Postgres 23505 unique violation handled uniquely)
    const allExpectedCodes = rejected.every(
      (r: any) => r.reason.code === 'EMAIL_ALREADY_EXISTS' && r.reason.status === 409
    );
    assert(
      allExpectedCodes,
      'All rejected concurrent attempts returned 409 EMAIL_ALREADY_EXISTS (no unhandled 500s or crashes)',
      JSON.stringify(rejected.map((r: any) => ({ code: r.reason.code, status: r.reason.status })))
    );

    // Verify database row count is strictly 1
    const raceCountCheck = await poolAdapter.query('SELECT COUNT(*) as count FROM users WHERE email = $1', [raceEmail.toLowerCase()]);
    assert(parseInt(raceCountCheck.rows[0].count, 10) === 1, 'Database contains strictly 1 user row after concurrent race condition');

    // -------------------------------------------------------------
    // Test 5: Connection Pool Health & Leak Prevention
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Connection Pool Integrity & Client Leak Prevention ---');
    // Pool totalCount and idleCount check
    const totalCount = pool.totalCount;
    const waitingCount = pool.waitingCount;
    console.log(`  Current pool status: total=${totalCount}, waiting=${waitingCount}, max=10`);
    assert(totalCount <= 10, 'Active pool connections do not exceed max 10 limit');
    assert(waitingCount === 0, 'No clients left stuck waiting in connection queue');

  } catch (err: any) {
    console.error('Unexpected test suite crash:', err);
    failedTests++;
  } finally {
    console.log('\n============================================================');
    console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
    console.log('============================================================\n');

    await pool.end();
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runTests();
