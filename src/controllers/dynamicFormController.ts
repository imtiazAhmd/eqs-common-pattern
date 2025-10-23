/**
 * Dynamic Form Controller for handling wizard form generation and submission
 */

import type { Request, Response, NextFunction } from 'express';
import type { FormField, WizardForm, WizardStep } from '../types/form-types.js';
import { storeSessionData, getSessionData } from '../scripts/helpers/sessionHelpers.js';
import {
  parseStepParameter,
  handleConditionalNavigation,
  renderStepWithErrors,
  DEFAULT_STEP,
  FIRST_STEP_INDEX
} from './wizardFormHelpers.js';
import {
  isRecord,
  hasProperty,
  extractFormFields,
  dateStringFromThreeFields
} from '../helpers/dataTransformers.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Load wizard form configuration from JSON
const FORM_CONFIG_PATH = join(process.cwd(), 'src', 'config', 'cla_public.json');

/**
 * Type guard to check if an unknown value is a WizardForm
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is a WizardForm
 */
function isWizardForm(value: unknown): value is WizardForm {
  return isRecord(value) &&
    hasProperty(value, 'title') &&
    hasProperty(value, 'steps') &&
    typeof value.title === 'string' &&
    Array.isArray(value.steps);
}

/**
 * Load and validate wizard form configuration
 * @returns {WizardForm} Parsed wizard form configuration
 */
function loadWizardConfig(): WizardForm {
  try {
    const configContent = readFileSync(FORM_CONFIG_PATH, 'utf8');
    const parsed: unknown = JSON.parse(configContent);

    // Type guard validation to ensure it's a WizardForm structure
    if (!isWizardForm(parsed)) {
      throw new Error('Invalid wizard form configuration structure');
    }

    return parsed;
  } catch (error) {
    console.error('Error loading wizard form config:', error);
    throw new Error('Failed to load wizard form configuration', { cause: error });
  }
}

const WIZARD_FORM_CONFIG = loadWizardConfig();

// Extend Request interface for CSRF token support
interface RequestWithCSRF extends Request {
  csrfToken?: () => string;
}

// HTTP status codes
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;

// Constants
const FIELD_NAME_MAX_LENGTH = 50;
const EMPTY_ARRAY_LENGTH = 0;
const FIELD_NAME_START_INDEX = 0;
const SINGLE_ITEM_SLICE = 1;

/**
 * Type guard for request parameters with formId
 * @param {Record<string, string>} params - Request parameters
 * @returns {boolean} True if formId exists
 */
function hasFormId(params: Record<string, string>): params is Record<string, string> & { formId: string } {
  return typeof params.formId === 'string' && params.formId.length > EMPTY_ARRAY_LENGTH;
}

/**
 * Generate a field name from the question text
 * @param {string} question - The question text
 * @returns {string} Generated field name
 */
function generateFieldName(question: string): string {
  const baseName = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(FIELD_NAME_START_INDEX, FIELD_NAME_MAX_LENGTH);

  return baseName.length > EMPTY_ARRAY_LENGTH ? baseName : 'field';
}

/**
 * Process form configuration to add field names and other properties
 * @param {FormField[]} fields - Array of form fields
 * @returns {FormField[]} Processed form fields
 */
function processFormConfig(fields: FormField[]): FormField[] {
  return fields.map(field => ({
    ...field,
    name: field.name ?? generateFieldName(field.question)
  }));
}

/**
 * GET controller for listing available forms
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function getFormsList(req: RequestWithCSRF, res: Response, next: NextFunction): void {
  try {
    const availableForms = [{
      id: 'legal-aid-application',
      title: WIZARD_FORM_CONFIG.title,
      description: WIZARD_FORM_CONFIG.description ?? 'Complete legal aid application form'
    }];

    res.render('dynamic-forms/list', {
      availableForms
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Extract date components from validation data
 * @param {string} fieldName - Base field name
 * @param {Record<string, string | string[]>} data - Form data for validation
 * @returns {object} Object with day, month, year strings
 */
