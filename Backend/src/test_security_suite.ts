import http from 'http';
import app from './index';
import { pool, query } from './db/pool';
import { rateLimitRedis } from './lib/rateLimit';

async function runSecurityTests() {
  console.log('====================================================');
  console.log('       ROTA SECURITY VERIFICATION TEST SUITE       ');
  console.log('====================================================\n');

  // Start ephemeral test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  console.log(`Ephemeral test API listening on ${baseUrl}\n`);

  try {
    const timestamp = Date.now();
    const ownerEmail = `owner_${timestamp}@example.com`;
    const staffEmail = `staff_${timestamp}@example.com`;
    const teamBEmail = `owner_b_${timestamp}@example.com`;
    const password = 'Password123#';

    // ----------------------------------------------------
    // SETUP: Register users & create teams
    // ----------------------------------------------------
    console.log('SETUP: Registering test users and teams...');

    // 1. Register Owner
    const regOwnerRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerEmail,
        password,
        firstName: 'Owner',
        lastName: 'Alpha',
      }),
    });
    const ownerData = (await regOwnerRes.json()) as any;
    const ownerToken = ownerData.data.token;
    const ownerId = ownerData.data.user.id;

    // 2. Register Staff
    const regStaffRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: staffEmail,
        password,
        firstName: 'Staff',
        lastName: 'Alpha',
      }),
    });
    const staffData = (await regStaffRes.json()) as any;
    const staffToken = staffData.data.token;
    const staffId = staffData.data.user.id;

    // 3. Register Owner B for Team B
    const regOwnerBRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: teamBEmail,
        password,
        firstName: 'Owner',
        lastName: 'Beta',
      }),
    });
    const ownerBData = (await regOwnerBRes.json()) as any;
    const ownerBToken = ownerBData.data.token;
    const ownerBId = ownerBData.data.user.id;

    // 4. Create Team A (Owned by Owner)
    const createTeamARes = await fetch(`${baseUrl}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ name: 'Alpha Care Team', businessName: 'Alpha Health' }),
    });
    const teamAData = (await createTeamARes.json()) as any;
    const teamAId = teamAData.data.id;

    // Add Staff to Team A with role 'STAFF'
    await query(
      `INSERT INTO team_memberships (user_id, team_id, role, status) VALUES ($1, $2, 'STAFF', 'ACTIVE')`,
      [staffId, teamAId]
    );

    // 5. Create Team B (Owned by Owner B)
    const createTeamBRes = await fetch(`${baseUrl}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerBToken}`,
      },
      body: JSON.stringify({ name: 'Beta Support Team', businessName: 'Beta Health' }),
    });
    const teamBData = (await createTeamBRes.json()) as any;
    const teamBId = teamBData.data.id;

    // 6. Create Shift in Team A
    const shiftStartTime = new Date(Date.now() + 86400000).toISOString();
    const shiftEndTime = new Date(Date.now() + 86400000 + 8 * 3600000).toISOString();

    const createShiftRes = await fetch(`${baseUrl}/shifts/teams/${teamAId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        roleName: 'Day Nurse',
        startTime: shiftStartTime,
        endTime: shiftEndTime,
        assignedToId: staffId,
      }),
    });
    const shiftAData = (await createShiftRes.json()) as any;
    const shiftAId = shiftAData.data.id;

    // 7. Create Shift in Team B
    const createShiftBRes = await fetch(`${baseUrl}/shifts/teams/${teamBId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerBToken}`,
      },
      body: JSON.stringify({
        roleName: 'Night Doctor',
        startTime: shiftStartTime,
        endTime: shiftEndTime,
      }),
    });
    const shiftBData = (await createShiftBRes.json()) as any;
    const shiftBId = shiftBData.data.id;

    console.log('   ✓ Test users, teams, and shifts created.\n');

    // -----------------------------------------------------------------------------------------
    // TEST 1: SERVER-SIDE PERMISSION ENFORCEMENT
    // A Staff user calling the "delete shift" endpoint directly with Postman must be rejected.
    // -----------------------------------------------------------------------------------------
    console.log('TEST 1: Verifying server-side permission enforcement on delete shift...');

    const staffDeleteRes = await fetch(`${baseUrl}/shifts/teams/${teamAId}/${shiftAId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`, // Staff token calling delete
      },
    });

    const staffDeleteJson = (await staffDeleteRes.json()) as any;

    if (staffDeleteRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for Staff shift deletion, got ${staffDeleteRes.status}`);
    }
    if (staffDeleteJson.error?.code !== 'INSUFFICIENT_PERMISSIONS') {
      throw new Error(`Expected error code INSUFFICIENT_PERMISSIONS, got ${staffDeleteJson.error?.code}`);
    }
    console.log(`   ✓ Staff delete shift rejected with HTTP 403 [${staffDeleteJson.error.code}]`);

    // Verify shift was NOT deleted in database
    const shiftCheck = await query(`SELECT status FROM shifts WHERE id = $1`, [shiftAId]);
    if (shiftCheck.rows[0].status === 'CANCELLED') {
      throw new Error('Shift was improperly cancelled despite 403 response!');
    }
    console.log('   ✓ Database verified: Shift status unchanged in PostgreSQL.');

    // Verify Owner CAN delete/cancel the shift
    const ownerDeleteRes = await fetch(`${baseUrl}/shifts/teams/${teamAId}/${shiftAId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`, // Owner token
      },
    });
    if (ownerDeleteRes.status !== 200) {
      throw new Error(`Expected HTTP 200 for Owner shift deletion, got ${ownerDeleteRes.status}`);
    }
    console.log('   ✓ Authorized Owner delete/cancel shift succeeded with HTTP 200.\n');

    // -----------------------------------------------------------------------------------------
    // TEST 2: TENANT ISOLATION (CROSS-TEAM ACCESS PREVENTION)
    // Prevent one team from ever seeing another team's data.
    // -----------------------------------------------------------------------------------------
    console.log("TEST 2: Verifying cross-team tenant isolation...");

    // Staff User (Team A) attempts to GET Team B shifts
    const crossTeamQueryRes = await fetch(`${baseUrl}/shifts/teams/${teamBId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`, // Token for user who is NOT member of Team B
      },
    });

    const crossTeamQueryJson = (await crossTeamQueryRes.json()) as any;
    if (crossTeamQueryRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for cross-team query, got ${crossTeamQueryRes.status}`);
    }
    if (crossTeamQueryJson.error?.code !== 'FORBIDDEN') {
      throw new Error(`Expected error code FORBIDDEN, got ${crossTeamQueryJson.error?.code}`);
    }
    console.log(`   ✓ Cross-team query to Team B rejected with HTTP 403 [${crossTeamQueryJson.error.code}]`);

    // Staff User (Team A) attempts to delete Team B shift
    const crossTeamDeleteRes = await fetch(`${baseUrl}/shifts/teams/${teamBId}/${shiftBId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
    });
    if (crossTeamDeleteRes.status !== 403) {
      throw new Error(`Expected HTTP 403 for cross-team mutation, got ${crossTeamDeleteRes.status}`);
    }
    console.log('   ✓ Cross-team delete to Team B rejected with HTTP 403 [FORBIDDEN]');

    // Query Team A shifts as Owner A — ensure Team B shift is NEVER returned
    const teamAQueryRes = await fetch(`${baseUrl}/shifts/teams/${teamAId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    const teamAQueryJson = (await teamAQueryRes.json()) as any;
    const containsTeamBShift = teamAQueryJson.data.some((s: any) => s.id === shiftBId);
    if (containsTeamBShift) {
      throw new Error('DATA LEAK: Team B shift found in Team A shifts result!');
    }
    console.log('   ✓ Verified query results: Team A query strictly filters by team ID and excludes Team B shifts.\n');

    // -----------------------------------------------------------------------------------------
    // TEST 3: ZOD REQUEST BODY VALIDATION ON THE SERVER
    // Validate every request body with Zod on the server.
    // -----------------------------------------------------------------------------------------
    console.log('TEST 3: Verifying server-side Zod request body validation...');

    // A. Invalid email on registration
    const invalidRegRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email-format',
        password: 'Password123#',
        firstName: 'Test',
      }),
    });
    const invalidRegJson = (await invalidRegRes.json()) as any;
    if (invalidRegRes.status !== 400 || invalidRegJson.error?.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected HTTP 400 VALIDATION_ERROR on malformed email, got ${invalidRegRes.status}`);
    }
    console.log('   ✓ Malformed email rejected by Zod schema with HTTP 400 [VALIDATION_ERROR]');

    // B. Password under 8 characters
    const shortPwRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'validemail123@example.com',
        password: 'short',
        firstName: 'Test',
      }),
    });
    const shortPwJson = (await shortPwRes.json()) as any;
    if (shortPwRes.status !== 400 || shortPwJson.error?.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected HTTP 400 VALIDATION_ERROR on short password, got ${shortPwRes.status}`);
    }
    console.log('   ✓ Short password (<8 chars) rejected by Zod schema with HTTP 400 [VALIDATION_ERROR]');

    // C. Invalid datetime on shift creation
    const invalidShiftRes = await fetch(`${baseUrl}/shifts/teams/${teamAId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        roleName: 'Nurse',
        startTime: 'not-a-datetime',
        endTime: 'not-a-datetime',
      }),
    });
    const invalidShiftJson = (await invalidShiftRes.json()) as any;
    if (invalidShiftRes.status !== 400 || invalidShiftJson.error?.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected HTTP 400 VALIDATION_ERROR on invalid shift datetime, got ${invalidShiftRes.status}`);
    }
    console.log('   ✓ Invalid ISO datetime on shift rejected by Zod schema with HTTP 400 [VALIDATION_ERROR]\n');

    // -----------------------------------------------------------------------------------------
    // TEST 4: REDIS RATE LIMITING
    // Rate limit login, password reset, invites, and payment endpoints with Redis.
    // -----------------------------------------------------------------------------------------
    console.log('TEST 4: Verifying Redis-backed rate limiting on sensitive endpoints...');

    // Clear rate limit key for test IP before running test
    const testIp = '127.0.0.1';
    await rateLimitRedis.del(`ratelimit:login:${testIp}`);

    // Send requests up to limit (10 for login)
    let rateLimitTriggered = false;
    let rateLimitStatusCode = 0;
    let rateLimitJson: any = null;

    for (let i = 1; i <= 12; i++) {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': testIp,
        },
        body: JSON.stringify({
          email: ownerEmail,
          password: 'WrongPassword',
        }),
      });

      if (res.status === 429) {
        rateLimitTriggered = true;
        rateLimitStatusCode = res.status;
        rateLimitJson = await res.json();
        break;
      }
    }

    if (!rateLimitTriggered) {
      throw new Error('Redis rate limiter was not triggered after 11 consecutive login requests!');
    }
    if (rateLimitJson?.error?.code !== 'RATE_LIMIT_EXCEEDED') {
      throw new Error(`Expected RATE_LIMIT_EXCEEDED, got ${rateLimitJson?.error?.code}`);
    }
    console.log(`   ✓ Redis rate limit triggered at HTTP ${rateLimitStatusCode} [${rateLimitJson.error.code}]`);
    console.log(`   ✓ Retry-After: ${rateLimitJson.error.details?.retryAfterSeconds}s returned via Redis TTL.\n`);

    // Cleanup test data from PostgreSQL and Redis in correct FK order
    await rateLimitRedis.del(`ratelimit:login:${testIp}`);
    await query(`DELETE FROM activity_logs WHERE team_id IN ($1, $2)`, [teamAId, teamBId]);
    await query(`DELETE FROM shifts WHERE team_id IN ($1, $2)`, [teamAId, teamBId]);
    await query(`DELETE FROM team_memberships WHERE user_id IN ($1, $2, $3)`, [ownerId, staffId, ownerBId]);
    await query(`DELETE FROM teams WHERE id IN ($1, $2)`, [teamAId, teamBId]);
    await query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [ownerId, staffId, ownerBId]);

    console.log('====================================================');
    console.log('  ALL REQUIREMENT 4 SECURITY TESTS PASSED (100%)    ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Security test failed:', err);
    process.exit(1);
  } finally {
    server.close();
    await pool.end();
    rateLimitRedis.disconnect();
  }
}

runSecurityTests();
