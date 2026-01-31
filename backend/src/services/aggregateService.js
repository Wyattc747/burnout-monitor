/**
 * Aggregate Service
 * Privacy-preserving team wellness aggregates with minimum team size requirements
 */

const db = require('../utils/db');

const MIN_AGGREGATE_SIZE = 5;

/**
 * Get team aggregates with privacy protection
 * Returns aggregated wellness data only if team meets minimum size requirement
 */
async function getTeamAggregates(managerId) {
  // Get team size
  const sizeResult = await db.query(`
    SELECT COUNT(*) as count
    FROM employees
    WHERE manager_id = $1 AND is_active = true
  `, [managerId]);

  const teamSize = parseInt(sizeResult.rows[0].count);

  if (teamSize < MIN_AGGREGATE_SIZE) {
    return {
      error: 'Team too small for aggregate view (privacy protection)',
      teamSize,
      minimumRequired: MIN_AGGREGATE_SIZE,
      privacyNote: `Aggregate views require at least ${MIN_AGGREGATE_SIZE} team members to protect individual privacy.`,
    };
  }

  // Get zone distribution
  const zoneResult = await db.query(`
    SELECT
      COALESCE(zh.zone, 'yellow') as zone,
      COUNT(*) as count
    FROM employees e
    LEFT JOIN LATERAL (
      SELECT zone
      FROM zone_history
      WHERE employee_id = e.id
      ORDER BY date DESC
      LIMIT 1
    ) zh ON true
    WHERE e.manager_id = $1 AND e.is_active = true
    GROUP BY zh.zone
  `, [managerId]);

  const zones = { red: 0, yellow: 0, green: 0 };
  zoneResult.rows.forEach(row => {
    zones[row.zone] = parseInt(row.count);
  });

  // Get burnout score distribution (bucketed for privacy)
  const burnoutResult = await db.query(`
    SELECT
      CASE
        WHEN zh.burnout_score < 40 THEN 'low'
        WHEN zh.burnout_score < 70 THEN 'moderate'
        ELSE 'high'
      END as bucket,
      COUNT(*) as count
    FROM employees e
    LEFT JOIN LATERAL (
      SELECT burnout_score
      FROM zone_history
      WHERE employee_id = e.id
      ORDER BY date DESC
      LIMIT 1
    ) zh ON true
    WHERE e.manager_id = $1 AND e.is_active = true
      AND zh.burnout_score IS NOT NULL
    GROUP BY bucket
  `, [managerId]);

  const burnoutDistribution = { low: 0, moderate: 0, high: 0 };
  burnoutResult.rows.forEach(row => {
    burnoutDistribution[row.bucket] = parseInt(row.count);
  });

  // Get weekly trend (last 4 weeks)
  const trendResult = await db.query(`
    WITH weekly_data AS (
      SELECT
        DATE_TRUNC('week', zh.date) as week,
        AVG(zh.burnout_score) as avg_burnout,
        AVG(zh.readiness_score) as avg_readiness,
        COUNT(DISTINCT zh.employee_id) as employee_count
      FROM zone_history zh
      JOIN employees e ON zh.employee_id = e.id
      WHERE e.manager_id = $1
        AND e.is_active = true
        AND zh.date >= CURRENT_DATE - INTERVAL '4 weeks'
      GROUP BY DATE_TRUNC('week', zh.date)
      HAVING COUNT(DISTINCT zh.employee_id) >= $2
    )
    SELECT * FROM weekly_data
    ORDER BY week DESC
    LIMIT 4
  `, [managerId, MIN_AGGREGATE_SIZE]);

  const weeklyTrend = trendResult.rows.map(row => ({
    week: row.week,
    avgBurnout: row.avg_burnout ? Math.round(parseFloat(row.avg_burnout)) : null,
    avgReadiness: row.avg_readiness ? Math.round(parseFloat(row.avg_readiness)) : null,
    employeeCount: parseInt(row.employee_count),
  }));

  // Calculate overall trend direction
  let trendDirection = 'stable';
  if (weeklyTrend.length >= 2) {
    const recent = weeklyTrend[0]?.avgBurnout;
    const previous = weeklyTrend[1]?.avgBurnout;
    if (recent && previous) {
      if (recent > previous + 5) trendDirection = 'worsening';
      else if (recent < previous - 5) trendDirection = 'improving';
    }
  }

  // Get interaction effect prevalence (how many have active interactions)
  const interactionResult = await db.query(`
    SELECT COUNT(*) as count
    FROM employees e
    JOIN LATERAL (
      SELECT burnout_score, readiness_score
      FROM zone_history
      WHERE employee_id = e.id
      ORDER BY date DESC
      LIMIT 1
    ) zh ON true
    WHERE e.manager_id = $1
      AND e.is_active = true
      AND zh.burnout_score >= 50
  `, [managerId]);

  const elevatedStressCount = parseInt(interactionResult.rows[0].count);

  return {
    teamSize,
    zoneDistribution: zones,
    burnoutDistribution,
    weeklyTrend,
    trendDirection,
    elevatedStressCount,
    elevatedStressPercentage: Math.round((elevatedStressCount / teamSize) * 100),
    privacyNote: 'Individual scores not shown. All data aggregated across team.',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get aggregate wellness overview for a team
 * Returns a simplified view focused on action items
 */
async function getWellnessOverview(managerId) {
  const aggregates = await getTeamAggregates(managerId);

  if (aggregates.error) {
    return aggregates;
  }

  // Calculate team health score (0-100)
  const totalMembers = aggregates.teamSize;
  const greenWeight = 100;
  const yellowWeight = 60;
  const redWeight = 20;

  const teamHealthScore = Math.round(
    (aggregates.zoneDistribution.green * greenWeight +
     aggregates.zoneDistribution.yellow * yellowWeight +
     aggregates.zoneDistribution.red * redWeight) / totalMembers
  );

  // Generate action items
  const actionItems = [];

  if (aggregates.zoneDistribution.red > 0) {
    actionItems.push({
      priority: 'high',
      type: 'attention',
      message: `${aggregates.zoneDistribution.red} team member(s) in red zone`,
      action: 'Consider scheduling 1:1 check-ins with affected team members',
    });
  }

  if (aggregates.trendDirection === 'worsening') {
    actionItems.push({
      priority: 'medium',
      type: 'trend',
      message: 'Team burnout trend is worsening',
      action: 'Review workload distribution and upcoming deadlines',
    });
  }

  if (aggregates.elevatedStressPercentage > 50) {
    actionItems.push({
      priority: 'medium',
      type: 'widespread',
      message: `${aggregates.elevatedStressPercentage}% of team showing elevated stress`,
      action: 'Consider team-wide interventions like reduced meetings or flexible hours',
    });
  }

  if (aggregates.zoneDistribution.green > totalMembers * 0.6) {
    actionItems.push({
      priority: 'low',
      type: 'positive',
      message: 'Majority of team in green zone',
      action: 'Good time for stretch assignments or new initiatives',
    });
  }

  return {
    teamHealthScore,
    teamSize: aggregates.teamSize,
    zoneDistribution: aggregates.zoneDistribution,
    trend: aggregates.trendDirection,
    actionItems,
    privacyNote: aggregates.privacyNote,
    generatedAt: aggregates.generatedAt,
  };
}

/**
 * Check if employee has consented to aggregate contribution
 */
async function checkAggregateConsent(employeeId) {
  const result = await db.query(`
    SELECT allow_aggregate_contribution
    FROM scoring_consent
    WHERE employee_id = $1
  `, [employeeId]);

  // Default to true if no consent record exists
  return result.rows[0]?.allow_aggregate_contribution ?? true;
}

/**
 * Get consented team members for aggregation
 */
async function getConsentedTeamMembers(managerId) {
  const result = await db.query(`
    SELECT e.id
    FROM employees e
    LEFT JOIN scoring_consent sc ON e.id = sc.employee_id
    WHERE e.manager_id = $1
      AND e.is_active = true
      AND (sc.allow_aggregate_contribution IS NULL OR sc.allow_aggregate_contribution = true)
  `, [managerId]);

  return result.rows.map(r => r.id);
}

/**
 * Get aggregate data respecting consent
 * Only includes employees who have consented to aggregate contribution
 */
async function getConsentedTeamAggregates(managerId) {
  // Get list of consented members
  const consentedIds = await getConsentedTeamMembers(managerId);

  if (consentedIds.length < MIN_AGGREGATE_SIZE) {
    return {
      error: 'Not enough consented team members for aggregate view',
      consentedCount: consentedIds.length,
      minimumRequired: MIN_AGGREGATE_SIZE,
      privacyNote: 'Some team members have opted out of aggregate data contribution.',
    };
  }

  // Get zone distribution for consented members only
  const zoneResult = await db.query(`
    SELECT
      COALESCE(zh.zone, 'yellow') as zone,
      COUNT(*) as count
    FROM employees e
    LEFT JOIN LATERAL (
      SELECT zone
      FROM zone_history
      WHERE employee_id = e.id
      ORDER BY date DESC
      LIMIT 1
    ) zh ON true
    WHERE e.id = ANY($1)
    GROUP BY zh.zone
  `, [consentedIds]);

  const zones = { red: 0, yellow: 0, green: 0 };
  zoneResult.rows.forEach(row => {
    zones[row.zone] = parseInt(row.count);
  });

  return {
    consentedTeamSize: consentedIds.length,
    zoneDistribution: zones,
    privacyNote: 'Data aggregated from consented team members only.',
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  MIN_AGGREGATE_SIZE,
  getTeamAggregates,
  getWellnessOverview,
  checkAggregateConsent,
  getConsentedTeamMembers,
  getConsentedTeamAggregates,
};
