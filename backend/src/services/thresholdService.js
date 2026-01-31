/**
 * Threshold Service
 * Manages configurable thresholds for burnout/readiness scoring
 */

const db = require('../utils/db');

// Cache for thresholds with 5-minute TTL
const thresholdCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get effective thresholds for an employee
 * Priority: employee override > organization > system default
 */
async function getThresholdsForEmployee(employeeId, organizationId = null) {
  const cacheKey = `${employeeId}-${organizationId || 'default'}`;
  const cached = thresholdCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.thresholds;
  }

  // Get employee override (if exists and active)
  const overrideResult = await db.query(`
    SELECT
      burnout_red_threshold,
      readiness_green_threshold,
      interaction_high_threshold,
      override_reason
    FROM employee_threshold_overrides
    WHERE employee_id = $1
      AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    ORDER BY created_at DESC
    LIMIT 1
  `, [employeeId]);

  const employeeOverride = overrideResult.rows[0] || null;

  // Get organization thresholds (or system default if no org)
  const orgResult = await db.query(`
    SELECT
      burnout_red_threshold,
      readiness_green_threshold,
      threshold_type,
      interaction_high_threshold,
      interaction_critical_threshold,
      enable_interaction_effects,
      weekend_adjustment_enabled
    FROM organization_thresholds
    WHERE organization_id = $1 OR organization_id IS NULL
    ORDER BY organization_id NULLS LAST
    LIMIT 1
  `, [organizationId]);

  const orgThresholds = orgResult.rows[0] || {
    burnout_red_threshold: 70,
    readiness_green_threshold: 70,
    threshold_type: 'absolute',
    interaction_high_threshold: 50,
    interaction_critical_threshold: 70,
    enable_interaction_effects: true,
    weekend_adjustment_enabled: true,
  };

  // Merge: employee override > organization > defaults
  const thresholds = {
    burnoutRedThreshold: employeeOverride?.burnout_red_threshold || orgThresholds.burnout_red_threshold,
    readinessGreenThreshold: employeeOverride?.readiness_green_threshold || orgThresholds.readiness_green_threshold,
    thresholdType: orgThresholds.threshold_type,
    interactionHighThreshold: employeeOverride?.interaction_high_threshold || orgThresholds.interaction_high_threshold,
    interactionCriticalThreshold: orgThresholds.interaction_critical_threshold,
    enableInteractionEffects: orgThresholds.enable_interaction_effects,
    weekendAdjustmentEnabled: orgThresholds.weekend_adjustment_enabled,
    hasEmployeeOverride: !!employeeOverride,
    overrideReason: employeeOverride?.override_reason || null,
  };

  // Cache the result
  thresholdCache.set(cacheKey, {
    thresholds,
    timestamp: Date.now(),
  });

  return thresholds;
}

/**
 * Calculate percentile-based thresholds for an organization
 * Used when threshold_type is 'percentile'
 */
async function calculatePercentileThresholds(organizationId = null, percentile = 70) {
  // Get recent scores for the organization/system
  const result = await db.query(`
    SELECT
      zh.burnout_score,
      zh.readiness_score
    FROM zone_history zh
    JOIN employees e ON zh.employee_id = e.id
    WHERE zh.date >= CURRENT_DATE - INTERVAL '30 days'
      ${organizationId ? 'AND e.organization_id = $1' : ''}
    ORDER BY zh.burnout_score
  `, organizationId ? [organizationId] : []);

  if (result.rows.length < 10) {
    // Not enough data, return defaults
    return {
      burnoutRedThreshold: 70,
      readinessGreenThreshold: 70,
      sampleSize: result.rows.length,
      calculated: false,
    };
  }

  const burnoutScores = result.rows.map(r => parseFloat(r.burnout_score)).sort((a, b) => a - b);
  const readinessScores = result.rows.map(r => parseFloat(r.readiness_score)).sort((a, b) => a - b);

  const percentileIndex = Math.floor((percentile / 100) * burnoutScores.length);

  return {
    burnoutRedThreshold: Math.round(burnoutScores[percentileIndex]),
    readinessGreenThreshold: Math.round(readinessScores[percentileIndex]),
    sampleSize: result.rows.length,
    calculated: true,
  };
}

/**
 * Set employee threshold override
 */