function extractDateComponentsForValidation(fieldName: string, data: Record<string, string | string[]>): { day: string; month: string; year: string } {
  // Try GOV.UK date component hyphen format first (actual format from debug)
  const hyphenDayKey = `${fieldName}-day`;
  const hyphenMonthKey = `${fieldName}-month`;
  const hyphenYearKey = `${fieldName}-year`;

  if (hyphenDayKey in data || hyphenMonthKey in data || hyphenYearKey in data) {
    return {
      day: typeof data[hyphenDayKey] === 'string' ? data[hyphenDayKey].trim() : '',
      month: typeof data[hyphenMonthKey] === 'string' ? data[hyphenMonthKey].trim() : '',
      year: typeof data[hyphenYearKey] === 'string' ? data[hyphenYearKey].trim() : ''
    };
  }

  // Fallback to underscore format
  const underscoreDayKey = `${fieldName}_day`;
  const underscoreMonthKey = `${fieldName}_month`;
  const underscoreYearKey = `${fieldName}_year`;

  return {
    day: typeof data[underscoreDayKey] === 'string' ? data[underscoreDayKey].trim() : '',
    month: typeof data[underscoreMonthKey] === 'string' ? data[underscoreMonthKey].trim() : '',
    year: typeof data[underscoreYearKey] === 'string' ? data[underscoreYearKey].trim() : ''
  };
}

/**
 * Validate date field components
 * @param {string} fieldName - Field name
 * @param {Record<string, string | string[]>} data - Form data
 * @returns {boolean} True if all date components are provided
 */
function validateDateField(fieldName: string, data: Record<string, string | string[]>): boolean {
  const { day, month, year } = extractDateComponentsForValidation(fieldName, data);
  return day !== '' && month !== '' && year !== '';
}

/**
 * Validate regular field
 * @param {string} fieldName - Field name
 * @param {Record<string, string | string[]>} data - Form data
 * @returns {boolean} True if field has value
 */
function validateRegularField(fieldName: string, data: Record<string, string | string[]>): boolean {
  const { [fieldName]: value } = data;
  const hasValue = Boolean(value);
  const isEmptyString = typeof value === 'string' && value.trim() === '';
  return hasValue && !isEmptyString;
}

/**
 * Validate form step data
 * @param {FormField[]} config - Form configuration
 * @param {Record<string, string | string[]>} data - Form data
 * @returns {object} Validation result
 */
function validateStepData(config: FormField[], data: Record<string, string | string[]>): {
  errors: Record<string, string>;
  errorSummaryList: Array<{ text: string; href: string }>;
} {
  const errors: Record<string, string> = {};
  const errorSummaryList: Array<{ text: string; href: string }> = [];

  for (const field of config) {
    const fieldName = field.name ?? generateFieldName(field.question);
    const isRequired = field.required === true;

    if (!isRequired) continue;

    let isValid = false;
    let errorHref = `#${fieldName}`;

    if (field.type === 'date') {
      isValid = validateDateField(fieldName, data);
      // Point to the first date component in GOV.UK format (day field)
      errorHref = `#${fieldName}-day`;
    } else {
      isValid = validateRegularField(fieldName, data);
    }

    if (!isValid) {
      const errorMessage = `${field.question} is required`;
      errors[fieldName] = errorMessage;
      errorSummaryList.push({
        text: errorMessage,
        href: errorHref
      });
    }
  }

  return { errors, errorSummaryList };
}

