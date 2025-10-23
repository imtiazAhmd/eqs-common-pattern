/**
 * Utility functions for common wizard operations
 */

import type { WizardForm, WizardMiddlewareOptions } from './types.js';
import { createWizardRouter } from './middleware.js';
import { readFileSync } from 'node:fs';

/**
 * Create a complete wizard setup with sensible defaults
 */
export function createWizard(
  wizardForm: WizardForm,
  options: Partial<WizardMiddlewareOptions> = {}
): ReturnType<typeof createWizardRouter> {
  const config: WizardMiddlewareOptions = {
    formId: options.formId || 'wizard-form',
    basePath: options.basePath || '/wizard',
    wizardForm,
    sessionPrefix: options.sessionPrefix || 'wizard',
    templatePath: options.templatePath || 'wizard-step',
    csrfProtection: options.csrfProtection !== false,
    progressIndicator: options.progressIndicator !== false,
    successPath: options.successPath,
    backLink: options.backLink
  };

  return createWizardRouter(config);
}

/**
 * Load wizard configuration from JSON file
 */
export function loadWizardFromJSON(filePath: string): WizardForm {
  try {
    const content = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    
    // Basic validation
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid JSON structure');
    }
    
    if (!parsed.title || typeof parsed.title !== 'string') {
      throw new Error('Wizard must have a title');
    }
    
    if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('Wizard must have at least one step');
    }
    
    // Validate each step
    for (let i = 0; i < parsed.steps.length; i++) {
      const step = parsed.steps[i];
      
      if (!step.id || typeof step.id !== 'string') {
        throw new Error(`Step ${i + 1} must have an id`);
      }
      
      if (!step.title || typeof step.title !== 'string') {
        throw new Error(`Step ${i + 1} must have a title`);
      }
      
      if (!Array.isArray(step.fields)) {
        throw new Error(`Step ${i + 1} must have fields array`);
      }
    }
    
    return parsed as WizardForm;
  } catch (error) {
    throw new Error(`Failed to load wizard from JSON: ${error.message}`);
  }
}

/**
 * Validate wizard configuration
 */
export function validateWizardConfig(wizardForm: WizardForm): string[] {
  const errors: string[] = [];
  
  // Check for duplicate step IDs
  const stepIds = wizardForm.steps.map(step => step.id);
  const duplicates = stepIds.filter((id, index) => stepIds.indexOf(id) !== index);
  
  if (duplicates.length > 0) {
    errors.push(`Duplicate step IDs found: ${duplicates.join(', ')}`);
  }
  
  // Validate conditional navigation references
  for (const step of wizardForm.steps) {
    if (step.conditionalNavigation) {
      for (const [fieldName, navigationMap] of Object.entries(step.conditionalNavigation)) {
        // Check if field exists in step
        const fieldExists = step.fields.some(field => field.name === fieldName);
        
        if (!fieldExists) {
          errors.push(`Step "${step.id}" has conditional navigation for non-existent field "${fieldName}"`);
        }
        
        // Check if target steps exist
        for (const [value, targetStepId] of Object.entries(navigationMap)) {
          if (value !== 'default') {
            const targetExists = wizardForm.steps.some(s => s.id === targetStepId);
            
            if (!targetExists) {
              errors.push(`Step "${step.id}" references non-existent target step "${targetStepId}"`);
            }
          }
        }
      }
    }
  }
  
  return errors;
}

/**
 * Generate step mapping for debugging
 */
export function generateStepMap(wizardForm: WizardForm): Record<string, any> {
  return wizardForm.steps.reduce((map, step, index) => {
    map[step.id] = {
      index: index + 1,
      title: step.title,
      fieldCount: step.fields.length,
      hasConditionalNavigation: !!step.conditionalNavigation,
      isTerminalStep: step.isTerminalStep === true,
      isUrgentStep: step.isUrgentStep === true,
      conditionalTargets: step.conditionalNavigation 
        ? Object.values(step.conditionalNavigation).flatMap(nav => Object.values(nav))
        : []
    };
    return map;
  }, {} as Record<string, any>);
}

/**
 * Create a simple wizard with minimal configuration
 */
export function createSimpleWizard(
  formId: string,
  steps: Array<{
    id: string;
    title: string;
    fields: Array<{
      name: string;
      question: string;
      type: 'text' | 'radio' | 'select' | 'textarea';
      required?: boolean;
      options?: string[];
    }>;
  }>
): WizardForm {
  return {
    title: `${formId} Wizard`,
    description: `Multi-step form for ${formId}`,
    steps: steps.map(step => ({
      id: step.id,
      title: step.title,
      fields: step.fields.map(field => ({
        name: field.name,
        question: field.question,
        type: field.type,
        required: field.required || false,
        available_options: field.options
      }))
    }))
  };
}