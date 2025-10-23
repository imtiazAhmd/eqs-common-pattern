/**
 * Core wizard navigation logic - reusable across different applications
 */

import type { 
  WizardStep, 
  WizardForm, 
  FormData, 
  NavigationResult,
  WizardConfig 
} from './types.js';

/**
 * Determine the next step based on conditional logic
 */
export class WizardNavigator {
  private wizardForm: WizardForm;
  private config: WizardConfig;

  constructor(wizardForm: WizardForm, config: WizardConfig) {
    this.wizardForm = wizardForm;
    this.config = config;
  }

  /**
   * Find step by ID
   */
  findStepById(stepId: string): WizardStep | null {
    return this.wizardForm.steps.find(step => step.id === stepId) || null;
  }

  /**
   * Find step index by ID (1-based)
   */
  findStepIndexById(stepId: string): number {
    const index = this.wizardForm.steps.findIndex(step => step.id === stepId);
    return index >= 0 ? index + 1 : -1;
  }

  /**
   * Get step by index (1-based)
   */
  getStepByIndex(stepNumber: number): WizardStep | null {
    const index = stepNumber - 1;
    if (index < 0 || index >= this.wizardForm.steps.length) {
      return null;
    }
    return this.wizardForm.steps[index];
  }

  /**
   * Determine next step based on conditional logic
   */
  determineNextStep(currentStep: WizardStep, formData: FormData): string | null {
    if (!currentStep.conditionalNavigation) {
      return null; // Use sequential navigation
    }

    // Check each field's conditional navigation
    for (const [fieldName, navigationMap] of Object.entries(currentStep.conditionalNavigation)) {
      const fieldValue = formData[fieldName];
      
      if (fieldValue === undefined) {
        continue;
      }

      // Get the value to check (first item if array)
      const valueToCheck = Array.isArray(fieldValue) ? fieldValue[0] : fieldValue;
      
      // Check for exact match in navigation map
      const targetStep = navigationMap[valueToCheck];
      if (targetStep !== undefined) {
        return targetStep;
      }
      
      // Check for default fallback
      const defaultStep = navigationMap.default;
      if (defaultStep !== undefined) {
        return defaultStep;
      }
    }
    
    return null;
  }

  /**
   * Calculate next step number
   */
  getNextStepNumber(currentStepNumber: number, formData: FormData): number | null {
    const currentStep = this.getStepByIndex(currentStepNumber);
    if (!currentStep) {
      return null;
    }

    // Check for conditional navigation
    const nextStepId = this.determineNextStep(currentStep, formData);
    if (nextStepId) {
      return this.findStepIndexById(nextStepId);
    }

    // Sequential navigation
    const nextStep = currentStepNumber + 1;
    return nextStep <= this.wizardForm.steps.length ? nextStep : null;
  }

  /**
   * Calculate previous step number
   */
  getPreviousStepNumber(currentStepNumber: number): number | null {
    const previousStep = currentStepNumber - 1;
    return previousStep >= 1 ? previousStep : null;
  }

  /**
   * Check if step is the first step
   */
  isFirstStep(stepNumber: number): boolean {
    return stepNumber === 1;
  }

  /**
   * Check if step is the last step
   */
  isLastStep(stepNumber: number): boolean {
    return stepNumber === this.wizardForm.steps.length;
  }

  /**
   * Check if step can be submitted (terminal, urgent, or last step)
   */
  canSubmitStep(stepNumber: number): boolean {
    const step = this.getStepByIndex(stepNumber);
    if (!step) {
      return false;
    }

    return (
      step.isTerminalStep === true ||
      step.isUrgentStep === true ||
      this.isLastStep(stepNumber)
    );
  }

  /**
   * Generate URLs for navigation
   */
  generateStepUrl(stepNumber: number): string {
    const { formId } = this.config;
    return `/dynamic-forms/${formId}?step=${stepNumber}`;
  }

  /**
   * Generate success URL
   */
  generateSuccessUrl(): string {
    const { formId } = this.config;
    return `/dynamic-forms/${formId}/success`;
  }

  /**
   * Validate step number
   */
  isValidStepNumber(stepNumber: number): boolean {
    return stepNumber >= 1 && stepNumber <= this.wizardForm.steps.length;
  }

  /**
   * Get wizard metadata
   */
  getWizardMetadata() {
    return {
      title: this.wizardForm.title,
      description: this.wizardForm.description,
      totalSteps: this.wizardForm.steps.length,
      steps: this.wizardForm.steps.map((step, index) => ({
        id: step.id,
        title: step.title,
        description: step.description,
        stepNumber: index + 1,
        isTerminalStep: step.isTerminalStep === true,
        isUrgentStep: step.isUrgentStep === true
      }))
    };
  }
}

/**
 * Utility function to create a navigator instance
 */
export function createWizardNavigator(
  wizardForm: WizardForm, 
  config: WizardConfig
): WizardNavigator {
  return new WizardNavigator(wizardForm, config);
}

/**
 * Parse step parameter safely
 */
export function parseStepParameter(stepParam: unknown): number {
  if (typeof stepParam !== 'string') {
    return 1;
  }
  const parsed = parseInt(stepParam, 10);
  return Number.isNaN(parsed) ? 1 : parsed;
}