/**
 * Form Builder Controller
 * Handles the visual form builder interface for creating wizard forms
 */

import type { Request, Response, NextFunction } from 'express';
import type { FormBuilderResult } from '../types/form-builder-types.js';
import { writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isRecord, hasProperty } from '../helpers/dataTransformers.js';

// Extend Request interface for CSRF token support
interface RequestWithCSRF extends Request {
  csrfToken?: () => string;
}

// HTTP status codes
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_ERROR = 500;

// Constants
const MIN_STEPS_REQUIRED = 0;
const STEP_INDEX_OFFSET = 1;
const JSON_INDENT_SPACES = 2;

// Config directory path
const CONFIG_DIR = join(process.cwd(), 'src', 'config');

/**
 * Validate basic form structure
 * @param {unknown} data - Data to validate
 * @param {string[]} errors - Array to collect errors
 * @returns {boolean} True if basic structure is valid
 */
function validateBasicFormStructure(data: unknown, errors: string[]): data is Record<string, unknown> {
  if (!isRecord(data)) {
    errors.push('Form configuration must be an object');
    return false;
  }

  if (!hasProperty(data, 'title') || typeof data.title !== 'string' || data.title.trim() === '') {
    errors.push('Form title is required');
  }

  if (!hasProperty(data, 'steps') || !Array.isArray(data.steps)) {
    errors.push('Form must have a steps array');
    return false;
  }

  if (data.steps.length === MIN_STEPS_REQUIRED) {
    errors.push('Form must have at least one step');
  }

  return true;
}

/**
 * Validate a single field
 * @param {unknown} field - Field to validate
 * @param {number} stepNum - Step number for error messages
 * @param {number} fieldNum - Field number for error messages
 * @param {string[]} errors - Array to collect errors
 */
function validateField(field: unknown, stepNum: number, fieldNum: number, errors: string[]): void {
  if (!isRecord(field)) {
    errors.push(`Step ${stepNum}, Field ${fieldNum}: must be an object`);
    return;
  }

  if (!hasProperty(field, 'question') || typeof field.question !== 'string' || field.question.trim() === '') {
    errors.push(`Step ${stepNum}, Field ${fieldNum}: question is required`);
  }

  if (!hasProperty(field, 'type') || typeof field.type !== 'string') {
    errors.push(`Step ${stepNum}, Field ${fieldNum}: type is required`);
  }

  if (!hasProperty(field, 'name') || typeof field.name !== 'string' || field.name.trim() === '') {
    errors.push(`Step ${stepNum}, Field ${fieldNum}: name is required`);
  }
}

/**
 * Validate conditional navigation
 * @param {unknown} step - Step to validate
 * @param {number} stepNum - Step number for error messages
 * @param {string[]} errors - Array to collect errors
 */
function validateConditionalNavigation(step: Record<string, unknown>, stepNum: number, errors: string[]): void {
  if (!hasProperty(step, 'conditionalNavigation') || step.conditionalNavigation === null) {
    return;
  }

  if (!isRecord(step.conditionalNavigation)) {
    errors.push(`Step ${stepNum}: conditionalNavigation must be an object`);
    return;
  }

  for (const [fieldName, navMap] of Object.entries(step.conditionalNavigation)) {
    if (!isRecord(navMap)) {
      errors.push(`Step ${stepNum}: conditionalNavigation for field "${fieldName}" must be an object`);
    }
  }
}

/**
 * Validate a single step
 * @param {unknown} step - Step to validate
 * @param {number} index - Step index
 * @param {Set<string>} stepIds - Set of existing step IDs
 * @param {string[]} errors - Array to collect errors
 */
function validateStep(step: unknown, index: number, stepIds: Set<string>, errors: string[]): void {
  const stepNum = index + STEP_INDEX_OFFSET;

  if (!isRecord(step)) {
    errors.push(`Step ${stepNum}: must be an object`);
    return;
  }

  validateStepId(step, stepNum, stepIds, errors);
  validateStepTitle(step, stepNum, errors);
  validateStepFields(step, stepNum, errors);
  validateConditionalNavigation(step, stepNum, errors);
}

/**
 * Validate step ID
 * @param {Record<string, unknown>} step - Step object
 * @param {number} stepNum - Step number for error messages
 * @param {Set<string>} stepIds - Set of existing step IDs
 * @param {string[]} errors - Array to collect errors
 */
