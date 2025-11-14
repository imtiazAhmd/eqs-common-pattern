/**
 * Navigation helper functions for wizard forms
 */

import type { Request, Response } from 'express';
import type { WizardForm, WizardStep } from '../types/form-types.js';
import { getSessionData, storeSessionData } from '../scripts/helpers/sessionHelpers.js';
import { evaluateGlobalNavigation, handleConditionalNavigation, DEFAULT_STEP } from './wizardFormHelpers.js';

/**
 * Track visited steps in session for back navigation
 * @param {Request} req - Express request object
 * @param {string} formId - Form identifier
 * @param {number} stepNumber - Current step number
 */
export function trackVisitedStep(req: Request, formId: string, stepNumber: number): void {
  const visitedStepsData = getSessionData(req, `wizardForm_${formId}_visitedSteps`);
  const visitedSteps: number[] = Array.isArray(visitedStepsData) 
    ? visitedStepsData.map(v => typeof v === 'number' ? v : Number(v)).filter(n => !isNaN(n))
    : [];
  
  if (!visitedSteps.includes(stepNumber)) {
    visitedSteps.push(stepNumber);
    storeSessionData(req, `wizardForm_${formId}_visitedSteps`, { steps: visitedSteps.join(',') });
  }
}

/**
 * Get consolidated form data from all visited steps
 * @param {Request} req - Express request object
 * @param {string} formId - Form identifier
 * @param {number} currentStepNumber - Current step number
 * @returns {Record<string, string>} Consolidated form data
 */
export function getConsolidatedFormData(
  req: Request, 
  formId: string, 
  currentStepNumber: number
): Record<string, string> {
  const consolidatedData: Record<string, string> = {};
  const FIRST_STEP = 1;
  
  for (let step = FIRST_STEP; step <= currentStepNumber; step += FIRST_STEP) {
    const stepData = getSessionData(req, `wizardForm_${formId}_step_${step}`) ?? {};
    Object.assign(consolidatedData, stepData);
  }
  
  return consolidatedData;
}

/**
 * Parameters for global navigation processing
 */
interface GlobalNavigationParams {
  wizardForm: WizardForm;
  consolidatedData: Record<string, string>;
  action: string;
  formId: string;
  res: Response;
  currentStepNumber: number;
}

/**
 * Process global navigation and redirect if rule matches
 * @param {GlobalNavigationParams} params - Navigation parameters
 * @returns {boolean} True if redirect happened, false otherwise
 */
export function processGlobalNavigation(params: GlobalNavigationParams): boolean {
  const { wizardForm, consolidatedData, action, formId, res, currentStepNumber } = params;
  
  const JSON_INDENT = 2;
  console.log(`[Global Nav] Processing global navigation - action: ${action}, currentStep: ${currentStepNumber}, consolidatedData:`, JSON.stringify(consolidatedData, null, JSON_INDENT));
  
  const targetStepId = evaluateGlobalNavigation(
    wizardForm.globalConditionalNavigation,
    consolidatedData,
    wizardForm.steps
  );

  console.log(`[Global Nav] Evaluated targetStepId: ${targetStepId}`);

  const NOT_FOUND_INDEX = -1;
  if (targetStepId !== null && (action === 'next' || action === 'continue' || action === 'submit')) {
    const targetStepIndex = wizardForm.steps.findIndex(s => s.id === targetStepId);
    if (targetStepIndex !== NOT_FOUND_INDEX) {
      const targetStepNumber = targetStepIndex + DEFAULT_STEP;
      
      // Don't redirect to the current step (avoid loops)
      if (targetStepNumber === currentStepNumber) {
        console.log(`[Global Nav] Target step ${targetStepNumber} is current step, skipping redirect to avoid loop`);
        return false;
      }
      
      // Check if target step is a termination step
      const [targetStepData] = [wizardForm.steps[targetStepIndex]];
      const isTerminationTarget = targetStepData.isTerminationStep === true;
      
      // Only allow forward navigation or navigation to termination steps
      // Don't allow backward navigation to regular steps (prevents loops)
      if (targetStepNumber < currentStepNumber && !isTerminationTarget) {
        console.log(`[Global Nav] Target step ${targetStepNumber} is before current step ${currentStepNumber} and not a termination step, skipping backward navigation`);
        return false;
      }
      
      console.log(`[Global Nav] Redirecting to step ${targetStepNumber} (${targetStepId})`);
      res.redirect(`/dynamic-forms/${formId}?step=${targetStepNumber}`);
      return true;
    }
  }
  
  console.log(`[Global Nav] No redirect - targetStepId: ${targetStepId}, action: ${action}`);
  return false;
}

/**
 * Navigation parameters for standard conditional navigation
 */
interface NavigationParams {
  action: string;
  stepNumber: number;
  formId: string;
  totalSteps: number;
  currentStep: WizardStep;
  allSteps: WizardStep[];
  formData: Record<string, string | string[]>;
}

/**
 * Handle wizard navigation with global rules, fallback to step-level
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {WizardForm} wizardForm - Wizard form configuration
 * @param {NavigationParams} navParams - Navigation parameters
 */
export function handleWizardNavigation(
  req: Request,
  res: Response,
  wizardForm: WizardForm,
  navParams: NavigationParams
): void {
  const { action, stepNumber, formId, currentStep } = navParams;
  
  // Check if current step is a termination step
  if (currentStep.isTerminationStep === true) {
    // Termination steps have no navigation - redirect to form list
    res.redirect('/dynamic-forms');
    return;
  }
  
  // Get consolidated data for global navigation evaluation
  const consolidatedData = getConsolidatedFormData(req, formId, stepNumber);

  // Check for global conditional navigation rules and redirect if matched
  const globalNavigationHandled = processGlobalNavigation({
    wizardForm,
    consolidatedData,
    action,
    formId,
    res,
    currentStepNumber: stepNumber
  });
  
  if (globalNavigationHandled) {
    return;
  }

  // Fall back to standard conditional navigation
  handleConditionalNavigation(navParams, res);
}
