/**
 * API Options Service
 * 
 * Service for fetching dynamic form field options from external APIs.
 * Supports nested path extraction and error handling.
 */

import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import { safeNestedField } from '#src/scripts/helpers/dataTransformers.js';
import { devLog, devError } from '#src/scripts/helpers/index.js';
import type { ApiOptionsConfig } from '#src/types/form-types.js';

const DEFAULT_TIMEOUT = 5000;
const NO_OPTIONS = 0;

/**
 * Option item with value and text
 */
export interface OptionItem {
  value: string;
  text: string;
}

/**
 * Result of fetching API options
 */
export interface ApiOptionsResult {
  success: boolean;
  options: Array<string | OptionItem>;
  error?: string;
}

/**
 * Create axios instance for API options with base URL from env
 * @returns {AxiosInstance} Configured axios instance
 */
function createApiOptionsClient(): AxiosInstance {
  const baseURL = process.env.API_OPTIONS_BASE_URL ?? '';
  
  if (baseURL === '') {
    throw new Error('API_OPTIONS_BASE_URL is not configured in environment variables');
  }

  return axios.create({
    baseURL,
    timeout: DEFAULT_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Build full URL with query parameters
 * @param {string} endpoint API endpoint path
 * @param {string} [params] Query parameters as string
 * @returns {string} Full URL with params
 */
function buildUrlWithParams(endpoint: string, params?: string): string {
  if (params === undefined || params.trim() === '') {
    return endpoint;
  }
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}${params}`;
}

/**
 * Extract value from nested path in an object
 * @param {unknown} item Item to extract from
 * @param {string} path Dot notation path
 * @returns {string} Extracted value as string
 */
function extractPathValue(item: unknown, path: string): string {
  const value = safeNestedField(item, path);
  
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  return '';
}

/**
 * Parse API response and extract options based on paths
 * @param {unknown} data API response data
 * @param {string} [dataPath] Optional dot notation path to array in response
 * @param {string} valuePath Dot notation path to value
 * @param {string} labelPath Dot notation path to label
 * @returns {Array<string | OptionItem>} Array of option items
 */
function parseApiResponse(data: unknown, dataPath: string | undefined, valuePath: string, labelPath: string): Array<string | OptionItem> {
  let arrayData = data;

  // If dataPath is specified, extract the nested array first
  if (dataPath !== undefined && dataPath.trim() !== '') {
    devLog(`[API OPTIONS] Extracting array from path: ${dataPath}`);
    arrayData = safeNestedField(data, dataPath);
    
    if (arrayData === null || arrayData === undefined) {
      devError(`[API OPTIONS] No data found at path: ${dataPath}`);
      return [];
    }
  }

  // Handle array responses
  if (!Array.isArray(arrayData)) {
    devError('[API OPTIONS] Data is not an array');
    return [];
  }

  devLog(`[API OPTIONS] Processing ${arrayData.length} items`);

  const options: Array<string | OptionItem> = [];

  for (const item of arrayData) {
    const value = extractPathValue(item, valuePath);
    const label = extractPathValue(item, labelPath);

    // Only add if both value and label exist
    if (value !== '' && label !== '') {
      // If value and label are the same, just use string
      if (value === label) {
        options.push(value);
      } else {
        // Otherwise use object with value and text properties
        const optionItem: OptionItem = { value, text: label };
        options.push(optionItem);
        devLog(`[API OPTIONS] Added option: value="${value}", text="${label}"`);
      }
    }
  }

  const SAMPLE_SIZE = 2;
  const FIRST_INDEX = 0;
  devLog(`[API OPTIONS] Sample options: ${JSON.stringify(options.slice(FIRST_INDEX, SAMPLE_SIZE))}`);
  return options;
}

/**
 * Fetch options from API endpoint
 * @param {ApiOptionsConfig} config API configuration
 * @returns {Promise<ApiOptionsResult>} Result with options or error
 */
export async function fetchApiOptions(config: ApiOptionsConfig): Promise<ApiOptionsResult> {
  const { endpoint, params, dataPath, valuePath, labelPath } = config;

  try {
    const client = createApiOptionsClient();
    const fullUrl = buildUrlWithParams(endpoint, params);

    devLog(`[API OPTIONS] Fetching from: ${fullUrl}`);
    if (dataPath !== undefined && dataPath.trim() !== '') {
      devLog(`[API OPTIONS] Data path: ${dataPath}`);
    }
    devLog(`[API OPTIONS] Value path: ${valuePath}, Label path: ${labelPath}`);

    const response: AxiosResponse<unknown> = await client.get(fullUrl);

    devLog(`[API OPTIONS] Response status: ${response.status}`);

    const options = parseApiResponse(response.data, dataPath, valuePath, labelPath);

    devLog(`[API OPTIONS] Parsed ${options.length} options`);

    if (options.length === NO_OPTIONS) {
      devError('[API OPTIONS] No valid options found in response');
      return {
        success: false,
        options: [],
        error: 'No valid options found in API response',
      };
    }

    return {
      success: true,
      options,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    devError(`[API OPTIONS] Failed to fetch options: ${errorMessage}`);

    return {
      success: false,
      options: [],
      error: `Failed to load options from API: ${errorMessage}`,
    };
  }
}

/**
 * Get options for a field - either from API or static options
 * @param {boolean} [useApiOptions] Whether to use API options
 * @param {ApiOptionsConfig} [apiConfig] API configuration
 * @param {Array<string | OptionItem>} [staticOptions] Static options fallback
 * @returns {Promise<ApiOptionsResult>} Result with options
 */
export async function getFieldOptions(
  useApiOptions?: boolean,
  apiConfig?: ApiOptionsConfig,
  staticOptions?: Array<string | OptionItem>
): Promise<ApiOptionsResult> {
  // Use API options if configured
  if (useApiOptions === true && apiConfig !== undefined) {
    return await fetchApiOptions(apiConfig);
  }

  // Use static options as fallback
  if (staticOptions !== undefined && staticOptions.length > NO_OPTIONS) {
    return {
      success: true,
      options: staticOptions,
    };
  }

  // No options available
  return {
    success: false,
    options: [],
    error: 'No options configured for this field',
  };
}