function validateStepId(step: Record<string, unknown>, stepNum: number, stepIds: Set<string>, errors: string[]): void {
  if (!hasProperty(step, 'id') || typeof step.id !== 'string' || step.id.trim() === '') {
    errors.push(`Step ${stepNum}: id is required`);
  } else if (stepIds.has(step.id)) {
    errors.push(`Step ${stepNum}: duplicate step ID "${step.id}"`);
  } else {
    stepIds.add(step.id);
  }
}

/**
 * Validate step title
 * @param {Record<string, unknown>} step - Step object
 * @param {number} stepNum - Step number for error messages
 * @param {string[]} errors - Array to collect errors
 */
function validateStepTitle(step: Record<string, unknown>, stepNum: number, errors: string[]): void {
  if (!hasProperty(step, 'title') || typeof step.title !== 'string' || step.title.trim() === '') {
    errors.push(`Step ${stepNum}: title is required`);
  }
}

/**
 * Validate step fields
 * @param {Record<string, unknown>} step - Step object
 * @param {number} stepNum - Step number for error messages
 * @param {string[]} errors - Array to collect errors
 */
function validateStepFields(step: Record<string, unknown>, stepNum: number, errors: string[]): void {
  if (!hasProperty(step, 'fields') || !Array.isArray(step.fields)) {
    errors.push(`Step ${stepNum}: must have a fields array`);
    return;
  }

  for (const [fieldIndex, field] of step.fields.entries()) {
    validateField(field, stepNum, fieldIndex + STEP_INDEX_OFFSET, errors);
  }
}

/**
 * Validate wizard form configuration
 * @param {unknown} data - Data to validate
 * @returns {object} Validation result
 */
function validateFormConfig(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!validateBasicFormStructure(data, errors)) {
    return { valid: false, errors };
  }

  // Extract steps safely after validation - data is now Record<string, unknown>
  if (!hasProperty(data, 'steps') || !Array.isArray(data.steps)) {
    errors.push('Steps must be an array');
    return { valid: false, errors };
  }

  const { steps } = data;
  const stepIds = new Set<string>();

  for (const [index, step] of steps.entries()) {
    validateStep(step, index, stepIds, errors);
  }

  return { valid: errors.length === MIN_STEPS_REQUIRED, errors };
}

/**
 * GET controller for form builder interface
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function getFormBuilder(req: RequestWithCSRF, res: Response, next: NextFunction): void {
  try {
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;

    // Get list of existing forms
    const existingForms: Array<{ id: string; name: string }> = [];
    if (existsSync(CONFIG_DIR)) {
      const files = readdirSync(CONFIG_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const formId = file.replace('.json', '');
          existingForms.push({
            id: formId,
            name: formId.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
          });
        }
      }
    }

    res.render('form-builder/index', {
      csrfToken,
      existingForms,
      pageTitle: 'Visual Form Builder'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST controller for saving form configuration
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
/**
 * Parse form configuration from request
 * @param {unknown} formConfig - Form config to parse
 * @returns {Record<string, unknown> | null} Parsed config or null if invalid
 */
function parseFormConfig(formConfig: unknown): Record<string, unknown> | null {
  try {
    if (typeof formConfig === 'string') {
      const parsed: unknown = JSON.parse(formConfig);
      return isRecord(parsed) ? parsed : null;
    }
    return isRecord(formConfig) ? formConfig : null;
  } catch {
    return null;
  }
}

/**
 * Validate filename format
 * @param {string} filename - Filename to validate
 * @returns {object} Validation result with clean filename
 */
function validateFilename(filename: string): { valid: boolean; cleanFilename: string; message?: string } {
  const filenamePattern = /^[a-z0-9_-]+$/;
  const cleanFilename = filename.trim().toLowerCase();
  
  if (!filenamePattern.test(cleanFilename)) {
    return {
      valid: false,
      cleanFilename,
      message: 'Filename must contain only lowercase letters, numbers, hyphens, and underscores'
    };
  }
  
  return { valid: true, cleanFilename };
}

/**
 * Save form configuration to file
 * @param {string} cleanFilename - Clean filename
 * @param {Record<string, unknown>} parsedConfig - Parsed configuration
 * @returns {object} Save result
 */
