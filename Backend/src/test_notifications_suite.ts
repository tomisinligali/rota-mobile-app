import http from 'http';
import app from './index';
import { query } from './db/pool';
import { NotificationsService } from './domains/notifications/notifications.service';
import { PushService } from './domains/notifications/push.service';
import {
  isInQuietHours,
  isNotificationTypeAllowed,
} from './domains/notifications/queue';
import { UsersService } from './domains/users/users.service';

async function runNotificationTests() {
  console.log('====================================================');
  console.log('   ROTA REQUIREMENT 6: PUSH NOTIFICATIONS SUITE    ');
  console.log('====================================================\n');

  // Start ephemeral test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  console.log(`Ephemeral test API listening on ${baseUrl}\n`);

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
    const userAEmail = `user_notif_a_${timestamp}@example.com`;
    const userBEmail = `user_notif_b_${timestamp}@example.com`;
    const password = 'Password123#';

    // 1. Create Test User A
    const regARes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userAEmail,
        password,
        firstName: 'Alice',
        lastName: 'Device',
      }),
    });
    const userAData = (await regARes.json()) as any;
    const tokenA = userAData.data.token;
    const userAId = userAData.data.user.id;

    // 2. Create Test User B
    const regBRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userBEmail,
        password,
        firstName: 'Bob',
        lastName: 'Device',
      }),
    });
    const userBData = (await regBRes.json()) as any;
    const tokenB = userBData.data.token;
    const userBId = userBData.data.user.id;

    console.log('\n--- TEST GROUP 1: MULTI-DEVICE TOKEN REGISTRATION ---');

    // Register Device 1 (iPhone) for User A
    const regDev1Res = await fetch(`${baseUrl}/notifications/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        pushToken: 'ExponentPushToken[device1_userA]',
        deviceId: 'device-iphone-15',
        deviceType: 'ios',
        deviceName: 'Alice iPhone 15',
      }),
    });
    assert(regDev1Res.status === 200, 'Register Device 1 for User A returns 200');

    // Register Device 2 (iPad) for User A (One user can have multiple devices)
    const regDev2Res = await fetch(`${baseUrl}/notifications/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        pushToken: 'ExponentPushToken[device2_userA]',
        deviceId: 'device-ipad-pro',
        deviceType: 'ios',
        deviceName: 'Alice iPad Pro',
      }),
    });
    assert(regDev2Res.status === 200, 'Register Device 2 for User A returns 200');

    // Verify User A has 2 distinct active devices stored on the server
    const tokensResA = await query(
      `SELECT device_id, push_token, device_name FROM device_push_tokens WHERE user_id = $1 ORDER BY device_id`,
      [userAId]
    );
    assert(tokensResA.rowCount === 2, 'User A has exactly 2 distinct device records');
    assert(tokensResA.rows[0].device_id === 'device-ipad-pro', 'Device 2 (iPad) stored correctly');
    assert(tokensResA.rows[1].device_id === 'device-iphone-15', 'Device 1 (iPhone) stored correctly');

    // Update push token on Device 1 (e.g. token refreshed by OS)
    await fetch(`${baseUrl}/notifications/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        pushToken: 'ExponentPushToken[device1_userA_refreshed]',
        deviceId: 'device-iphone-15',
        deviceType: 'ios',
      }),
    });
    const refreshedRes = await query(
      `SELECT push_token FROM device_push_tokens WHERE user_id = $1 AND device_id = 'device-iphone-15'`,
      [userAId]
    );
    assert(
      refreshedRes.rows[0].push_token === 'ExponentPushToken[device1_userA_refreshed]',
      'Token update for existing device_id updates push_token cleanly without duplicate'
    );

    // Unregister Device 2 (e.g. user logged out from iPad)
    const unregRes = await fetch(`${baseUrl}/notifications/push-token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        deviceId: 'device-ipad-pro',
      }),
    });
    assert(unregRes.status === 200, 'Unregistering device on logout returns 200');
    const remainingRes = await query(
      `SELECT device_id FROM device_push_tokens WHERE user_id = $1`,
      [userAId]
    );
    assert(
      remainingRes.rowCount === 1 && remainingRes.rows[0].device_id === 'device-iphone-15',
      'Device 2 is deleted from database after unregister'
    );

    console.log('\n--- TEST GROUP 2: DEEP LINKING NOTIFICATION PAYLOADS ---');

    // Create shift notification -> should auto-enrich with screen: 'shifts'
    const shiftNotif = await NotificationsService.createNotification({
      userId: userAId,
      type: 'SHIFT_CREATED',
      title: 'New Shift Scheduled',
      body: 'You have a shift on Monday',
      data: { shiftId: 'shift-123' },
    });
    assert(shiftNotif.data.screen === 'shifts', 'Shift notification auto-populates screen: "shifts"');
    assert(shiftNotif.data.shiftId === 'shift-123', 'Shift ID preserved in payload');

    // Create swap notification -> should auto-enrich with screen: 'swaps'
    const swapNotif = await NotificationsService.createNotification({
      userId: userAId,
      type: 'SWAP_REQUESTED',
      title: 'Shift Swap Proposed',
      body: 'Someone proposed a swap',
      data: { swapId: 'swap-456' },
    });
    assert(swapNotif.data.screen === 'swaps', 'Swap notification auto-populates screen: "swaps"');

    // Create billing notification -> should auto-enrich with screen: 'profile', subTab: 'billing'
    const billingNotif = await NotificationsService.createNotification({
      userId: userAId,
      type: 'PAYMENT_SUCCEEDED',
      title: 'Invoice Paid',
      body: 'Your subscription renewed',
      data: { invoiceId: 'inv-789' },
    });
    assert(billingNotif.data.screen === 'profile', 'Billing notification auto-populates screen: "profile"');
    assert(billingNotif.data.subTab === 'billing', 'Billing notification auto-populates subTab: "billing"');

    console.log('\n--- TEST GROUP 3: NOTIFICATION TYPE GROUPING PREFERENCES ---');

    // Turn off shift changes and billing, keep swaps on
    await UsersService.updateSettings(userAId, {
      notifyShiftChanges: false,
      notifySwaps: true,
      notifyBilling: false,
    });
    const updatedSettings = await UsersService.getSettings(userAId);
    assert(updatedSettings.notifyShiftChanges === false, 'Setting notifyShiftChanges is false');
    assert(updatedSettings.notifySwaps === true, 'Setting notifySwaps is true');
    assert(updatedSettings.notifyBilling === false, 'Setting notifyBilling is false');

    // Evaluate preference filtering logic
    const allowShift = isNotificationTypeAllowed('SHIFT_CREATED', {
      push_notifications: true,
      notify_shift_changes: false,
      notify_swaps: true,
      notify_billing: false,
    });
    assert(allowShift === false, 'Shift notification is suppressed when notify_shift_changes is false');

    const allowSwap = isNotificationTypeAllowed('SWAP_REQUESTED', {
      push_notifications: true,
      notify_shift_changes: false,
      notify_swaps: true,
      notify_billing: false,
    });
    assert(allowSwap === true, 'Swap notification is allowed when notify_swaps is true');

    const allowBilling = isNotificationTypeAllowed('PAYMENT_SUCCEEDED', {
      push_notifications: true,
      notify_shift_changes: false,
      notify_swaps: true,
      notify_billing: false,
    });
    assert(allowBilling === false, 'Billing notification is suppressed when notify_billing is false');

    console.log('\n--- TEST GROUP 4: QUIET HOURS & TIMEZONES ---');

    // Case A: Test overnight quiet window 22:00 to 08:00
    // If current time in London is 23:00, it's inside quiet hours.
    // We test isInQuietHours function with known values.
    const quietWindowA = isInQuietHours('22:00', '08:00', 'Europe/London');
    assert(typeof quietWindowA.inQuietHours === 'boolean', 'isInQuietHours returns boolean flag');
    assert(typeof quietWindowA.msUntilEnd === 'number', 'isInQuietHours returns msUntilEnd');

    // Case B: Window that definitely includes current time (00:00 to 23:59)
    const alwaysQuiet = isInQuietHours('00:00', '23:59', 'UTC');
    assert(alwaysQuiet.inQuietHours === true, 'Window 00:00-23:59 correctly evaluates to inQuietHours === true');
    assert(alwaysQuiet.msUntilEnd > 0, 'msUntilEnd is strictly positive');

    // Case C: Window that does NOT include current time
    // If we pick a 1-minute window in the past or far future, e.g. 03:00-03:01 when now is not 03:00
    // Let's verify startMinutes == endMinutes or non-matching daytime
    const neverQuiet = isInQuietHours('04:00', '04:00', 'UTC');
    assert(neverQuiet.inQuietHours === false, 'Non-matching quiet window evaluates to false');

    console.log('\n--- TEST GROUP 5: INVALID TOKEN DETECTION & DELETION ---');

    // Register a mock invalid token for User B
    const badToken = 'ExponentPushToken[definitely_invalid_token_12345]';
    await query(
      `INSERT INTO device_push_tokens (user_id, push_token, device_id, device_type)
       VALUES ($1, $2, 'bad-device', 'ios')
       ON CONFLICT DO NOTHING`,
      [userBId, badToken]
    );

    const tokenExistsBefore = await query(
      `SELECT id FROM device_push_tokens WHERE push_token = $1`,
      [badToken]
    );
    assert(tokenExistsBefore.rowCount === 1, 'Bad token initially exists in database');

    // Simulate push service invalid token report
    const delResult = await NotificationsService.deleteInvalidPushTokens([badToken]);
    assert(delResult.deletedCount === 1, 'deleteInvalidPushTokens deletes 1 token');

    const tokenExistsAfter = await query(
      `SELECT id FROM device_push_tokens WHERE push_token = $1`,
      [badToken]
    );
    assert(tokenExistsAfter.rowCount === 0, 'Invalid token was deleted from database');

    console.log('\n====================================================');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test suite uncaught error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runNotificationTests().then(() => {
  console.log('Notifications test suite execution finished.');
  process.exit(0);
});
