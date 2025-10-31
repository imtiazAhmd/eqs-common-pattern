/**
 * Helper functions for wizard form processing
 */

import type { Response } from 'express';
import type { FormField, WizardForm, WizardStep } from '../types/form-types.js';
import { hasProperty } from '../helpers/dataTransformers.js';

// Constants for wizard navigation
export const DEFAULT_STEP = 1;
export const FIRST_STEP_INDEX = 0;

/**
 * Parse step parameter safely
 * @param {unknown} stepParam - Step parameter from request
 * @returns {number} Parsed step number
 */
export function parseStepParameter(stepParam: unknown): number {
  if (typeof stepParam !== 'string') {
    return DEFAULT_STEP;
  }
  const parsed = parseInt(stepParam, 10);
  return Number.isNaN(parsed) ? DEFAULT_STEP : parsed;
}

/**
 * Navigation parameters interface
 */
interface NavigationParams {
  action: string;
  stepNumber: number;
  formId: string;
  totalSteps: number;
}

/**
 * Extended navigation parameters interface
 */
interface ConditionalNavigationParams extends NavigationParams {
  currentStep: WizardStep;
  allSteps: WizardStep[];
  formData: Record<string, string | string[]>;
}

/**
 * Get value to check from field value (handles arrays)
 * @param {string | string[]} fieldValue - Field value
 * @returns {string} Value to check
 */
function getValueToCheck(fieldValue: string | string[]): string {
  const firstArrayIndex = 0;
  return Array.isArray(fieldValue) ? fieldValue[firstArrayIndex] : fieldValue;
}

/**
 * Check if a navigation target is valid
 * @param {unknown} target - Target to validate
 * @returns {string | null} Valid target or null
 */
function getValidNavigationTarget(target: unknown): string | null {
  return typeof target === 'string' && target !== '' ? target : null;
}

/**
 * Find matching navigation target in navigation map
 * @param {Record<string, string>} navigationMap - Navigation map
 * @param {string} valueToCheck - Value to match
 * @returns {string | null} Target step or null
 */
function findNavigationTarget(
  navigationMap: Record<string, string>,
  valueToCheck: string
): string | null {
  // Check for exact match
  if (hasProperty(navigationMap, valueToCheck)) {
    const { [valueToCheck]: targetStep } = navigationMap;
    return getValidNavigationTarget(targetStep);
  }

  // Check for default fallback
  if (hasProperty(navigationMap, 'default')) {
    const { default: defaultStep } = navigationMap;
    return getValidNavigationTarget(defaultStep);
  }

  return null;
}

/**
 * Determine the next step based on conditional logic
 * @param {WizardStep} currentStep - Current wizard step
 * @param {Record<string, string | string[]>} formData - Current form data
 * @returns {string | null} Next step ID or null for sequential navigation
 */
export function determineNextStep(
  currentStep: WizardStep,
  formData: Record<string, string | string[]>
): string | null {
  // Return null if no conditional navigation is defined
  if (currentStep.conditionalNavigation === undefined) {
    return null;
  }

  // Check each field's conditional navigation
  for (const [fieldName, navigationMap] of Object.entries(currentStep.conditionalNavigation)) {
    // Skip if field not present or empty
    if (!hasProperty(formData, fieldName)) {
      continue;
    }

    const { [fieldName]: fieldValue } = formData;
    if (fieldValue === '') {
      continue;
    }

    // Find navigation target based on field value
    const valueToCheck = getValueToCheck(fieldValue);
    const target = findNavigationTarget(navigationMap, valueToCheck);

    if (target !== null) {
      return target;
    }
  }

  return null;
}

/**
 * Find step index by step ID
 * @param {WizardStep[]} steps - Array of wizard steps
 * @param {string} stepId - Step ID to find
 * @returns {number} Step index (1-based) or -1 if not found
 */
export function findStepIndexById(steps: WizardStep[], stepId: string): number {
  const index = steps.findIndex(step => step.id === stepId);
  const stepIncrement = 1;
  const notFound = -1;
  return index >= FIRST_STEP_INDEX ? index + stepIncrement : notFound;
}

/**
 * Handle form navigation action with conditional logic support
 * @param {NavigationParams} params - Navigation parameters
 * @param {Response} res - Express response object
 */