/**
 * GET controller for rendering a dynamic wizard form step
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function getDynamicForm(req: RequestWithCSRF, res: Response, next: NextFunction): void {
  try {
    if (!hasFormId(req.params)) {
      res.status(HTTP_STATUS_BAD_REQUEST).render('error', {
        message: 'Invalid form ID',
        error: { status: HTTP_STATUS_BAD_REQUEST }
      });
      return;
    }

    const { params: { formId } } = req;

    // Only accept the legal-aid-application form ID
    if (formId !== 'legal-aid-application') {
      res.status(HTTP_STATUS_NOT_FOUND).render('error', {
        message: 'Form not found',
        error: { status: HTTP_STATUS_NOT_FOUND }
      });
      return;
    }

    const wizardForm = WIZARD_FORM_CONFIG;
    const stepNumber = parseStepParameter(req.query.step);
    const currentStepIndex = stepNumber - DEFAULT_STEP;

    // Validate step number
    if (currentStepIndex < FIRST_STEP_INDEX || currentStepIndex >= wizardForm.steps.length) {
      res.status(HTTP_STATUS_BAD_REQUEST).render('error', {
        message: 'Invalid step number',
        error: { status: HTTP_STATUS_BAD_REQUEST }
      });
      return;
    }

    const [currentStep] = wizardForm.steps.slice(currentStepIndex, currentStepIndex + SINGLE_ITEM_SLICE);
    const processedFields = processFormConfig(currentStep.fields);
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;

    // Get any existing form data from session
    const sessionData = getSessionData(req, `wizardForm_${formId}`) ?? {};

    res.render('dynamic-forms/wizard-step', {
      formId,
      formTitle: wizardForm.title,
      formDescription: wizardForm.description,
      currentStep: stepNumber,
      totalSteps: wizardForm.steps.length,
      stepTitle: currentStep.title,
      stepDescription: currentStep.description,
      formConfig: processedFields,
      formData: sessionData,
      csrfToken,
      error: null,
      isFirstStep: stepNumber === DEFAULT_STEP,
      isLastStep: stepNumber === wizardForm.steps.length,
      isTerminalStep: currentStep.isTerminalStep === true,
      isUrgentStep: currentStep.isUrgentStep === true
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Type guard for valid request body
 * @param {unknown} body - Request body to validate
 * @returns {boolean} True if body is a valid object
 */
function isValidRequestBody(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null;
}

/**
 * Validate form request parameters
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @returns {string | null} Form ID if valid, null if invalid (response already sent)
 */
function validateFormRequest(req: RequestWithCSRF, res: Response): string | null {
  if (!hasFormId(req.params) || !isValidRequestBody(req.body)) {
    res.status(HTTP_STATUS_BAD_REQUEST).render('error', {
      message: 'Invalid request',
      error: { status: HTTP_STATUS_BAD_REQUEST }
    });
    return null;
  }

  const { params: { formId } } = req;

  // Only accept the legal-aid-application form ID
  if (formId !== 'legal-aid-application') {
    res.status(HTTP_STATUS_NOT_FOUND).render('error', {
      message: 'Form not found',
      error: { status: HTTP_STATUS_NOT_FOUND }
    });
    return null;
  }

  return formId;
}

/**
 * Validate step number and get current step
 * @param {WizardForm} wizardForm - Wizard form configuration
 * @param {number} stepNumber - Current step number
 * @param {Response} res - Express response object
 * @returns {WizardStep | null} Current step if valid, null if invalid (response already sent)
 */
function validateAndGetCurrentStep(wizardForm: WizardForm, stepNumber: number, res: Response): WizardStep | null {
  const currentStepIndex = stepNumber - DEFAULT_STEP;

  // Validate step number
  if (currentStepIndex < FIRST_STEP_INDEX || currentStepIndex >= wizardForm.steps.length) {
    res.status(HTTP_STATUS_BAD_REQUEST).render('error', {
      message: 'Invalid step number',
      error: { status: HTTP_STATUS_BAD_REQUEST }
    });
    return null;
  }

  return wizardForm.steps[currentStepIndex] ?? null;
}
/**
 * Build field names array including date field components
 * @param {FormField[]} processedFields - Processed form fields configuration
 * @returns {string[]} Array of field names to extract
 */
function buildFieldNamesList(processedFields: FormField[]): string[] {
  const fieldNames: string[] = [];

  for (const field of processedFields) {
    const { name: fieldName } = field;
    if (typeof fieldName === 'string' && fieldName !== '') {
      if (field.type === 'date') {
        // GOV.UK date component creates fields with hyphens (actual format from debug)
        fieldNames.push(`${fieldName}-day`, `${fieldName}-month`, `${fieldName}-year`);
        // Also add other formats for backwards compatibility
        fieldNames.push(`${fieldName}[day]`, `${fieldName}[month]`, `${fieldName}[year]`);
        fieldNames.push(`${fieldName}_day`, `${fieldName}_month`, `${fieldName}_year`);
      } else {
        fieldNames.push(fieldName);
      }
    }
  }

  return fieldNames;
}

/**
 * Extract date components from form data
 * @param {string} fieldName - Base field name
 * @param {Record<string, unknown>} rawFormData - Raw form data
 * @returns {object} Object with day, month, year strings
 */
