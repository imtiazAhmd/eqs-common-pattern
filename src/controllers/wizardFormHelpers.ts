/**
 * Helper functions for wizard form processing
 */

import type { Response } from 'express';
import type { FormField, WizardForm, WizardStep, GlobalConditionalNavigation, NavigationRule } from '../types/form-types.js';
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

  console.log(`[navigateToNext] Current step: ${stepNumber}, formId: ${formId}, totalSteps: ${totalSteps}`);
  console.log(`[navigateToNext] Current step ID: ${currentStep.id}`);
  console.log(`[navigateToNext] Form data:`, formData);

  const nextStepId = determineNextStep(currentStep, formData);
  console.log(`[navigateToNext] Determined next step ID from step-level navigation: ${nextStepId}`);

  if (nextStepId !== null && nextStepId !== '') {
    const nextStepNumber = findStepIndexById(allSteps, nextStepId);
    console.log(`[navigateToNext] Found step number for ${nextStepId}: ${nextStepNumber}`);
    if (nextStepNumber > minValidStep) {
      console.log(`[navigateToNext] Redirecting to step ${nextStepNumber} via step-level conditional nav`);
      res.redirect(`/dynamic-forms/${formId}?step=${nextStepNumber}`);
      return;
    }
  }

  if (stepNumber < totalSteps) {
    const nextStep = stepNumber + DEFAULT_STEP;
    console.log(`[navigateToNext] No conditional nav matched, going to next sequential step: ${nextStep}`);
    res.redirect(`/dynamic-forms/${formId}?step=${nextStep}`);
  } else {
    console.log(`[navigateToNext] Already at last step (${stepNumber}), no navigation`);
  }
}

/**
 * Handle submit action
 * @param {ConditionalNavigationParams} params - Navigation params
 * @param {Response} res - Response object
 */
function handleSubmit(params: ConditionalNavigationParams, res: Response): void {
  const { stepNumber, formId, totalSteps } = params;

  if (stepNumber === totalSteps) {
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
    formConfig: processedFields,
    formData,
    csrfToken,
    error: {
      inputErrors: errors,
      errorSummaryList
    },
    isFirstStep: stepNumber === DEFAULT_STEP,
    isLastStep: stepNumber === wizardForm.steps.length
  });
}

/**
 * Get the maximum step index from a rule's conditions
 * @param {NavigationRule} rule - Navigation rule
 * @param {WizardStep[]} allSteps - All steps in the form
 * @returns {number} Maximum step index (0-based), or -1 if not found
 */
function getMaxStepIndexFromRule(rule: NavigationRule, allSteps: WizardStep[]): number {
  let maxIndex = -1;
  for (const condition of rule.conditions) {
    const stepIndex = allSteps.findIndex(step => step.id === condition.stepId);
    if (stepIndex > maxIndex) {
      maxIndex = stepIndex;
    }
  }
  return maxIndex;
}

/**
 * Evaluate global conditional navigation rules
 * @param {GlobalConditionalNavigation} rules - Array of navigation rules
 * @param {Record<string, string | string[]>} formData - All form data collected so far
 * @param {WizardStep[]} allSteps - All steps in the form
 * @returns {string | null} Target step ID if a rule matches, null otherwise
 */
export function evaluateGlobalNavigation(
  rules: GlobalConditionalNavigation | undefined,
  formData: Record<string, string | string[]>,
  allSteps: WizardStep[]
): string | null {
  const NO_RULES = 0;
  if (rules === undefined || rules.length === NO_RULES) {
    return null;
  }

  // Sort rules by the maximum step index they reference (descending)
  // This ensures rules with conditions from later steps are evaluated first
  const sortedRules = [...rules].sort((a, b) => {
    const maxStepA = getMaxStepIndexFromRule(a, allSteps);
    const maxStepB = getMaxStepIndexFromRule(b, allSteps);
    return maxStepB - maxStepA;
  });

  // Try each rule in sorted order
  for (const rule of sortedRules) {
    if (evaluateRule(rule, formData)) {
      // Validate target step exists
      const targetExists = allSteps.some(step => step.id === rule.targetStepId);
      if (targetExists) {
        return rule.targetStepId;
      }
    }
  }

  return null;
}

/**
 * Evaluate a single navigation rule
 * @param {NavigationRule} rule - Navigation rule to evaluate
 * @param {Record<string, string | string[]>} formData - Form data
 * @returns {boolean} True if all conditions match (AND logic)
 */
function evaluateRule(
  rule: NavigationRule,
  formData: Record<string, string | string[]>
): boolean {
  // All conditions must match (AND logic)
  for (const condition of rule.conditions) {
    const fieldKey = `${condition.stepId}.${condition.fieldName}`;
    const fieldValue = formData[fieldKey] ?? formData[condition.fieldName];

    // Handle both string and array values
    const FIRST_INDEX = 0;
    const valueToCheck = Array.isArray(fieldValue) ? fieldValue[FIRST_INDEX] : fieldValue;

    // Debug log to see what's being evaluated
    console.log(`[Global Nav] Evaluating condition: stepId=${condition.stepId}, fieldName=${condition.fieldName}, expected=${condition.value}, actual=${valueToCheck}, fieldKey=${fieldKey}, fieldValue=${JSON.stringify(fieldValue)}`);

    if (valueToCheck !== condition.value) {
      return false; // Condition doesn't match
    }
  }

  return true; // All conditions matched
}