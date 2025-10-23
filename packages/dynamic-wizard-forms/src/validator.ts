/**
 * Form validation utilities for wizard forms
 */

import type { 
  FormField, 
  FormData, 
  ValidationResult, 
  ErrorSummaryItem,
  FormValidationErrors 
} from './types.js';

/**
 * Validate a single field
 */
export function validateField(
  field: FormField, 
  value: string | string[] | undefined
): string | null {
  // Check required fields
  if (field.required) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      return `${field.question} is required`;
    }
  }

  // Skip further validation if field is empty and not required
  if (value === undefined || value === '') {
    return null;
  }

  // Type-specific validation
  switch (field.type) {
    case 'text': {
      if (typeof value !== 'string') {
        return `${field.question} must be text`;
      }
      break;
    }
    case 'textarea': {
      if (typeof value !== 'string') {
        return `${field.question} must be text`;
      }
      break;
    }
    case 'radio': {
      if (typeof value !== 'string') {
        return `${field.question} must have a single selection`;
      }
      if (field.available_options && !field.available_options.includes(value)) {
        return `${field.question} must be one of the available options`;
      }
      break;
    }
    case 'select': {
      if (typeof value !== 'string') {
        return `${field.question} must have a single selection`;
      }
      if (field.available_options && !field.available_options.includes(value)) {
        return `${field.question} must be one of the available options`;
      }
      break;
    }
    case 'checkboxes': {
      if (!Array.isArray(value)) {
        return `${field.question} must be an array`;
      }
      if (field.available_options) {
        for (const item of value) {
          if (!field.available_options.includes(item)) {
            return `${field.question} contains invalid options`;
          }
        }
      }
      break;
    }
    case 'date': {
      // Date validation would typically be handled by date components
      // This is a placeholder for custom date validation logic
      break;
    }
  }

  return null;
}

/**
 * Validate all fields in a step
 */
export function validateStep(
  fields: FormField[], 
  formData: FormData
): ValidationResult {
  const errors: Record<string, string> = {};
  
  for (const field of fields) {
    const fieldName = field.name;
    const fieldValue = formData[fieldName];
    const error = validateField(field, fieldValue);
    
    if (error) {
      errors[fieldName] = error;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    data: formData,
    errors
  };
}

/**
 * Create error summary list for display
 */
export function createErrorSummary(
  fields: FormField[], 
  errors: Record<string, string>
): ErrorSummaryItem[] {
  const errorSummaryList: ErrorSummaryItem[] = [];
  
  for (const field of fields) {
    const fieldName = field.name;
    const error = errors[fieldName];
    
    if (error) {
      errorSummaryList.push({
        text: error,
        href: `#${fieldName}`
      });
    }
  }

  return errorSummaryList;
}

/**
 * Create complete validation errors object
 */
export function createValidationErrors(
  fields: FormField[],
  errors: Record<string, string>
): FormValidationErrors {
  return {
    inputErrors: errors,
    errorSummaryList: createErrorSummary(fields, errors)
  };
}

/**
 * Sanitize and normalize form data
 */
export function sanitizeFormData(rawData: Record<string, unknown>): FormData {
  const sanitized: FormData = {};
  
  for (const [key, value] of Object.entries(rawData)) {
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else if (Array.isArray(value)) {
      sanitized[key] = value
        .filter(item => typeof item === 'string')
        .map(item => item.trim());
    }
  }
  
  return sanitized;
}

/**
 * Extract form fields for a specific step
 */
export function extractStepFields(
  fields: FormField[], 
  rawData: Record<string, unknown>
): FormData {
  const stepData: FormData = {};
  
  for (const field of fields) {
    const fieldName = field.name;
    const value = rawData[fieldName];
    
    if (value !== undefined) {
      if (field.type === 'date') {
        // Handle GOV.UK date component format
        const dayValue = rawData[`${fieldName}-day`];
        const monthValue = rawData[`${fieldName}-month`];
        const yearValue = rawData[`${fieldName}-year`];
        
        if (dayValue && monthValue && yearValue) {
          stepData[fieldName] = `${yearValue}-${String(monthValue).padStart(2, '0')}-${String(dayValue).padStart(2, '0')}`;
        }
        
        // Also store individual components
        if (dayValue) stepData[`${fieldName}_day`] = String(dayValue);
        if (monthValue) stepData[`${fieldName}_month`] = String(monthValue);
        if (yearValue) stepData[`${fieldName}_year`] = String(yearValue);
      } else {
        stepData[fieldName] = Array.isArray(value) ? value : String(value);
      }
    }
  }
  
  return stepData;
}

/**
 * Merge form data from multiple steps
 */
export function mergeFormData(...dataSets: FormData[]): FormData {
  const merged: FormData = {};
  
  for (const dataSet of dataSets) {
    Object.assign(merged, dataSet);
  }
  
  return merged;
}