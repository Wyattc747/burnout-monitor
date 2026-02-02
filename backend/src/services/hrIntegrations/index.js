/**
 * HR Integrations Module
 *
 * Factory and utilities for HR system integrations.
 */

const BambooHRAdapter = require('./bamboohrAdapter');
const WorkdayAdapter = require('./workdayAdapter');
const ADPAdapter = require('./adpAdapter');
const GustoAdapter = require('./gustoAdapter');
const RipplingAdapter = require('./ripplingAdapter');
const SyncService = require('./syncService');
const EmployeeMapper = require('./employeeMapper');

// Registry of available adapters
const ADAPTERS = {
  bamboohr: BambooHRAdapter,
  workday: WorkdayAdapter,
  adp: ADPAdapter,
  gusto: GustoAdapter,
  rippling: RipplingAdapter,
};

// Provider display names and info
const PROVIDERS = {
  bamboohr: {
    name: 'BambooHR',
    description: 'HR management for small and medium businesses',
    logo: '/integrations/bamboohr.svg',
    authType: 'api_key',
    website: 'https://www.bamboohr.com',
  },
  workday: {
    name: 'Workday',
    description: 'Enterprise HR and financial management',
    logo: '/integrations/workday.svg',
    authType: 'oauth',
    website: 'https://www.workday.com',
  },
  adp: {
    name: 'ADP',
    description: 'Payroll and HR services',
    logo: '/integrations/adp.svg',
    authType: 'oauth',
    website: 'https://www.adp.com',
  },
  gusto: {
    name: 'Gusto',
    description: 'Payroll, benefits, and HR for modern businesses',
    logo: '/integrations/gusto.svg',
    authType: 'oauth',
    website: 'https://gusto.com',
  },
  rippling: {
    name: 'Rippling',
    description: 'All-in-one HR, IT, and Finance platform',
    logo: '/integrations/rippling.svg',
    authType: 'hybrid', // Supports both API key and OAuth
    website: 'https://www.rippling.com',
  },
};

/**
 * Get adapter class for a provider
 * @param {string} provider - Provider name
 * @returns {typeof BaseHRAdapter}
 */
function getAdapterClass(provider) {
  const AdapterClass = ADAPTERS[provider.toLowerCase()];
  if (!AdapterClass) {
    throw new Error(`Unknown HR provider: ${provider}`);
  }
  return AdapterClass;
}

/**
 * Create an adapter instance for an integration
 * @param {Object} integration - Integration record from database
 * @returns {BaseHRAdapter}
 */
function createAdapter(integration) {
  const AdapterClass = getAdapterClass(integration.provider);
  return new AdapterClass(integration);
}

/**
 * Create a sync service for an integration
 * @param {Object} integration - Integration record from database
 * @param {Object} options - Sync options
 * @returns {SyncService}
 */
function createSyncService(integration, options = {}) {
  const adapter = createAdapter(integration);
  return new SyncService(adapter, options);
}

/**
 * Get list of available providers with metadata
 * @returns {Array}
 */
function getAvailableProviders() {
  return Object.entries(PROVIDERS).map(([key, info]) => ({
    id: key,
    ...info,
    requiredFields: ADAPTERS[key].getRequiredFields(),
  }));
}

/**
 * Get provider info
 * @param {string} provider - Provider name
 * @returns {Object|null}
 */
function getProviderInfo(provider) {
  const info = PROVIDERS[provider.toLowerCase()];
  if (!info) return null;

  const AdapterClass = ADAPTERS[provider.toLowerCase()];

  return {
    id: provider,
    ...info,
    requiredFields: AdapterClass.getRequiredFields(),
    defaultFieldMappings: AdapterClass.getDefaultFieldMappings(),
  };
}

/**
 * Validate credentials for a provider
 * @param {string} provider - Provider name
 * @param {Object} credentials - Credentials to validate
 * @returns {{valid: boolean, errors?: string[]}}
 */
function validateCredentials(provider, credentials) {
  const AdapterClass = getAdapterClass(provider);
  return AdapterClass.validateCredentials(credentials);
}

/**
 * Test connection for an integration
 * @param {Object} integration - Integration record
 * @returns {Promise<{success: boolean, message?: string, error?: string}>}
 */
async function testConnection(integration) {
  const adapter = createAdapter(integration);
  return adapter.testConnection();
}

module.exports = {
  // Factory functions
  getAdapterClass,
  createAdapter,
  createSyncService,

  // Provider utilities
  getAvailableProviders,
  getProviderInfo,
  validateCredentials,
  testConnection,

  // Direct class exports
  BambooHRAdapter,
  WorkdayAdapter,
  ADPAdapter,
  GustoAdapter,
  RipplingAdapter,
  SyncService,
  EmployeeMapper,

  // Constants
  PROVIDERS,
  ADAPTERS,
};
