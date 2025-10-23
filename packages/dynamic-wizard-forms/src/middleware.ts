/**
 * Express.js middleware for dynamic wizard forms
 */

import type { Request, Response, NextFunction } from 'express';
import type { 
  WizardForm, 
  WizardConfig, 
  FormData,
  WizardRenderContext,
  WizardMiddlewareOptions 
} from './types.js';

import { WizardNavigator, parseStepParameter } from './navigator.js';
import { 
  validateStep, 
  createValidationErrors, 
  sanitizeFormData, 
  extractStepFields 
} from './validator.js';

// Session key generator
function getSessionKey(formId: string, key: string, sessionPrefix = 'wizard'): string {
  return `${sessionPrefix}_${formId}_${key}`;
}

// Get data from session
function getSessionData(req: Request, key: string): FormData | null {
  if (!req.session) {
    return null;
  }
  return (req.session as any)[key] || null;
}

// Store data in session
function storeSessionData(req: Request, key: string, data: FormData): void {
  if (req.session) {
    (req.session as any)[key] = data;
  }
}

/**
 * Main wizard controller class
 */
export class WizardController {
  private navigator: WizardNavigator;
  private config: WizardMiddlewareOptions;

  constructor(config: WizardMiddlewareOptions) {
    this.config = config;
    this.navigator = new WizardNavigator(config.wizardForm, config);
  }

  /**
   * Handle GET requests (render step)
   */
  handleGet = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const stepNumber = parseStepParameter(req.query.step);
      
      // Validate step number
      if (!this.navigator.isValidStepNumber(stepNumber)) {
        res.status(400).json({ error: 'Invalid step number' });
        return;
      }

      const currentStep = this.navigator.getStepByIndex(stepNumber);
      if (!currentStep) {
        res.status(404).json({ error: 'Step not found' });
        return;
      }

      // Get existing form data from session
      const sessionKey = getSessionKey(this.config.formId, 'data', this.config.sessionPrefix);
      const sessionData = getSessionData(req, sessionKey) || {};

      // Prepare render context
      const context: WizardRenderContext = {
        formId: this.config.formId,
        formTitle: this.config.wizardForm.title,
        formDescription: this.config.wizardForm.description,
        currentStep: stepNumber,
        totalSteps: this.config.wizardForm.steps.length,
        stepTitle: currentStep.title,
        stepDescription: currentStep.description,
        formConfig: currentStep.fields,
        formData: sessionData,
        csrfToken: this.getCsrfToken(req),
        error: null,
        isFirstStep: this.navigator.isFirstStep(stepNumber),
        isLastStep: this.navigator.isLastStep(stepNumber),
        isTerminalStep: currentStep.isTerminalStep === true,
        isUrgentStep: currentStep.isUrgentStep === true,
        backLink: this.config.backLink
      };

      this.renderStep(res, context);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handle POST requests (process form submission)
   */
  handlePost = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const stepNumber = parseStepParameter(req.query.step);
      
      // Validate step number
      if (!this.navigator.isValidStepNumber(stepNumber)) {
        res.status(400).json({ error: 'Invalid step number' });
        return;
      }

      const currentStep = this.navigator.getStepByIndex(stepNumber);
      if (!currentStep) {
        res.status(404).json({ error: 'Step not found' });
        return;
      }

      // Extract and sanitize form data
      const rawData = sanitizeFormData(req.body);
      const stepData = extractStepFields(currentStep.fields, rawData);

      // Validate step data
      const validation = validateStep(currentStep.fields, stepData);
      
      if (!validation.isValid) {
        // Render step with validation errors
        const context: WizardRenderContext = {
          formId: this.config.formId,
          formTitle: this.config.wizardForm.title,
          formDescription: this.config.wizardForm.description,
          currentStep: stepNumber,
          totalSteps: this.config.wizardForm.steps.length,
          stepTitle: currentStep.title,
          stepDescription: currentStep.description,
          formConfig: currentStep.fields,
          formData: stepData,
          csrfToken: this.getCsrfToken(req),
          error: createValidationErrors(currentStep.fields, validation.errors),
          isFirstStep: this.navigator.isFirstStep(stepNumber),
          isLastStep: this.navigator.isLastStep(stepNumber),
          isTerminalStep: currentStep.isTerminalStep === true,
          isUrgentStep: currentStep.isUrgentStep === true,
          backLink: this.config.backLink
        };

        res.status(400);
        this.renderStep(res, context);
        return;
      }

      // Store step data in session
      const sessionKey = getSessionKey(this.config.formId, 'data', this.config.sessionPrefix);
      const existingData = getSessionData(req, sessionKey) || {};
      const mergedData = { ...existingData, ...stepData };
      storeSessionData(req, sessionKey, mergedData);

      // Handle navigation
      this.handleNavigation(req, res, stepNumber, mergedData);
      
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handle success page
   */
  handleSuccess = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Get final form data from session
      const sessionKey = getSessionKey(this.config.formId, 'data', this.config.sessionPrefix);
      const formData = getSessionData(req, sessionKey) || {};

      // Render success page or redirect
      if (this.config.successPath) {
        res.redirect(this.config.successPath);
      } else {
        res.json({
          message: 'Form submitted successfully',
          data: formData
        });
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Handle navigation based on action
   */
  private handleNavigation(
    req: Request, 
    res: Response, 
    currentStepNumber: number, 
    formData: FormData
  ): void {
    const action = req.body.action || 'next';

    switch (action) {
      case 'previous': {
        const previousStep = this.navigator.getPreviousStepNumber(currentStepNumber);
        if (previousStep) {
          res.redirect(`${this.config.basePath}/${this.config.formId}?step=${previousStep}`);
        } else {
          res.redirect(`${this.config.basePath}/${this.config.formId}?step=${currentStepNumber}`);
        }
        break;
      }
      case 'next': {
        const nextStep = this.navigator.getNextStepNumber(currentStepNumber, formData);
        if (nextStep) {
          res.redirect(`${this.config.basePath}/${this.config.formId}?step=${nextStep}`);
        } else {
          res.redirect(`${this.config.basePath}/${this.config.formId}/success`);
        }
        break;
      }
      case 'submit': {
        res.redirect(`${this.config.basePath}/${this.config.formId}/success`);
        break;
      }
      default: {
        res.redirect(`${this.config.basePath}/${this.config.formId}?step=${currentStepNumber}`);
      }
    }
  }

  /**
   * Render step using template engine
   */
  private renderStep(res: Response, context: WizardRenderContext): void {
    const templatePath = this.config.templatePath || 'wizard-step';
    res.render(templatePath, context);
  }

  /**
   * Get CSRF token from request
   */
  private getCsrfToken(req: Request): string | undefined {
    return typeof (req as any).csrfToken === 'function' ? (req as any).csrfToken() : undefined;
  }
}

/**
 * Create Express router for wizard
 */
export function createWizardRouter(config: WizardMiddlewareOptions) {
  const controller = new WizardController(config);
  
  return {
    get: controller.handleGet,
    post: controller.handlePost,
    success: controller.handleSuccess
  };
}

/**
 * Express middleware factory
 */
export function wizardMiddleware(config: WizardMiddlewareOptions) {
  return createWizardRouter(config);
}