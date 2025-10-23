/**
 * Dynamic Wizard Forms Library
 * 
 * A flexible, configurable wizard form library with conditional navigation
 * for Express.js applications using Nunjucks templates.
 * 
 * @author Your Name
 * @version 1.0.0
 */

// Export all types
export type {
  FieldType,
  FormField,
  ConditionalNavigation,
  WizardStep,
  WizardForm,
  FormData,
  ValidationResult,
  ErrorSummaryItem,
  FormValidationErrors,
  NavigationOptions,
  WizardConfig,
  WizardRenderContext,
  NavigationResult,
  WizardMiddlewareOptions
} from './types.js';

// Export core classes and functions
export { 
  WizardNavigator, 
  createWizardNavigator, 
  parseStepParameter 
} from './navigator.js';

export {
  validateField,
  validateStep,
  createErrorSummary,
  createValidationErrors,
  sanitizeFormData,
  extractStepFields,
  mergeFormData
} from './validator.js';

export {
  WizardController,
  createWizardRouter,
  wizardMiddleware
} from './middleware.js';

// Utility functions for common use cases
export { createWizard, loadWizardFromJSON } from './utils.js';