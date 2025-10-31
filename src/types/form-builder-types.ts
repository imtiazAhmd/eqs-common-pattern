/**
 * TypeScript type definitions for form builder
 */

import type { WizardForm, WizardStep, FormField } from './form-types.js';

/**
 * Form builder state interface
 */
export interface FormBuilderState {
  formTitle: string;
  formDescription: string;
  steps: WizardStep[];
}

/**
 * Form builder operation result
 */
export interface FormBuilderResult {
  success: boolean;
  message: string;
  data?: WizardForm;
  errors?: string[];
}

/**
 * Field type options for dropdown
 */
export const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'date', label: 'Date Input' }
] as const;

/**
 * Validation result for form builder
 */
export interface BuilderValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Step builder data transfer object
 */
export interface StepBuilderDTO {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  conditionalNavigation?: Record<string, Record<string, string>>;
  isTerminalStep?: boolean;
  isUrgentStep?: boolean;
}

/**
 * Field builder data transfer object
 */
export interface FieldBuilderDTO {
  question: string;
  type: FormField['type'];
  name: string;
  required: boolean;
  hint?: string;
  available_options?: string[];
}
