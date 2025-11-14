/**
 * TypeScript type definitions for form structures
 */

/**
 * Option item with value and text for select/radio/checkbox fields
 */
export interface OptionItem {
  value: string;
  text: string;
}

/**
 * API configuration for dynamic options
 */
export interface ApiOptionsConfig {
  endpoint: string; // API endpoint path (e.g., /all)
  params?: string; // Query parameters as string (e.g., fields=name&status=active)
  dataPath?: string; // Optional dot notation path to array in response (e.g., results, data.items)
  valuePath: string; // Dot notation path to value in response (e.g., name.common)
  labelPath: string; // Dot notation path to label in response (e.g., name.common)
}

/**
 * Base form field interface
 */
export interface FormField {
  question: string;
  type: 'radio' | 'checkboxes' | 'text' | 'textarea' | 'date' | 'select';
  available_options?: Array<string | OptionItem>;
  required?: boolean;
  validation_rules?: string[];
  hint?: string;
  hintHtml?: boolean; // Whether to render hint as HTML
  hintClass?: string; // Optional CSS classes for hint element
  name?: string;
  useApiOptions?: boolean; // Whether to fetch options from API
  apiConfig?: ApiOptionsConfig; // API configuration for fetching options
}

/**
 * Conditional navigation configuration (step-level - deprecated in favor of global navigation)
 */
export type ConditionalNavigation = Record<string, Record<string, string>>;

/**
 * Navigation condition for global conditional navigation
 */
export interface NavigationCondition {
  stepId: string; // Step containing the field
  fieldName: string; // Name of the field to check
  value: string; // Expected value to match
}

/**
 * Navigation rule with multiple conditions
 */
export interface NavigationRule {
  id: string; // Unique identifier for the rule
  conditions: NavigationCondition[]; // All conditions must match (AND logic)
  targetStepId: string; // Step to navigate to if conditions match
}

/**
 * Global conditional navigation configuration
 */
export type GlobalConditionalNavigation = NavigationRule[];

/**
 * Wizard step interface containing fields and metadata
 */
export interface WizardStep {
  id: string; // Unique identifier for the step
  title?: string; // Only for termination steps
  description?: string; // Only for termination steps
  descriptionHtml?: boolean; // Whether to render description as HTML (termination steps)
  descriptionClass?: string; // Optional CSS classes for description element (termination steps)
  buttonText?: string; // Button text for termination steps (e.g., "View Summary")
  isTerminationStep?: boolean; // Step that ends wizard, only accessible via conditional navigation
  fields: FormField[];
  conditionalNavigation?: ConditionalNavigation; // Deprecated - use globalConditionalNavigation instead
}

/**
 * Wizard form interface containing multiple steps
 */
export interface WizardForm {
  title: string;
  description?: string;
  steps: WizardStep[];
  globalConditionalNavigation?: GlobalConditionalNavigation; // Global navigation rules
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