function extractDateComponents(fieldName: string, rawFormData: Record<string, unknown>): { day: string; month: string; year: string } {
  // Try the actual GOV.UK format first (hyphen format from debug output)
  const hyphenDay = `${fieldName}-day`;
  const hyphenMonth = `${fieldName}-month`;
  const hyphenYear = `${fieldName}-year`;

  if (hyphenDay in rawFormData || hyphenMonth in rawFormData || hyphenYear in rawFormData) {
    return {
      day: typeof rawFormData[hyphenDay] === 'string' ? rawFormData[hyphenDay] : '',
      month: typeof rawFormData[hyphenMonth] === 'string' ? rawFormData[hyphenMonth] : '',
      year: typeof rawFormData[hyphenYear] === 'string' ? rawFormData[hyphenYear] : ''
    };
  }

  // Fallback to underscore format
  const underscoreDay = `${fieldName}_day`;
  const underscoreMonth = `${fieldName}_month`;
  const underscoreYear = `${fieldName}_year`;

  return {
    day: typeof rawFormData[underscoreDay] === 'string' ? rawFormData[underscoreDay] : '',
    month: typeof rawFormData[underscoreMonth] === 'string' ? rawFormData[underscoreMonth] : '',
    year: typeof rawFormData[underscoreYear] === 'string' ? rawFormData[underscoreYear] : ''
  };
}

/**
 * Process date field data
 * @param {string} fieldName - Base field name
 * @param {Record<string, unknown>} rawFormData - Raw form data
 * @returns {Record<string, string>} Processed date field data
 */
function processDateField(fieldName: string, rawFormData: Record<string, unknown>): Record<string, string> {
  const { day, month, year } = extractDateComponents(fieldName, rawFormData);

  const result: Record<string, string> = {};

  // Store individual components in both formats for compatibility
  const underscoreDayKey = `${fieldName}_day`;
  const underscoreMonthKey = `${fieldName}_month`;
  const underscoreYearKey = `${fieldName}_year`;
  const govukDayKey = `${fieldName}[day]`;
  const govukMonthKey = `${fieldName}[month]`;
  const govukYearKey = `${fieldName}[year]`;

  result[underscoreDayKey] = day;
  result[underscoreMonthKey] = month;
  result[underscoreYearKey] = year;
  result[govukDayKey] = day;
  result[govukMonthKey] = month;
  result[govukYearKey] = year;

  // If all components are provided, create the combined date
  const hasAllComponents = day !== '' && month !== '' && year !== '';
  if (hasAllComponents) {
    result[fieldName] = dateStringFromThreeFields(day, month, year);
  } else {
    result[fieldName] = '';
  }

  return result;
}

/**
 * Process regular field data
 * @param {string} fieldName - Field name
 * @param {Record<string, unknown>} rawFormData - Raw form data
 * @returns {Record<string, string | string[]>} Processed field data
 */
function processRegularField(fieldName: string, rawFormData: Record<string, unknown>): Record<string, string | string[]> {
  const { [fieldName]: value } = rawFormData;
  const result: Record<string, string | string[]> = {};

  if (typeof value === 'string') {
    result[fieldName] = value;
  } else if (Array.isArray(value)) {
    result[fieldName] = value.filter((item): item is string => typeof item === 'string');
  } else {
    result[fieldName] = String(value);
  }

  return result;
}

/**
 * Extract and convert form data to required format
 * @param {unknown} body - Request body
 * @param {FormField[]} processedFields - Processed form fields configuration
 * @returns {Record<string, string | string[]>} Converted form data
 */
function extractAndConvertFormData(body: unknown, processedFields: FormField[]): Record<string, string | string[]> {
  const fieldNames = buildFieldNamesList(processedFields);
  const rawFormData = extractFormFields(body, fieldNames);
  const formData: Record<string, string | string[]> = {};

  for (const field of processedFields) {
    const { name: fieldName } = field;
    if (typeof fieldName !== 'string' || fieldName === '') {
      continue;
    }

    if (field.type === 'date') {
      Object.assign(formData, processDateField(fieldName, rawFormData));
    } else {
      Object.assign(formData, processRegularField(fieldName, rawFormData));
    }
  }

  return formData;
}

/**
 * Convert form data to session storage format
 * @param {Record<string, string | string[]>} formData - Form data with possible arrays
 * @returns {Record<string, string>} Session storage compatible format
 */