export function handleFormNavigation(params: NavigationParams, res: Response): void {
  const { action, stepNumber, formId, totalSteps } = params;

  if (action === 'previous' && stepNumber > DEFAULT_STEP) {
    const previousStep = stepNumber - DEFAULT_STEP;
    res.redirect(`/dynamic-forms/${formId}?step=${previousStep}`);
    return;
  }

  if (action === 'next' && stepNumber < totalSteps) {
    const nextStep = stepNumber + DEFAULT_STEP;
    res.redirect(`/dynamic-forms/${formId}?step=${nextStep}`);
    return;
  }

  if (action === 'submit' && stepNumber === totalSteps) {
    res.redirect(`/dynamic-forms/${formId}/success`);
    return;
  }

  // Default: redirect to current step
  res.redirect(`/dynamic-forms/${formId}?step=${stepNumber}`);
}

/**
 * Handle previous navigation
 * @param {number} stepNumber - Current step
 * @param {string} formId - Form ID
 * @param {Response} res - Response object
 */
function navigateToPrevious(stepNumber: number, formId: string, res: Response): void {
  if (stepNumber > DEFAULT_STEP) {
    const previousStep = stepNumber - DEFAULT_STEP;
    res.redirect(`/dynamic-forms/${formId}?step=${previousStep}`);
  }
}

/**
 * Handle next navigation with conditional logic
 * @param {ConditionalNavigationParams} params - Navigation params
 * @param {Response} res - Response object
 */
function navigateToNext(params: ConditionalNavigationParams, res: Response): void {
  const { stepNumber, formId, totalSteps, currentStep, allSteps, formData } = params;
  const minValidStep = 0;

  const nextStepId = determineNextStep(currentStep, formData);

  if (nextStepId !== null && nextStepId !== '') {
    const nextStepNumber = findStepIndexById(allSteps, nextStepId);
    if (nextStepNumber > minValidStep) {
      res.redirect(`/dynamic-forms/${formId}?step=${nextStepNumber}`);
      return;
    }
  }

  if (stepNumber < totalSteps) {
    const nextStep = stepNumber + DEFAULT_STEP;
    res.redirect(`/dynamic-forms/${formId}?step=${nextStep}`);
  }
}

/**
 * Handle submit action
 * @param {ConditionalNavigationParams} params - Navigation params
 * @param {Response} res - Response object
 */
function handleSubmit(params: ConditionalNavigationParams, res: Response): void {
  const { stepNumber, formId, totalSteps, currentStep } = params;

  const isTerminal = (currentStep.isTerminalStep === true) || (currentStep.isUrgentStep === true);

  if (isTerminal || stepNumber === totalSteps) {
    res.redirect(`/dynamic-forms/${formId}/success`);
  }
}

/**
 * Handle conditional form navigation
 * @param {ConditionalNavigationParams} params - Extended navigation parameters
 * @param {Response} res - Express response object
 */
export function handleConditionalNavigation(params: ConditionalNavigationParams, res: Response): void {
  const { action, stepNumber, formId } = params;

  switch (action) {
    case 'previous': {
      navigateToPrevious(stepNumber, formId, res);
      return;
    }
    case 'next': {
      navigateToNext(params, res);
      return;
    }
    case 'submit': {
      handleSubmit(params, res);
      return;
    }
    default: {
      res.redirect(`/dynamic-forms/${formId}?step=${stepNumber}`);
    }
  }
}

/**
 * Parameters for rendering step with errors
 */
export interface RenderStepParams {
  res: Response;
  formId: string;
  wizardForm: WizardForm;
  currentStep: WizardStep;
  stepNumber: number;
  processedFields: FormField[];
  formData: Record<string, string | string[]>;
  csrfToken: string | undefined;
  errors: Record<string, string>;
  errorSummaryList: Array<{ text: string; href: string }>;
}

/**
 * Render wizard step with validation errors
 * @param {RenderStepParams} params - Parameters for rendering
 */
export function renderStepWithErrors(params: RenderStepParams): void {
  const {
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
  } = params;

  const HTTP_STATUS_BAD_REQUEST = 400;

  res.status(HTTP_STATUS_BAD_REQUEST).render('dynamic-forms/wizard-step', {
    formId,
    formTitle: wizardForm.title,
    formDescription: wizardForm.description,
    currentStep: stepNumber,
    totalSteps: wizardForm.steps.length,
    stepTitle: currentStep.title,
    stepDescription: currentStep.description,
    formConfig: processedFields,
    formData,
    csrfToken,
    error: {
      inputErrors: errors,
      errorSummaryList
    },
    isFirstStep: stepNumber === DEFAULT_STEP,
    isLastStep: stepNumber === wizardForm.steps.length,
    isTerminalStep: currentStep.isTerminalStep === true,
    isUrgentStep: currentStep.isUrgentStep === true
  });
}