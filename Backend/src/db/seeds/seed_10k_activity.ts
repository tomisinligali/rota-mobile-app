import { pool } from '../pool';

async function seedActivity() {
  const client = await pool.connect();
  try {
    console.log('--- Starting 10,000 Activity Records Seeding ---');

    // 1. Get existing teams and users
    const teamsRes = await client.query('SELECT id, name FROM teams');
    const usersRes = await client.query('SELECT id, first_name, last_name FROM users');

    if (teamsRes.rows.length === 0 || usersRes.rows.length === 0) {
      console.error('No teams or users found. Please ensure users and teams exist.');
      process.exit(1);
    }

    const primaryTeam = teamsRes.rows[0];
    console.log(`Targeting primary team: ${primaryTeam.name} (${primaryTeam.id})`);

    const users = usersRes.rows;
    const actions = [
      'SHIFT_CREATED',
      'SHIFT_PUBLISHED',
      'SHIFT_CANCELLED',
      'SWAP_REQUESTED',
      'SWAP_APPROVED',
      'SWAP_REJECTED',
      'AVAILABILITY_UPDATED',
      'ROSTER_INVITE_SENT',
      'SHIFT_ASSIGNED',
    ];

    const roles = ['Barista', 'Shift Supervisor', 'Cashier', 'Kitchen Prep', 'Floor Lead', 'Server'];

    const totalToSeed = 10500;
    const batchSize = 1000;
    let seeded = 0;

    const baseTime = Date.now();
    // Step backwards in time: ~1 minute per 2-3 events, with some intentional duplicate timestamps
    let currentTime = baseTime;

    console.log(`Seeding ${totalToSeed} activity records in batches of ${batchSize}...`);

    for (let batchStart = 0; batchStart < totalToSeed; batchStart += batchSize) {
      const currentBatchSize = Math.min(batchSize, totalToSeed - batchStart);
      const values: any[] = [];
      const placeholders: string[] = [];

      for (let i = 0; i < currentBatchSize; i++) {
        const actor = users[(batchStart + i) % users.length];
        const action = actions[(batchStart + i) % actions.length];
        const role = roles[(batchStart + i) % roles.length];
        
        // Every 5th item, use the exact same timestamp as the previous item
        // to intentionally create identical timestamps to test tie-breaking on (created_at, id)!
        if (i % 5 !== 0) {
          currentTime -= Math.floor(Math.random() * 60000) + 10000; // 10s - 70s earlier
        }

        const createdAt = new Date(currentTime).toISOString();
        const description = `${action.replace(/_/g, ' ').toLowerCase()} for ${role} by ${actor.first_name}`;
        const details = JSON.stringify({
          role,
          batchIndex: batchStart + i,
          actorName: `${actor.first_name} ${actor.last_name || ''}`.trim(),
        });

        const offset = i * 7;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
        );

        values.push(
          primaryTeam.id,
          actor.id,
          'SHIFT',
          actor.id, // using actor.id as dummy entity_id
          action,
          description,
          details
        );
      }

      // Bulk insert with specific timestamps
      // Note: we inject created_at by appending it to the query
      const insertSql = `
        INSERT INTO activity_logs (team_id, actor_id, entity_type, entity_id, action, description, details, created_at)
        VALUES ${placeholders.map((p, idx) => {
          // Adjust placeholders for 8 columns: 7 parameters + 1 timestamp parameter
          const paramOffset = idx * 8;
          return `($${paramOffset + 1}, $${paramOffset + 2}, $${paramOffset + 3}, $${paramOffset + 4}, $${paramOffset + 5}, $${paramOffset + 6}, $${paramOffset + 7}, $${paramOffset + 8})`;
        }).join(', ')}
      `;

      // Re-map values to include created_at
      const fullValues: any[] = [];
      let timeCursor = currentTime;
      for (let i = 0; i < currentBatchSize; i++) {
        const baseIndex = i * 7;
        if (i % 5 !== 0) {
          timeCursor -= Math.floor(Math.random() * 60000) + 10000;
        }
        fullValues.push(
          values[baseIndex],     // team_id
          values[baseIndex + 1], // actor_id
          values[baseIndex + 2], // entity_type
          values[baseIndex + 3], // entity_id
          values[baseIndex + 4], // action
          values[baseIndex + 5], // description
          values[baseIndex + 6], // details
          new Date(timeCursor).toISOString() // created_at
        );
      }

      await client.query(insertSql, fullValues);
      seeded += currentBatchSize;
      process.stdout.write(`Seeded ${seeded}/${totalToSeed} records...\r`);
    }

    console.log(`\nSuccessfully seeded ${seeded} activity records.`);

    // Check count in database
    const countRes = await client.query('SELECT COUNT(*) FROM activity_logs WHERE team_id = $1', [primaryTeam.id]);
    console.log(`Total activity_logs in database for team ${primaryTeam.name}: ${countRes.rows[0].count}`);

  } catch (err) {
    console.error('Error during seeding:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedActivity()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