async function setEmployeeThresholdOverride(employeeId, overrides, createdBy = null) {
  const {
    burnoutRedThreshold,
    readinessGreenThreshold,
    interactionHighThreshold,
    reason,
    startDate,
    endDate,
  } = overrides;

  const result = await db.query(`
    INSERT INTO employee_threshold_overrides (
      employee_id,
      burnout_red_threshold,
      readiness_green_threshold,
      interaction_high_threshold,
      override_reason,
      start_date,
      end_date,
      created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    employeeId,
    burnoutRedThreshold || null,
    readinessGreenThreshold || null,
    interactionHighThreshold || null,
    reason || null,
    startDate || new Date(),
    endDate || null,
    createdBy,
  ]);

  // Invalidate cache for this employee
  invalidateCacheForEmployee(employeeId);

  return {
    id: result.rows[0].id,
    employeeId: result.rows[0].employee_id,
    burnoutRedThreshold: result.rows[0].burnout_red_threshold,
    readinessGreenThreshold: result.rows[0].readiness_green_threshold,
    interactionHighThreshold: result.rows[0].interaction_high_threshold,
    reason: result.rows[0].override_reason,
    startDate: result.rows[0].start_date,
    endDate: result.rows[0].end_date,
  };
}

/**
 * Remove employee threshold override
 */
async function removeEmployeeThresholdOverride(employeeId, overrideId) {
  const result = await db.query(`
    DELETE FROM employee_threshold_overrides
    WHERE id = $1 AND employee_id = $2
    RETURNING id
  `, [overrideId, employeeId]);

  // Invalidate cache
  invalidateCacheForEmployee(employeeId);

  return result.rows.length > 0;
}

/**
 * Get all active overrides for an employee
 */
async function getEmployeeThresholdOverrides(employeeId) {
  const result = await db.query(`
    SELECT
      id,
      burnout_red_threshold,
      readiness_green_threshold,
      interaction_high_threshold,
      override_reason,
      start_date,
      end_date,
      created_at
    FROM employee_threshold_overrides
    WHERE employee_id = $1
      AND start_date <= CURRENT_DATE
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    ORDER BY created_at DESC
  `, [employeeId]);

  return result.rows.map(row => ({
    id: row.id,
    burnoutRedThreshold: row.burnout_red_threshold,
    readinessGreenThreshold: row.readiness_green_threshold,
    interactionHighThreshold: row.interaction_high_threshold,
    reason: row.override_reason,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  }));
}

/**
 * Update organization thresholds
 */
async function updateOrganizationThresholds(organizationId, thresholds) {
  const {
    burnoutRedThreshold,
    readinessGreenThreshold,
    thresholdType,
    interactionHighThreshold,
    interactionCriticalThreshold,
    enableInteractionEffects,
    weekendAdjustmentEnabled,
  } = thresholds;

  const result = await db.query(`
    INSERT INTO organization_thresholds (
      organization_id,
      burnout_red_threshold,
      readiness_green_threshold,
      threshold_type,
      interaction_high_threshold,
      interaction_critical_threshold,
      enable_interaction_effects,
      weekend_adjustment_enabled,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (organization_id)
    DO UPDATE SET
      burnout_red_threshold = COALESCE($2, organization_thresholds.burnout_red_threshold),
      readiness_green_threshold = COALESCE($3, organization_thresholds.readiness_green_threshold),
      threshold_type = COALESCE($4, organization_thresholds.threshold_type),
      interaction_high_threshold = COALESCE($5, organization_thresholds.interaction_high_threshold),
      interaction_critical_threshold = COALESCE($6, organization_thresholds.interaction_critical_threshold),
      enable_interaction_effects = COALESCE($7, organization_thresholds.enable_interaction_effects),
      weekend_adjustment_enabled = COALESCE($8, organization_thresholds.weekend_adjustment_enabled),
      updated_at = NOW()
    RETURNING *
  `, [
    organizationId,
    burnoutRedThreshold,
    readinessGreenThreshold,
    thresholdType,
    interactionHighThreshold,
    interactionCriticalThreshold,
    enableInteractionEffects,
    weekendAdjustmentEnabled,
  ]);

  // Clear all cached thresholds for this organization
  clearCacheForOrganization(organizationId);

  return result.rows[0];
}

/**
 * Invalidate cache for a specific employee
 */
function invalidateCacheForEmployee(employeeId) {
  for (const key of thresholdCache.keys()) {
    if (key.startsWith(employeeId)) {
      thresholdCache.delete(key);
    }
  }
}

/**
 * Clear cache for an organization
 */
function clearCacheForOrganization(organizationId) {
  for (const key of thresholdCache.keys()) {
    if (key.endsWith(organizationId || 'default')) {
      thresholdCache.delete(key);
    }
  }
}

/**
 * Clear entire cache
 */
function clearCache() {
  thresholdCache.clear();
}

module.exports = {
  getThresholdsForEmployee,
  calculatePercentileThresholds,
  setEmployeeThresholdOverride,
  removeEmployeeThresholdOverride,
  getEmployeeThresholdOverrides,
  updateOrganizationThresholds,
  clearCache,
};
