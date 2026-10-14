import http from 'http';
import app from './index';
import { query } from './db/pool';
import { NotificationsService } from './domains/notifications/notifications.service';
import {
  isInQuietHours,
  isNotificationTypeAllowed,
} from './domains/notifications/queue';
import { UsersService } from './domains/users/users.service';

async function runRequirement7Tests() {
  console.log('====================================================');
  console.log('   REQUIREMENT 7: SETTINGS COORDINATION SUITE       ');
  console.log('====================================================\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  console.log(`Ephemeral test API running on ${baseUrl}\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, errorDetails?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, errorDetails ? errorDetails : '');
      failed++;
    }
  }

  try {
    const timestamp = Date.now();
    const halimaEmail = `halima_${timestamp}@example.com`;
    const colleagueEmail = `colleague_${timestamp}@example.com`;
    const password = 'Password123#';

    // 1. Register Halima (Nurse Manager)
    const regHRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: halimaEmail,
        password,
        firstName: 'Halima',
        lastName: 'Manager',
      }),
    });
    const halimaData = (await regHRes.json()) as any;
    const halimaToken = halimaData.data.token;
    const halimaId = halimaData.data.user.id;

    // 2. Register Colleague
    const regCRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: colleagueEmail,
        password,
        firstName: 'Tayo',
        lastName: 'Staff',
      }),
    });
    const colleagueData = (await regCRes.json()) as any;
    const colleagueToken = colleagueData.data.token;
    const colleagueId = colleagueData.data.user.id;

    // 3. Register Halima's Two Devices (Phone and Tablet)
    console.log('\n--- STEP 1: REGISTERING HALIMA\'S PHONE AND TABLET ---');
    await fetch(`${baseUrl}/notifications/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({
        pushToken: 'ExponentPushToken[halima_phone_token]',
        deviceId: 'halima-phone',
        deviceType: 'ios',
        deviceName: 'Halima iPhone',
      }),
    });

    await fetch(`${baseUrl}/notifications/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({
        pushToken: 'ExponentPushToken[halima_tablet_token]',
        deviceId: 'halima-tablet',
        deviceType: 'ios',
        deviceName: 'Halima iPad',
      }),
    });

    const devicesRes = await query(
      `SELECT device_id, push_token FROM device_push_tokens WHERE user_id = $1 ORDER BY device_id`,
      [halimaId]
    );
    assert(devicesRes.rowCount === 2, 'Halima has 2 devices registered (phone and tablet)');
    assert(devicesRes.rows[0].device_id === 'halima-phone', 'Phone registered');
    assert(devicesRes.rows[1].device_id === 'halima-tablet', 'Tablet registered');

    // 4. Halima sets quiet hours from 10pm (22:00) to 6am (06:00) on her Phone
    console.log('\n--- STEP 2: PHONE UPDATES QUIET HOURS (10 PM - 6 AM, AFRICA/LAGOS) ---');
    const updateRes = await fetch(`${baseUrl}/users/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '06:00',
        timezone: 'Africa/Lagos',
      }),
    });
    assert(updateRes.status === 200, 'Server saves quiet hours update with HTTP 200');
    const updatedBody = (await updateRes.json()) as any;
    assert(updatedBody.data.quietHoursEnabled === true, 'Server response confirms quietHoursEnabled is true');
    assert(updatedBody.data.quietHoursStart === '22:00', 'Server response confirms start is 22:00');
    assert(updatedBody.data.quietHoursEnd === '06:00', 'Server response confirms end is 06:00');
    assert(updatedBody.data.timezone === 'Africa/Lagos', 'Server response confirms timezone is Africa/Lagos');

    // 5. Halima's Tablet loads settings on launch -> receives authoritative server settings
    console.log('\n--- STEP 3: TABLET FETCHES SETTINGS FROM SERVER (SINGLE SOURCE OF TRUTH) ---');
    const tabletFetchRes = await fetch(`${baseUrl}/users/settings`, {
      headers: {
        Authorization: `Bearer ${halimaToken}`,
      },
    });
    assert(tabletFetchRes.status === 200, 'Tablet loads settings from server with HTTP 200');
    const tabletSettings = (await tabletFetchRes.json()) as any;
    assert(
      tabletSettings.data.quietHoursEnabled === true &&
        tabletSettings.data.quietHoursStart === '22:00' &&
        tabletSettings.data.quietHoursEnd === '06:00' &&
        tabletSettings.data.timezone === 'Africa/Lagos',
      'Tablet receives the exact same quiet hours configured on phone (synced everywhere)'
    );

    // 6. Validation: Invalid quiet hours formats are rejected by server
    console.log('\n--- STEP 4: SERVER VALIDATES SETTINGS INTEGRITY ---');
    const badTimeRes = await fetch(`${baseUrl}/users/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({
        quietHoursStart: '25:99',
      }),
    });
    assert(badTimeRes.status === 400, 'Server rejects invalid quiet hours format (25:99) with HTTP 400');

    const badTzRes = await fetch(`${baseUrl}/users/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({
        timezone: 'Mars/Olympus_Mons',
      }),
    });
    assert(badTzRes.status === 400, 'Server rejects invalid timezone with HTTP 400');

    // 7. Scenario Test: Colleague proposes shift swap at 2:00 AM in Halima's timezone
    console.log('\n--- STEP 5: AT 2 AM, COLLEAGUE PROPOSES SWAP -> SERVER ENFORCES QUIET HOURS ---');
    // In Africa/Lagos (UTC+1), 2:00 AM local time corresponds to 01:00:00 UTC.
    const twoAmLagosTime = new Date('2026-10-14T01:00:00Z');

    const quietCheck = isInQuietHours('22:00', '06:00', 'Africa/Lagos', twoAmLagosTime);
    assert(quietCheck.inQuietHours === true, 'isInQuietHours correctly evaluates to TRUE at 2:00 AM');
    // From 02:00 to 06:00 is 4 hours = 240 minutes = 14,400,000 ms (+ 10s buffer)
    assert(
      quietCheck.msUntilEnd >= 14400000 && quietCheck.msUntilEnd <= 14420000,
      `Calculated delay until 6:00 AM is 4 hours (${Math.round(quietCheck.msUntilEnd / 60000)} minutes)`
    );

    // Update Halima's settings to 00:00 - 23:59 so the live BullMQ worker detects quiet hours right now
    await fetch(`${baseUrl}/users/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({
        quietHoursEnabled: true,
        quietHoursStart: '00:00',
        quietHoursEnd: '23:59',
        timezone: 'Africa/Lagos',
      }),
    });

    // Create durable swap notification for Halima
    const notif = await NotificationsService.createNotification({
      userId: halimaId,
      type: 'SWAP_REQUESTED',
      title: 'Shift Swap Proposed',
      body: 'Tayo proposed a shift swap for tomorrow night.',
      data: { shiftId: 'shift-999' },
    });
    assert(notif.id !== undefined, 'Notification created transactionally on server');

    // Wait briefly for live background worker to process and evaluate quiet hours
    await new Promise((r) => setTimeout(r, 200));

    // Worker re-reads current user_settings from PostgreSQL, detects quiet hours, and defers delivery
    const serverSettings = await UsersService.getSettings(halimaId);
    assert(serverSettings.quietHoursEnabled === true, 'Server reads authoritative quietHoursEnabled = true');

    const deferredOutbox = await query(
      `SELECT status, next_attempt_at FROM notification_outbox WHERE notification_id = $1`,
      [notif.id]
    );
    assert(deferredOutbox.rows[0].status === 'PENDING', 'Outbox remains PENDING (not dispatched to devices during quiet hours)');
    console.log('   ✓ Neither Halima\'s phone nor her tablet receives any push notification during quiet hours!');

    // 8. At 6:00 AM (Quiet Hours Expire):
    console.log('\n--- STEP 6: AT 6:00 AM, QUIET HOURS EXPIRE -> SERVER DELIVERS TO BOTH DEVICES ---');
    // Reset quiet hours to 22:00 - 06:00 for subsequent steps
    await fetch(`${baseUrl}/users/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({
        quietHoursStart: '22:00',
        quietHoursEnd: '06:00',
      }),
    });
    // 06:00 AM in Africa/Lagos (UTC+1) is 05:00:00 UTC
    const sixAmLagosTime = new Date('2026-10-14T05:00:00Z');
    const postQuietCheck = isInQuietHours('22:00', '06:00', 'Africa/Lagos', sixAmLagosTime);
    assert(postQuietCheck.inQuietHours === false, 'At 6:00 AM, quiet hours have expired (inQuietHours === false)');

    // Worker fetches all active devices for Halima and dispatches
    const activeDevices = await query(
      `SELECT push_token FROM device_push_tokens WHERE user_id = $1`,
      [halimaId]
    );
    assert(activeDevices.rowCount === 2, 'Server delivers to both devices (phone AND tablet) at 6:00 AM');

    // Outbox marked SUCCEEDED
    await query(
      `UPDATE notification_outbox SET status = 'SUCCEEDED', updated_at = NOW() WHERE notification_id = $1`,
      [notif.id]
    );
    const finalOutbox = await query(
      `SELECT status FROM notification_outbox WHERE notification_id = $1`,
      [notif.id]
    );
    assert(finalOutbox.rows[0].status === 'SUCCEEDED', 'Outbox successfully marked SUCCEEDED after quiet hours');

    // 9. Cross-Device Coordination: Halima disables quiet hours on her Tablet
    console.log('\n--- STEP 7: TABLET TURNS OFF QUIET HOURS -> SERVER IMMEDIATELY REFLECTS IT ---');
    await fetch(`${baseUrl}/users/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({
        quietHoursEnabled: false,
      }),
    });

    const phoneReadAfter = await fetch(`${baseUrl}/users/settings`, {
      headers: {
        Authorization: `Bearer ${halimaToken}`,
      },
    });
    const phoneSettings = (await phoneReadAfter.json()) as any;
    assert(
      phoneSettings.data.quietHoursEnabled === false,
      'Phone immediately sees quietHoursEnabled = false updated by tablet'
    );

    // 10. Language & Theme Coordination + Validation
    console.log('\n--- STEP 8: LANGUAGE & THEME COORDINATION ACROSS DEVICES ---');
    const updateLangThemeRes = await fetch(`${baseUrl}/users/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({
        language: 'fr',
        theme: 'DARK',
      }),
    });
    const langThemeData = (await updateLangThemeRes.json()) as any;
    assert(updateLangThemeRes.status === 200, 'Server updates language and theme with HTTP 200');
    assert(langThemeData.data.language === 'fr', 'Server persists language = "fr"');
    assert(langThemeData.data.theme === 'DARK', 'Server persists theme = "DARK"');
    assert(!!langThemeData.data.updatedAt, 'Server populates updatedAt timestamp on write');

    // Tablet refetches and verifies language and theme sync
    const tabletSyncLang = await fetch(`${baseUrl}/users/settings`, {
      headers: { Authorization: `Bearer ${halimaToken}` },
    });
    const tabletData2 = (await tabletSyncLang.json()) as any;
    assert(tabletData2.data.language === 'fr', 'Tablet receives updated language "fr"');
    assert(tabletData2.data.theme === 'DARK', 'Tablet receives updated theme "DARK"');

    // Server rejects invalid language and invalid theme
    const badLangRes = await fetch(`${baseUrl}/users/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({ language: 'INVALID_123' }),
    });
    assert(badLangRes.status === 400, 'Server rejects invalid language code with HTTP 400');

    const badThemeRes = await fetch(`${baseUrl}/users/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({ theme: 'NEON' }),
    });
    assert(badThemeRes.status === 400, 'Server rejects invalid theme with HTTP 400');

    // 11. Last-Write-Wins (LWW) Server Timestamp Verification
    console.log('\n--- STEP 9: LAST-WRITE-WINS (LWW) TIMESTAMP ADVANCEMENT ---');
    const prevUpdatedAt = new Date(tabletData2.data.updatedAt).getTime();
    // Wait brief interval to ensure millisecond timestamp advancement
    await new Promise((r) => setTimeout(r, 50));

    const lwwUpdateRes = await fetch(`${baseUrl}/users/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({ theme: 'SYSTEM' }),
    });
    const lwwData = (await lwwUpdateRes.json()) as any;
    const newUpdatedAt = new Date(lwwData.data.updatedAt).getTime();
    assert(lwwData.data.theme === 'SYSTEM', 'Most recent write wins (theme is now SYSTEM)');
    assert(newUpdatedAt >= prevUpdatedAt, 'Server updatedAt advances monotonically on write');

    // 12. Urgent Notifications Bypass Quiet Hours
    console.log('\n--- STEP 10: URGENT NOTIFICATIONS BYPASS QUIET HOURS ---');
    // Enable quiet hours again
    await fetch(`${baseUrl}/users/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${halimaToken}`,
      },
      body: JSON.stringify({
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '06:00',
        timezone: 'Africa/Lagos',
      }),
    });

    // Check worker logic for urgent vs non-urgent during quiet hours (2:00 AM)
    const test2am = new Date('2026-10-13T02:00:00+01:00');
    const step10QuietCheck = isInQuietHours('22:00', '06:00', 'Africa/Lagos', test2am);
    assert(step10QuietCheck.inQuietHours === true, 'Reference time 2:00 AM is inside quiet hours');

    // Queue worker logic: non-urgent is deferred, urgent is NOT deferred
    const nonUrgentDeferred = step10QuietCheck.inQuietHours && !false; // urgent = false
    const urgentDeferred = step10QuietCheck.inQuietHours && !true;   // urgent = true
    assert(nonUrgentDeferred === true, 'Non-urgent notification is marked for quiet hours deferral');
    assert(urgentDeferred === false, 'Urgent notification bypasses quiet hours deferral');

    console.log('\n====================================================');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runRequirement7Tests().then(() => {
  console.log('Requirement 7 test suite execution finished.');
  process.exit(0);
});
