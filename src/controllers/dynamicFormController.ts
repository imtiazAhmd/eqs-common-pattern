/**
 * Dynamic Form Controller for handling wizard form generation and submission
 */

import type { Request, Response, NextFunction } from 'express';
import type { FormField, WizardForm } from '../types/form-types.js';
import { storeSessionData, getSessionData } from '../scripts/helpers/sessionHelpers.js';
import {
  parseStepParameter,
  renderStepWithErrors,
  DEFAULT_STEP,
  FIRST_STEP_INDEX
} from './wizardFormHelpers.js';
import {
  trackVisitedStep,
  handleWizardNavigation
} from './navigationHelpers.js';
import { isRecord } from '../helpers/dataTransformers.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isWizardForm,
  hasFormId,
  processFormConfig,
  validateStepData,
  validateFormRequest,
  validateAndGetCurrentStep,
  extractAndConvertFormData,
  convertFormDataForSession,
  consolidateFormData,
  clearFormSessionData
} from '../helpers/dynamicFormHelpers.js';

const FORM_JSON = 'poc-show.json';

// Load wizard form configuration from JSON
const FORM_CONFIG_PATH = join(process.cwd(), 'src', 'config', FORM_JSON);

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

// Constants for step navigation
const SINGLE_ITEM_SLICE = 1;
const EMPTY_ARRAY_LENGTH = 0;

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
 * GET controller for rendering a dynamic wizard form step
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function getDynamicForm(req: RequestWithCSRF, res: Response, next: NextFunction): void {
  void (async () => {
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
      const processedFields = await processFormConfig(currentStep.fields);
      const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;

      // Clear all session data when starting a new form (step 1)
      if (stepNumber === DEFAULT_STEP) {
        clearFormSessionData(req, formId);
      }

      // Get any existing form data from session
      const sessionData = getSessionData(req, `wizardForm_${formId}`) ?? {};

      // Check if this is a termination step
      if (currentStep.isTerminationStep === true) {
        res.render('dynamic-forms/termination-step', {
          formId,
          stepTitle: currentStep.title,
          stepDescription: currentStep.description,
          descriptionHtml: currentStep.descriptionHtml === true,
          descriptionClass: currentStep.descriptionClass,
          buttonText: currentStep.buttonText,
          csrfToken
        });
        return;
      }

      res.render('dynamic-forms/wizard-step', {
        formId,
        formTitle: wizardForm.title,
        formDescription: wizardForm.description,
        currentStep: stepNumber,
        totalSteps: wizardForm.steps.length,
        formConfig: processedFields,
        formData: sessionData,
        csrfToken,
        error: null,
        isFirstStep: stepNumber === DEFAULT_STEP,
        isLastStep: stepNumber === wizardForm.steps.length
      });
    } catch (error) {
      next(error);
    }
  })();
}

/**
 * POST controller for processing wizard form submissions and navigation
 * @param {RequestWithCSRF} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 */
export function postDynamicForm(req: RequestWithCSRF, res: Response, next: NextFunction): void {
  void (async () => {
    try {
      const formId = validateFormRequest(req, res);
      if (formId === null) return;

      const wizardForm = WIZARD_FORM_CONFIG;
      const stepNumber = parseStepParameter(req.query.step);

      const currentStep = validateAndGetCurrentStep(wizardForm, stepNumber, res);
      if (currentStep === null) return;

      const processedFields = await processFormConfig(currentStep.fields);
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

      // Track visited steps for back navigation
      trackVisitedStep(req, formId, stepNumber);

      // Extract action safely from request body
      const { action: actionValue } = isRecord(req.body) ? req.body : { action: undefined };
      const action = typeof actionValue === 'string' ? actionValue : '';

      // If this is the final step and submitting, consolidate all step data
      if (action === 'submit' && stepNumber === wizardForm.steps.length) {
        consolidateFormData(req, formId, wizardForm.steps.length);
      }

      // Handle navigation with global and step-level conditional rules
      handleWizardNavigation(req, res, wizardForm, {
        action,
        stepNumber,
        formId,
        totalSteps: wizardForm.steps.length,
        currentStep,
        allSteps: wizardForm.steps,
        formData
      });

    } catch (error) {
      next(error);
    }
  })();
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

    // If this is a POST, consolidate all step data before rendering success
    if (req.method === 'POST') {
      consolidateFormData(req, formId, wizardForm.steps.length);
    }

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