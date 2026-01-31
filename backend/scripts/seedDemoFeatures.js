#!/usr/bin/env node

/**
 * Seed demo data for all new features
 * Run with: node scripts/seedDemoFeatures.js
 */

require('dotenv').config();
const db = require('../src/utils/db');

async function seedDemoFeatures() {
  console.log('Seeding demo feature data...\n');

  try {
    // Get all employees
    const employees = await db.query('SELECT id, first_name, last_name FROM employees WHERE is_active = true');
    console.log(`Found ${employees.rows.length} employees\n`);

    for (const emp of employees.rows) {
      const employeeId = emp.id;
      console.log(`Seeding data for ${emp.first_name} ${emp.last_name}...`);

      // Seed wellness streaks
      const streakDays = Math.floor(Math.random() * 30) + 1;
      await db.query(`
        INSERT INTO wellness_streaks (
          employee_id,
          current_checkin_streak, longest_checkin_streak, last_checkin_date,
          current_sleep_streak, longest_sleep_streak,
          current_exercise_streak, longest_exercise_streak,
          current_green_streak, longest_green_streak,
          total_points, badges
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (employee_id) DO UPDATE SET
          current_checkin_streak = $2,
          longest_checkin_streak = $3,
          last_checkin_date = CURRENT_DATE,
          current_sleep_streak = $4,
          longest_sleep_streak = $5,
          current_exercise_streak = $6,
          longest_exercise_streak = $7,
          current_green_streak = $8,
          longest_green_streak = $9,
          total_points = $10,
          badges = $11,
          updated_at = CURRENT_TIMESTAMP
      `, [
        employeeId,
        streakDays,
        Math.max(streakDays, Math.floor(Math.random() * 45) + 5),
        Math.floor(Math.random() * 20),
        Math.floor(Math.random() * 30) + 10,
        Math.floor(Math.random() * 15),
        Math.floor(Math.random() * 25) + 5,
        Math.floor(Math.random() * 10),
        Math.floor(Math.random() * 20) + 3,
        streakDays * 10 + Math.floor(Math.random() * 500),
        JSON.stringify(streakDays >= 7 ? [{ id: 'week_warrior', name: '7-Day Warrior', earnedAt: new Date().toISOString() }] : [])
      ]);
      console.log('  ✓ Wellness streaks');

      // Seed email metrics for last 14 days
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const emailsSent = Math.floor(Math.random() * 30) + 5;
        const emailsReceived = Math.floor(Math.random() * 50) + 10;
        const outsideHours = Math.floor(Math.random() * 5);

        await db.query(`
          INSERT INTO email_metrics (
            employee_id, date, emails_received, emails_sent, emails_read,
            emails_outside_hours, earliest_email_time, latest_email_time, active_threads
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (employee_id, date) DO UPDATE SET
            emails_received = $3,
            emails_sent = $4,
            emails_read = $5,
            emails_outside_hours = $6,
            updated_at = CURRENT_TIMESTAMP
        `, [
          employeeId, dateStr, emailsReceived, emailsSent,
          Math.floor(emailsReceived * 0.8), outsideHours,
          '08:' + String(Math.floor(Math.random() * 30)).padStart(2, '0'),
          '18:' + String(Math.floor(Math.random() * 60)).padStart(2, '0'),
          emailsSent + emailsReceived
        ]);
      }
      console.log('  ✓ Email metrics (14 days)');

      // Seed detected patterns
      const patterns = [
        { type: 'correlation', title: 'Sleep impacts your productivity', desc: 'When you sleep 7+ hours, your task completion rate increases by 23%', impact: 'positive', confidence: 87 },
        { type: 'trend', title: 'Meeting load increasing', desc: 'Your meeting hours have increased 15% over the past 2 weeks', impact: 'negative', confidence: 92 },
        { type: 'anomaly', title: 'Unusual work pattern detected', desc: 'You worked 3 hours past your normal end time on Tuesday', impact: 'negative', confidence: 95 },
        { type: 'prediction', title: 'Recovery opportunity ahead', desc: 'Your calendar shows lighter meetings next week - great time to catch up on focus work', impact: 'positive', confidence: 78 },
      ];

      const numPatterns = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < numPatterns; i++) {
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        await db.query(`
          INSERT INTO detected_patterns (
            employee_id, pattern_type, title, description,
            confidence, impact, time_period, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, 'weekly', true)
        `, [employeeId, pattern.type, pattern.title, pattern.desc, pattern.confidence, pattern.impact]);
      }
      console.log('  ✓ Detected patterns');

      // Seed predictive alerts (only for some employees)
      if (Math.random() > 0.4) {
        const alertTypes = [
          { type: 'burnout_risk', severity: 'medium', title: 'Burnout risk detected', message: 'Based on your recent patterns, you may be at risk of burnout in the next 2 weeks. Consider taking breaks and reducing overtime.', days: 14 },
          { type: 'declining_trend', severity: 'low', title: 'Sleep quality declining', message: 'Your sleep quality has decreased 15% this week. Try to maintain consistent sleep times.', days: 7 },
          { type: 'recovery_opportunity', severity: 'low', title: 'Great recovery week ahead', message: 'Your schedule looks lighter next week. This is a good opportunity to focus on wellness.', days: 5 },
        ];

        const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        await db.query(`
          INSERT INTO predictive_alerts (
            employee_id, alert_type, severity, title, message,
            confidence, days_until_predicted, recommendations
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          employeeId, alert.type, alert.severity, alert.title, alert.message,
          Math.floor(Math.random() * 20) + 70, alert.days,
          JSON.stringify(['Take regular breaks', 'Prioritize sleep', 'Schedule focus time'])
        ]);
        console.log('  ✓ Predictive alert');
      }

      // Seed zone history for past 30 days
      for (let i = 1; i <= 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const zones = ['green', 'green', 'green', 'yellow', 'yellow', 'red'];
        const zone = zones[Math.floor(Math.random() * zones.length)];
        const burnoutScore = zone === 'red' ? 70 + Math.random() * 30 : zone === 'yellow' ? 40 + Math.random() * 30 : 10 + Math.random() * 30;
        const readinessScore = 100 - burnoutScore + (Math.random() * 20 - 10);

        await db.query(`
          INSERT INTO zone_history (employee_id, date, zone, burnout_score, readiness_score)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (employee_id, date) DO NOTHING
        `, [emp.id, dateStr, zone, burnoutScore, Math.max(0, Math.min(100, readinessScore))]);
      }
      console.log('  ✓ Zone history (30 days)');

      // Seed privacy settings
      await db.query(`
        INSERT INTO privacy_settings (employee_id)
        VALUES ($1)
        ON CONFLICT (employee_id) DO NOTHING
      `, [employeeId]);
      console.log('  ✓ Privacy settings');
    }

    // Seed meeting suggestions for managers
    console.log('\nSeeding meeting suggestions...');
    const managers = await db.query(`
      SELECT e.id, e.first_name, e.last_name FROM employees e
      JOIN users u ON e.user_id = u.id
      WHERE u.role = 'manager' AND e.is_active = true
    `);

    // If no managers found, pick the first employee as a pseudo-manager
    let managerList = managers.rows;
    if (managerList.length === 0 && employees.rows.length > 0) {
      managerList = [employees.rows[0]];
      console.log(`No managers found, using ${managerList[0].first_name} as pseudo-manager`);
    }

    for (const manager of managerList) {
      // Assign some employees to this manager
      const teamSize = Math.min(3, employees.rows.length - 1);
      const teamMembers = employees.rows.filter(e => e.id !== manager.id).slice(0, teamSize);

      for (const member of teamMembers) {
        // Set manager relationship
        await db.query(`
          UPDATE employees SET manager_id = $1 WHERE id = $2
        `, [manager.id, member.id]);

        const reasons = ['declining_wellness', 'needs_support', 'celebrate_success', 'routine_checkin'];
        const urgencies = ['low', 'normal', 'high'];

        const suggestedTimes = [];
        for (let i = 0; i < 3; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i + 1);
          date.setHours(10 + i * 2, 0, 0, 0);
          suggestedTimes.push({
            start: date.toISOString(),
            end: new Date(date.getTime() + 30 * 60000).toISOString()
          });
        }

        await db.query(`
          INSERT INTO meeting_suggestions (
            manager_id, employee_id, suggested_reason, urgency, suggested_times, status
          ) VALUES ($1, $2, $3, $4, $5, 'pending')
        `, [
          manager.id, member.id,
          reasons[Math.floor(Math.random() * reasons.length)],
          urgencies[Math.floor(Math.random() * urgencies.length)],
          JSON.stringify(suggestedTimes)
        ]);
      }
      console.log(`  ✓ Meeting suggestions for ${manager.first_name} ${manager.last_name} (${teamMembers.length} team members)`);
    }

    // Seed wellness resources
    console.log('\nSeeding wellness resources...');
    const resources = [
      { title: '5-Minute Breathing Exercise', desc: 'A quick breathing exercise to reduce stress and anxiety', type: 'exercise', cat: 'stress', dur: 5, diff: 'beginner', content: '1. Sit comfortably with your back straight\n2. Breathe in slowly through your nose for 4 counts\n3. Hold your breath for 4 counts\n4. Exhale slowly through your mouth for 6 counts\n5. Repeat 5-10 times' },
      { title: 'Sleep Hygiene Guide', desc: 'Tips for improving your sleep quality', type: 'article', cat: 'sleep', dur: 10, diff: 'beginner', content: 'Key tips for better sleep:\n\n1. Stick to a consistent sleep schedule\n2. Create a restful environment (dark, quiet, cool)\n3. Limit screen time 1 hour before bed\n4. Avoid caffeine after 2pm\n5. Exercise regularly but not too close to bedtime' },
      { title: 'Quick Desk Stretches', desc: 'Simple stretches you can do at your desk to relieve tension', type: 'exercise', cat: 'exercise', dur: 5, diff: 'beginner', content: '1. Neck rolls: Gently roll your head in circles\n2. Shoulder shrugs: Raise shoulders to ears, hold 3 seconds\n3. Wrist circles: Rotate wrists in both directions\n4. Seated spinal twist: Turn torso left and right' },
      { title: 'Mindful Morning Routine', desc: 'Start your day with intention and clarity', type: 'meditation', cat: 'mindfulness', dur: 15, diff: 'intermediate', content: 'A mindful morning routine:\n\n1. Wake up without hitting snooze\n2. Take 5 deep breaths before getting up\n3. Stretch gently for 2-3 minutes\n4. Practice gratitude - think of 3 things' },
      { title: 'Pomodoro Technique Guide', desc: 'Boost your productivity with timed focus sessions', type: 'article', cat: 'productivity', dur: 5, diff: 'beginner', content: 'The Pomodoro Technique:\n\n1. Choose a task to work on\n2. Set a timer for 25 minutes\n3. Work on the task until the timer rings\n4. Take a 5-minute break\n5. After 4 pomodoros, take a longer 15-30 minute break' },
      { title: 'Healthy Snacks for Energy', desc: 'Nutritious snack ideas to maintain energy levels throughout the day', type: 'article', cat: 'nutrition', dur: 5, diff: 'beginner', content: 'Top energy-boosting snacks:\n\n1. Apple slices with almond butter\n2. Greek yogurt with berries\n3. Mixed nuts and dried fruit\n4. Hummus with veggie sticks' },
      { title: 'Body Scan Meditation', desc: 'A relaxation technique to release physical tension', type: 'meditation', cat: 'mindfulness', dur: 20, diff: 'intermediate', content: 'Body Scan Meditation:\n\n1. Lie down or sit comfortably\n2. Close your eyes and take deep breaths\n3. Focus attention on your feet\n4. Notice any sensations without judgment\n5. Slowly move attention up through your body' },
      { title: 'Managing Work Stress', desc: 'Strategies for handling workplace stress effectively', type: 'article', cat: 'stress', dur: 10, diff: 'intermediate', content: 'Workplace stress management:\n\n1. Identify your stress triggers\n2. Set boundaries between work and personal life\n3. Break large projects into smaller tasks\n4. Communicate openly with your manager\n5. Take regular breaks during the day' },
    ];

    for (const r of resources) {
      await db.query(`
        INSERT INTO wellness_resources (title, description, content_type, category, content, duration_minutes, difficulty, tags, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        ON CONFLICT DO NOTHING
      `, [r.title, r.desc, r.type, r.cat, r.content, r.dur, r.diff, []]);
    }
    console.log(`  ✓ ${resources.length} wellness resources seeded`);

    console.log('\n✅ Demo feature data seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error seeding demo data:', err);
    process.exit(1);
  }
}

seedDemoFeatures();