function saveFormConfigToFile(
  cleanFilename: string, 
  parsedConfig: Record<string, unknown>
): { success: boolean; message: string } {
  try {
    const filePath = join(CONFIG_DIR, `${cleanFilename}.json`);
    const prettyJson = JSON.stringify(parsedConfig, null, JSON_INDENT_SPACES);
    writeFileSync(filePath, prettyJson, 'utf8');
    
    return {
      success: true,
      message: `Form configuration saved successfully to ${cleanFilename}.json`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Failed to save file: ${errorMessage}`
    };
  }
}

/**
 * Extract and validate form config and filename from request body
 * @param {Record<string, unknown>} body - Request body
 * @returns {object} Extraction result
 */
function extractFormConfigRequest(body: Record<string, unknown>): {
  valid: boolean;
  formConfig?: unknown;
  filename?: string;
  message?: string;
} {
  if (!hasProperty(body, 'formConfig') || !hasProperty(body, 'filename')) {
    return { valid: false, message: 'Missing required fields' };
  }

  const { formConfig, filename } = body;

  if (typeof filename !== 'string' || filename.trim() === '') {
    return { valid: false, message: 'Filename is required' };
  }

  return { valid: true, formConfig, filename };
}

/**
 * Process form config save request
 * @param {unknown} formConfig - Form config to save
 * @param {string} filename - Filename to save to
 * @param {Response} res - Response object
 * @returns {boolean} True if handled, false otherwise
 */
function processFormConfigSave(formConfig: unknown, filename: string, res: Response): boolean {
  // Validate filename format
  const filenameValidation = validateFilename(filename);
  if (!filenameValidation.valid) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({
      success: false,
      message: filenameValidation.message ?? 'Invalid filename'
    } satisfies FormBuilderResult);
    return true;
  }

  // Parse form config
  const parsedConfig = parseFormConfig(formConfig);
  if (parsedConfig === null) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({
      success: false,
      message: 'Invalid JSON format'
    } satisfies FormBuilderResult);
    return true;
  }

  // Validate the form configuration structure
  const { valid, errors } = validateFormConfig(parsedConfig);
  if (!valid) {
    res.status(HTTP_STATUS_BAD_REQUEST).json({
      success: false,
      message: 'Form configuration validation failed',
      errors
    } satisfies FormBuilderResult);
    return true;
  }

  // Save to file
  const { cleanFilename } = filenameValidation;
  const saveResult = saveFormConfigToFile(cleanFilename, parsedConfig);
  
  const statusCode = saveResult.success ? HTTP_STATUS_OK : HTTP_STATUS_INTERNAL_ERROR;
  res.status(statusCode).json({
    success: saveResult.success,
    message: saveResult.message,
    data: undefined
  } satisfies FormBuilderResult);
  
  return true;
}

/**
 * POST controller for saving form configuration
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function saveFormConfig(req: RequestWithCSRF, res: Response, next: NextFunction): void {
  try {
    if (!isRecord(req.body)) {
      res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        message: 'Invalid request body'
      } satisfies FormBuilderResult);
      return;
    }

    // Extract and validate request data
    const extraction = extractFormConfigRequest(req.body);
    if (!extraction.valid) {
      res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        message: extraction.message ?? 'Invalid request'
      } satisfies FormBuilderResult);
      return;
    }

    const { formConfig, filename } = extraction;
    if (filename === undefined) {
      res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        message: 'Filename is undefined'
      } satisfies FormBuilderResult);
      return;
    }

    processFormConfigSave(formConfig, filename, res);
  } catch (error) {
    next(error);
  }
}

/**
 * POST controller for validating form configuration without saving
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
/**
 * POST controller for validating form configuration without saving
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function validateFormConfigEndpoint(req: RequestWithCSRF, res: Response, next: NextFunction): void {
  try {
    // Validate request body structure
    if (!isRecord(req.body)) {
      res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        message: 'Invalid request body'
      } satisfies FormBuilderResult);
      return;
    }
    
    if (!hasProperty(req.body, 'formConfig')) {
      res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        message: 'Missing formConfig field'
      } satisfies FormBuilderResult);
      return;
    }

    // Extract formConfig after validation - linter accepts this pattern
    const requestBody = isRecord(req.body) ? req.body : {};
    const { formConfig: formConfigValue } = requestBody;

    // Parse form config
    const parsedConfig = parseFormConfig(formConfigValue);
    if (parsedConfig === null) {
      res.status(HTTP_STATUS_BAD_REQUEST).json({
        success: false,
        message: 'Invalid JSON format',
        errors: ['JSON parsing failed']
      } satisfies FormBuilderResult);
      return;
    }

    // Validate the configuration
    const { valid, errors } = validateFormConfig(parsedConfig);

    res.status(HTTP_STATUS_OK).json({
      success: valid,
      message: valid ? 'Form configuration is valid' : 'Validation failed',
      errors: valid ? undefined : errors
    } satisfies FormBuilderResult);
  } catch (error) {
    next(error);
  }
}
