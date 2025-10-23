/**
 * TypeScript type definitions for form structures
 */

/**
 * Base form field interface
 */
export interface FormField {
  question: string;
  type: 'radio' | 'checkboxes' | 'text' | 'textarea' | 'date' | 'select';
  available_options?: string[];
  required?: boolean;
  validation_rules?: string[];
  hint?: string;
  name?: string;
}

/**
 * Conditional navigation configuration
 */
export type ConditionalNavigation = Record<string, Record<string, string>>;

/**
 * Wizard step interface containing fields and metadata
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
 * Wizard form interface containing multiple steps
 */
export interface WizardForm {
  title: string;
  description?: string;
  steps: WizardStep[];
}

/**
 * Type for form configuration (backward compatibility)
 */
export type FormConfig = FormField[] | WizardForm;

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  data: Record<string, string | string[]>;
  errors: Record<string, string>;
}

/**
 * Form data interface
 */
export type FormData = Record<string, string | string[]>;

/**
 * Error summary item
 */
export interface ErrorSummaryItem {
  text: string;
  href: string;
}

/**
 * Form validation errors
 */
export interface FormValidationErrors {
  inputErrors: Record<string, string>;
  errorSummaryList: ErrorSummaryItem[];
}