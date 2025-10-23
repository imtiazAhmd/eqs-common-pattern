/**
 * Dynamic Wizard Forms Library - Core Type Definitions
 * Reusable types for creating conditional wizard forms
 */

/**
 * Supported form field types
 */
export type FieldType = 'radio' | 'checkboxes' | 'text' | 'textarea' | 'date' | 'select';

/**
 * Base form field configuration
 */
export interface FormField {
  question: string;
  type: FieldType;
  name: string;
  available_options?: string[];
  required?: boolean;
  validation_rules?: string[];
  hint?: string;
}

/**
 * Conditional navigation configuration
 */
export type ConditionalNavigation = Record<string, Record<string, string>>;

/**
 * Wizard step configuration with conditional logic
 */
export interface WizardStep {
  id: string; // Unique identifier for the step
  title: string;
  description?: string;
  fields: FormField[];
  conditionalNavigation?: ConditionalNavigation;
  isTerminalStep?: boolean; // Step that ends the wizard early
  isUrgentStep?: boolean; // Step that requires immediate attention
}

/**
 * Complete wizard form configuration
 */
export interface WizardForm {
  title: string;
  description?: string;
  steps: WizardStep[];
}

/**
 * Form data type (can be string or array for multi-select fields)
 */
export type FormData = Record<string, string | string[]>;

/**
 * Validation result for a form step
 */
export interface ValidationResult {
  isValid: boolean;
  data: FormData;
  errors: Record<string, string>;
}

/**
 * Error summary item for display
 */
export interface ErrorSummaryItem {
  text: string;
  href: string;
}

/**
 * Form validation errors structure
 */
export interface FormValidationErrors {
  inputErrors: Record<string, string>;
  errorSummaryList: ErrorSummaryItem[];
}

/**
 * Wizard navigation options
 */
export interface NavigationOptions {
  allowPrevious?: boolean;
  allowNext?: boolean;
  allowSubmit?: boolean;
  customButtons?: Array<{
    label: string;
    action: string;
    classes?: string;
  }>;
}

/**
 * Wizard configuration options
 */
export interface WizardConfig {
  formId: string;
  sessionPrefix?: string;
  templatePath?: string;
  csrfProtection?: boolean;
  progressIndicator?: boolean;
  backLink?: {
    text: string;
    href: string;
  };
}

/**
 * Template rendering context
 */
export interface WizardRenderContext {
  formId: string;
  formTitle: string;
  formDescription?: string;
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  stepDescription?: string;
  formConfig: FormField[];
  formData: FormData;
  csrfToken?: string;
  error?: FormValidationErrors | null;
  isFirstStep: boolean;
  isLastStep: boolean;
  isTerminalStep: boolean;
  isUrgentStep: boolean;
  navigationOptions?: NavigationOptions;
  backLink?: {
    text: string;
    href: string;
  };
}

/**
 * Step navigation result
 */
export interface NavigationResult {
  action: 'redirect' | 'render' | 'error';
  destination?: string;
  context?: WizardRenderContext;
  error?: Error;
}

/**
 * Wizard middleware options
 */
export interface WizardMiddlewareOptions extends WizardConfig {
  wizardForm: WizardForm;
  basePath: string; // e.g., '/wizard'
  successPath?: string; // e.g., '/success'
}