function convertFormDataForSession(formData: Record<string, string | string[]>): Record<string, string> {
  const sessionData: Record<string, string> = {};
  for (const [key, value] of Object.entries(formData)) {
    if (Array.isArray(value)) {
      sessionData[key] = value.join(', ');
    } else {
      sessionData[key] = value;
    }
  }
  return sessionData;
}

/**
 * Consolidate all step data into a single session entry for final submission
 * @param {RequestWithCSRF} req - Express request object
 * @param {string} formId - Form identifier
 * @param {number} totalSteps - Total number of steps in the wizard
 */
function consolidateFormData(req: RequestWithCSRF, formId: string, totalSteps: number): void {
  const consolidatedData: Record<string, string> = {};
  const FIRST_STEP = 1;
  
  // Collect data from all steps
  for (let step = FIRST_STEP; step <= totalSteps; step += FIRST_STEP) {
    const stepData = getSessionData(req, `wizardForm_${formId}_step_${step}`) ?? {};
    Object.assign(consolidatedData, stepData);
  }
  
  // Store consolidated data for the success page
  storeSessionData(req, `wizardForm_${formId}`, consolidatedData);
}

/**
 * POST controller for processing wizard form submissions and navigation
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function postDynamicForm(req: RequestWithCSRF, res: Response, next: NextFunction): void {
  try {
    const formId = validateFormRequest(req, res);
    if (formId === null) return;

    const wizardForm = WIZARD_FORM_CONFIG;
    const stepNumber = parseStepParameter(req.query.step);

    const currentStep = validateAndGetCurrentStep(wizardForm, stepNumber, res);
    if (currentStep === null) return;

    const processedFields = processFormConfig(currentStep.fields);
    const formData = extractAndConvertFormData(req.body, processedFields);
    const { errors, errorSummaryList } = validateStepData(processedFields, formData);
    const hasValidationErrors = Object.keys(errors).length > EMPTY_ARRAY_LENGTH;

    // Handle validation errors
    if (hasValidationErrors) {
      const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
      renderStepWithErrors({
        res,
        formId,
        wizardForm,
        currentStep,
        stepNumber,
        processedFields,
        formData,
        csrfToken,
        errors,
        errorSummaryList
      });
      return;
    }

    // Store form data using sessionHelpers
    const sessionData = convertFormDataForSession(formData);
    storeSessionData(req, `wizardForm_${formId}_step_${stepNumber}`, sessionData);

    // Extract action safely from request body
    const { action: actionValue } = isRecord(req.body) ? req.body : { action: undefined };
    const action = typeof actionValue === 'string' ? actionValue : '';

    // If this is the final step and submitting, consolidate all step data
    if (action === 'submit' && stepNumber === wizardForm.steps.length) {
      consolidateFormData(req, formId, wizardForm.steps.length);
    }

    // Use conditional navigation for enhanced wizard flow
    handleConditionalNavigation({
      action,
      stepNumber,
      formId,
      totalSteps: wizardForm.steps.length,
      currentStep,
      allSteps: wizardForm.steps,
      formData
    }, res);

  } catch (error) {
    next(error);
  }
}

/**
 * GET controller for form success page
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function getFormSuccess(req: RequestWithCSRF, res: Response, next: NextFunction): void {
  try {
    if (!hasFormId(req.params)) {
      res.status(HTTP_STATUS_BAD_REQUEST).render('error', {
        message: 'Invalid form ID',
        error: { status: HTTP_STATUS_BAD_REQUEST }
      });
      return;
    }

    const { params: { formId } } = req;

    // Only accept the legal-aid-application form ID
    if (formId !== 'legal-aid-application') {
      res.status(HTTP_STATUS_NOT_FOUND).render('error', {
        message: 'Form not found',
        error: { status: HTTP_STATUS_NOT_FOUND }
      });
      return;
    }

    const wizardForm = WIZARD_FORM_CONFIG;
    const submittedData = getSessionData(req, `wizardForm_${formId}`) ?? {};

    // Flatten all fields from all steps for the success page
    const allFields: FormField[] = wizardForm.steps.flatMap(step => step.fields);

    res.render('dynamic-forms/success', {
      formId,
      formTitle: wizardForm.title,
      submittedData,
      formConfig: allFields
    });
  } catch (error) {
    next(error);
  }
}