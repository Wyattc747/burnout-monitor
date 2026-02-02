
/**
 * Database Seed Script
 * Populates the database with demo users and synthetic data
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../src/utils/db');
const { generateAllDemoData, EMPLOYEE_PROFILES } = require('../src/services/syntheticDataGenerator');
const { calculateEmployeeScores } = require('../src/services/scoringEngine');

const DEMO_PASSWORD = 'demo123';

async function seed() {
  console.log('Starting database seed...\n');

  try {
    // Clear existing data
    console.log('Clearing existing data...');
    await db.query('DELETE FROM sms_logs');
    await db.query('DELETE FROM alerts');
    await db.query('DELETE FROM zone_history');
    await db.query('DELETE FROM work_metrics');
    await db.query('DELETE FROM health_metrics');
    await db.query('DELETE FROM employee_baselines');
    await db.query('DELETE FROM notification_preferences');
    await db.query('DELETE FROM employees');
    await db.query('DELETE FROM users');

    // Reset demo state
    await db.query('UPDATE demo_state SET is_active = false, virtual_time = NULL WHERE id = 1');

    // Hash password once for all demo users
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    // Create manager user
    console.log('Creating manager user...');
    const managerResult = await db.query(`
      INSERT INTO users (email, password_hash, role)
      VALUES ($1, $2, 'manager')
      RETURNING id
    `, ['manager@demo.com', passwordHash]);
    const managerId = managerResult.rows[0].id;

    // Create manager employee record
    const managerEmpResult = await db.query(`
      INSERT INTO employees (user_id, first_name, last_name, email, department, job_title, hire_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [managerId, 'Demo', 'Manager', 'manager@demo.com', 'Engineering', 'Engineering Manager', '2022-03-01']);
    const managerEmployeeId = managerEmpResult.rows[0].id;

    // Set up manager notification preferences
    await db.query(`
      INSERT INTO notification_preferences (user_id, sms_enabled, sms_on_burnout, sms_on_opportunity)
      VALUES ($1, true, true, true)
    `, [managerId]);

    console.log('  Created manager@demo.com (Demo Manager)');

    // Generate all demo data
    console.log('\nGenerating synthetic data for 5 employees...');
    const allData = generateAllDemoData(30);

    // Create employees
    for (const empData of allData) {
      const profile = empData.profile;

      // Create user for employee
      const userResult = await db.query(`
        INSERT INTO users (email, password_hash, role)
        VALUES ($1, $2, 'employee')
        RETURNING id
      `, [profile.email, passwordHash]);
      const userId = userResult.rows[0].id;

      // Create employee record (assign to manager)
      const empResult = await db.query(`
        INSERT INTO employees (user_id, first_name, last_name, email, department, job_title, hire_date, manager_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [userId, profile.firstName, profile.lastName, profile.email, profile.department, profile.jobTitle, '2023-01-15', managerEmployeeId]);
      const employeeId = empResult.rows[0].id;

      console.log(`  Created ${profile.firstName} ${profile.lastName} (${profile.email}) - ${empData.profileKey}`);

      // Insert health metrics
      for (const health of empData.healthData) {
        await db.query(`
          INSERT INTO health_metrics (
            employee_id, date, resting_heart_rate, avg_heart_rate, max_heart_rate,
            heart_rate_variability, sleep_hours, sleep_quality_score, deep_sleep_hours,
            rem_sleep_hours, core_sleep_hours, awake_sleep_hours, steps, active_calories, exercise_minutes, standing_hours
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (employee_id, date) DO NOTHING
        `, [
          employeeId, health.date, health.restingHeartRate, health.avgHeartRate, health.maxHeartRate,
          health.heartRateVariability, health.sleepHours, health.sleepQualityScore, health.deepSleepHours,
          health.remSleepHours, health.coreSleepHours, health.awakeSleepHours, health.steps, health.activeCalories, health.exerciseMinutes, health.standingHours,
        ]);
      }

      // Insert work metrics
      for (const work of empData.workData) {
        await db.query(`
          INSERT INTO work_metrics (
            employee_id, date, hours_worked, overtime_hours, break_minutes,
            first_login_time, last_logout_time, tasks_completed, tasks_assigned,
            meetings_attended, meeting_hours, emails_sent, emails_received,
            avg_response_time_minutes, messages_sent, focus_time_hours, context_switches
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (employee_id, date) DO NOTHING
        `, [
          employeeId, work.date, work.hoursWorked, work.overtimeHours, work.breakMinutes,
          work.firstLoginTime, work.lastLogoutTime, work.tasksCompleted, work.tasksAssigned,
          work.meetingsAttended, work.meetingHours, work.emailsSent, work.emailsReceived,
          work.avgResponseTimeMinutes, work.messagesSent, work.focusTimeHours, work.contextSwitches,
        ]);
      }

      // Insert baselines
      const baselines = empData.baselines;
      await db.query(`
        INSERT INTO employee_baselines (
          employee_id, baseline_resting_hr, baseline_hrv, baseline_sleep_hours,
          baseline_sleep_quality, baseline_steps, baseline_hours_worked,
          baseline_tasks_completed, baseline_response_time, last_calculated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        employeeId, baselines.baselineRestingHr, baselines.baselineHrv, baselines.baselineSleepHours,
        baselines.baselineSleepQuality, baselines.baselineSteps, baselines.baselineHoursWorked,
        baselines.baselineTasksCompleted, baselines.baselineResponseTime,
      ]);

      // Calculate and store zone history for recent days
      console.log(`    Calculating zone history...`);
      for (let i = 0; i < Math.min(7, empData.healthData.length); i++) {
        const health = empData.healthData[i];
        const work = empData.workData[i];

        const healthInput = {
          sleepHours: health.sleepHours,
          sleepQualityScore: health.sleepQualityScore,
          heartRateVariability: health.heartRateVariability,
          restingHeartRate: health.restingHeartRate,
          deepSleepHours: health.deepSleepHours,
          exerciseMinutes: health.exerciseMinutes,
          recoveryScore: 70,
        };

        const workInput = {
          hoursWorked: work.hoursWorked,
          overtimeHours: work.overtimeHours,
          tasksCompleted: work.tasksCompleted,
          tasksAssigned: work.tasksAssigned,
          meetingsAttended: work.meetingsAttended,
        };

        const baselinesInput = {
          baselineSleepHours: baselines.baselineSleepHours,
          baselineSleepQuality: baselines.baselineSleepQuality,
          baselineHrv: baselines.baselineHrv,
          baselineRestingHr: baselines.baselineRestingHr,
          baselineHoursWorked: baselines.baselineHoursWorked,
        };

        const scores = calculateEmployeeScores(healthInput, workInput, baselinesInput);

        // Get previous zone
        const prevZoneResult = await db.query(`
          SELECT zone FROM zone_history
          WHERE employee_id = $1 AND date < $2
          ORDER BY date DESC LIMIT 1
        `, [employeeId, health.date]);
        const previousZone = prevZoneResult.rows.length > 0 ? prevZoneResult.rows[0].zone : 'yellow';

        await db.query(`
          INSERT INTO zone_history (
            employee_id, date, burnout_score, readiness_score, zone,
            previous_zone, zone_changed, explanation
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (employee_id, date) DO NOTHING
        `, [
          employeeId, health.date, scores.burnoutScore, scores.readinessScore,
          scores.zone, previousZone, scores.zone !== previousZone, JSON.stringify(scores.explanation),
        ]);
      }

      // Set up employee notification preferences
      await db.query(`
        INSERT INTO notification_preferences (user_id, sms_enabled, sms_on_burnout, sms_on_opportunity)
        VALUES ($1, false, true, true)
      `, [userId]);

      // Get the latest zone for this employee
      const latestZone = await db.query(`
        SELECT zone, burnout_score FROM zone_history
        WHERE employee_id = $1
        ORDER BY date DESC LIMIT 1
      `, [employeeId]);

      const currentZone = latestZone.rows[0]?.zone || 'yellow';
      const burnoutScore = latestZone.rows[0]?.burnout_score || 50;

      // Create predictive alerts based on zone
      if (currentZone === 'red' || burnoutScore > 65) {
        await db.query(`
          INSERT INTO predictive_alerts (
            employee_id, alert_type, severity, title, message,
            confidence, days_until_predicted, recommendations, is_acknowledged
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        `, [
          employeeId,
          'burnout_risk',
          'high',
          'Burnout Risk Detected',
          `Based on recent patterns, ${profile.firstName} shows elevated burnout indicators. Sleep quality and work hours suggest intervention may be needed.`,
          0.85,
          7,
          JSON.stringify([
            'Schedule a 1:1 check-in',
            'Review current workload and priorities',
            'Encourage taking PTO if available',
            'Consider redistributing urgent tasks'
          ])
        ]);
      } else if (currentZone === 'yellow') {
        await db.query(`
          INSERT INTO predictive_alerts (
            employee_id, alert_type, severity, title, message,
            confidence, days_until_predicted, recommendations, is_acknowledged
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        `, [
          employeeId,
          'declining_trend',
          'medium',
          'Declining Wellness Trend',
          `${profile.firstName}'s wellness metrics have been gradually declining over the past week. Early intervention recommended.`,
          0.72,
          14,
          JSON.stringify([
            'Monitor sleep patterns',
            'Check in about workload',
            'Suggest wellness resources'
          ])
        ]);
      } else {
        await db.query(`
          INSERT INTO predictive_alerts (
            employee_id, alert_type, severity, title, message,
            confidence, days_until_predicted, recommendations, is_acknowledged
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
        `, [
          employeeId,
          'recovery_opportunity',
          'low',
          'Peak Performance Window',
          `${profile.firstName} is in an optimal state. This is a great time for challenging projects or learning opportunities.`,
          0.90,
          null,
          JSON.stringify([
            'Assign stretch goals',
            'Encourage mentoring others',
            'Consider high-visibility projects'
          ])
        ]);
      }

      // Create detected patterns
      const patternTypes = [
        {
          type: 'correlation',
          title: 'Sleep-Productivity Correlation',
          description: `${profile.firstName}'s productivity increases by 23% on days following 7+ hours of sleep.`,
          factors: ['sleep_hours', 'tasks_completed'],
          impact: 'positive'
        },
        {
          type: 'trend',
          title: 'Meeting Load Increasing',
          description: `Meeting hours have increased 15% over the past 2 weeks, potentially impacting focus time.`,
          factors: ['meeting_hours', 'focus_time'],
          impact: 'negative'
        },
        {
          type: 'anomaly',
          title: 'Unusual Work Hours Pattern',
          description: `${profile.firstName} has been logging in earlier and staying later than their baseline.`,
          factors: ['first_login_time', 'last_logout_time'],
          impact: 'negative'
        },
        {
          type: 'prediction',
          title: 'Recovery Predicted',
          description: `Based on improving sleep metrics, wellness score expected to improve within 5 days.`,
          factors: ['sleep_quality', 'hrv'],
          impact: 'positive'
        }
      ];

      // Add 1-2 random patterns per employee
      const numPatterns = Math.floor(Math.random() * 2) + 1;
      const shuffledPatterns = patternTypes.sort(() => Math.random() - 0.5).slice(0, numPatterns);

      for (const pattern of shuffledPatterns) {
        await db.query(`
          INSERT INTO detected_patterns (
            employee_id, pattern_type, title, description, factors,
            confidence, impact, time_period, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        `, [
          employeeId,
          pattern.type,
          pattern.title,
          pattern.description,
          JSON.stringify(pattern.factors),
          (Math.random() * 0.3 + 0.65).toFixed(2),
          pattern.impact,
          '14 days',
        ]);
      }

      // Create meeting suggestion for manager
      const urgencyByZone = { red: 'urgent', yellow: 'normal', green: 'low' };
      const reasonByZone = {
        red: `${profile.firstName} is showing burnout indicators and may benefit from support.`,
        yellow: `Regular check-in recommended for ${profile.firstName} to maintain wellness.`,
        green: `${profile.firstName} is performing well - great time to discuss growth opportunities.`
      };

      // Generate suggested meeting times (next 3 business days at 10am, 2pm, 4pm)
      const suggestedTimes = [];
      const now = new Date();
      let daysAdded = 0;
      while (suggestedTimes.length < 3 && daysAdded < 7) {
        const date = new Date(now);
        date.setDate(date.getDate() + daysAdded + 1);
        if (date.getDay() !== 0 && date.getDay() !== 6) {
          suggestedTimes.push(new Date(date.setHours(10, 0, 0, 0)).toISOString());
          if (suggestedTimes.length < 3) {
            suggestedTimes.push(new Date(date.setHours(14, 0, 0, 0)).toISOString());
          }
        }
        daysAdded++;
      }

      await db.query(`
        INSERT INTO meeting_suggestions (
          manager_id, employee_id, suggested_reason, urgency,
          suggested_times, status
        ) VALUES ($1, $2, $3, $4, $5, 'pending')
      `, [
        managerEmployeeId,
        employeeId,
        reasonByZone[currentZone],
        urgencyByZone[currentZone],
        JSON.stringify(suggestedTimes)
      ]);

      console.log(`    Added alerts, patterns, and meeting suggestions`);
    }

    console.log('\n✅ Database seeded successfully!');
    console.log('\nDemo accounts (password: demo123):');
    console.log('  Manager:  manager@demo.com (Demo Manager)');
    console.log('  Employee: wyatt@demo.com (Wyatt Cooper - Peak Performer)');
    console.log('  Employee: woody@demo.com (Woody Klemetson - Moderate Stress)');
    console.log('  Employee: robert@demo.com (Robert Henderson - High Burnout)');
    console.log('  Employee: ben@demo.com (Ben Harrison - Recovery)');
    console.log('  Employee: andrew@demo.com (Andrew Brown - Variable)');
    console.log('  Employee: emily@demo.com (Emily Chen - New Hire)');
    console.log('  Employee: marcus@demo.com (Marcus Williams - Remote Senior)');

  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

seed();
