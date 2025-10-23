# Dynamic Wizard Forms Library

A flexible, configurable wizard form library with conditional navigation for Express.js applications using Nunjucks templates and GOV.UK Design System.

## Features

- ✅ **Conditional Navigation** - Dynamic routing based on user answers
- ✅ **Multi-step Forms** - Break complex forms into manageable steps  
- ✅ **TypeScript Support** - Full type safety and IntelliSense
- ✅ **GOV.UK Design System** - Built-in support for government services
- ✅ **Session Management** - Automatic form data persistence
- ✅ **Validation** - Built-in validation with error handling
- ✅ **Terminal Steps** - End wizard early based on conditions
- ✅ **Urgent Steps** - Special handling for time-sensitive matters

## Installation

```bash
npm install dynamic-wizard-forms
```

## Quick Start

### 1. Basic Setup

```javascript
import express from 'express';
import nunjucks from 'nunjucks';
import session from 'express-session';
import { createWizard, loadWizardFromJSON } from 'dynamic-wizard-forms';

const app = express();

// Configure Nunjucks
nunjucks.configure('views', {
  autoescape: true,
  express: app
});

// Configure sessions (required for form data persistence)
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Parse form data
app.use(express.urlencoded({ extended: true }));

// Load your wizard configuration
const wizardConfig = loadWizardFromJSON('./config/my-wizard.json');

// Create wizard routes
const wizard = createWizard(wizardConfig, {
  formId: 'my-application',
  basePath: '/wizard',
  templatePath: 'wizard-step'
});

// Setup routes
app.get('/wizard/:formId', wizard.get);
app.post('/wizard/:formId', wizard.post);
app.get('/wizard/:formId/success', wizard.success);

app.listen(3000);
```

### 2. Create Wizard Configuration

Create a JSON file defining your wizard steps:

```json
{
  "title": "Application Form",
  "description": "Complete your application",
  "steps": [
    {
      "id": "personal_info",
      "title": "Personal Information",
      "fields": [
        {
          "question": "What is your full name?",
          "type": "text",
          "name": "full_name",
          "required": true
        },
        {
          "question": "Are you over 18?",
          "type": "radio",
          "name": "age_check",
          "required": true,
          "available_options": ["Yes", "No"]
        }
      ],
      "conditionalNavigation": {
        "age_check": {
          "Yes": "contact_details",
          "No": "ineligible"
        }
      }
    },
    {
      "id": "contact_details", 
      "title": "Contact Details",
      "fields": [
        {
          "question": "What is your email?",
          "type": "text",
          "name": "email",
          "required": true
        }
      ]
    },
    {
      "id": "ineligible",
      "title": "Not Eligible", 
      "description": "You must be 18 or over to apply",
      "fields": [
        {
          "question": "Unfortunately you are not eligible at this time",
          "type": "textarea",
          "name": "ineligible_info",
          "hint": "Please contact us when you turn 18"
        }
      ],
      "isTerminalStep": true
    }
  ]
}
```

### 3. Create Templates

Copy the provided templates to your views directory or customize them:

- `wizard-step.njk` - Main wizard step template
- `form-field.njk` - Reusable field rendering macro

## API Reference

### Types

```typescript
interface WizardForm {
  title: string;
  description?: string;
  steps: WizardStep[];
}

interface WizardStep {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  conditionalNavigation?: ConditionalNavigation;
  isTerminalStep?: boolean;
  isUrgentStep?: boolean;
}

interface FormField {
  question: string;
  type: 'text' | 'textarea' | 'radio' | 'checkboxes' | 'select' | 'date';
  name: string;
  required?: boolean;
  available_options?: string[];
  hint?: string;
}
```

### Main Functions

#### `createWizard(wizardForm, options)`

Creates a complete wizard router with all necessary handlers.

**Parameters:**
- `wizardForm: WizardForm` - The wizard configuration
- `options: WizardOptions` - Configuration options

**Returns:**
- Object with `get`, `post`, and `success` handlers

**Options:**
```typescript
interface WizardOptions {
  formId: string;              // Unique form identifier
  basePath?: string;           // Base URL path (default: '/wizard')
  sessionPrefix?: string;      // Session key prefix (default: 'wizard')
  templatePath?: string;       // Template path (default: 'wizard-step')
  csrfProtection?: boolean;    // Enable CSRF (default: true)
  progressIndicator?: boolean; // Show progress bar (default: true)
  successPath?: string;        // Success redirect URL
  backLink?: {                 // Back link configuration
    text: string;
    href: string;
  };
}
```

#### `loadWizardFromJSON(filePath)`

Loads and validates wizard configuration from JSON file.

**Parameters:**
- `filePath: string` - Path to JSON configuration file

**Returns:**
- `WizardForm` - Parsed and validated configuration

#### `createWizardNavigator(wizardForm, config)`

Creates a navigator instance for programmatic step management.

**Parameters:**
- `wizardForm: WizardForm` - Wizard configuration
- `config: WizardConfig` - Navigation configuration

**Returns:**
- `WizardNavigator` - Navigator instance

### Advanced Usage

#### Custom Validation

```javascript
import { validateStep, createValidationErrors } from 'dynamic-wizard-forms';

// Custom field validation
function validateCustomField(field, value) {
  if (field.name === 'email' && value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Enter a valid email address';
    }
  }
  return null;
}

// Use in your middleware
app.post('/wizard/:formId', (req, res, next) => {
  // ... extract step data
  
  const validation = validateStep(currentStep.fields, stepData);
  
  // Add custom validation
  for (const field of currentStep.fields) {
    const error = validateCustomField(field, stepData[field.name]);
    if (error) {
      validation.errors[field.name] = error;
      validation.isValid = false;
    }
  }
  
  // ... continue with validation result
});
```

#### Programmatic Navigation

```javascript
import { WizardNavigator } from 'dynamic-wizard-forms';

const navigator = new WizardNavigator(wizardForm, config);

// Get next step based on form data
const nextStep = navigator.getNextStepNumber(currentStep, formData);

// Check if step can be submitted
const canSubmit = navigator.canSubmitStep(stepNumber);

// Get wizard metadata
const metadata = navigator.getWizardMetadata();
```

## Configuration Examples

### Conditional Navigation

Route users to different steps based on their answers:

```json
{
  "conditionalNavigation": {
    "case_type": {
      "Family Law": "family_details",
      "Criminal Law": "criminal_details", 
      "default": "general_details"
    },
    "urgency": {
      "Yes": "urgent_step",
      "No": "standard_step"
    }
  }
}
```

### Terminal Steps

End the wizard early for certain conditions:

```json
{
  "id": "not_eligible",
  "title": "Application Cannot Proceed",
  "description": "Based on your answers, we cannot process your application",
  "isTerminalStep": true,
  "fields": [
    {
      "question": "Contact information for further assistance",
      "type": "textarea",
      "name": "contact_info",
      "hint": "Call 0800 123 456 for help with your application"
    }
  ]
}
```

### Urgent Steps

Handle time-sensitive situations:

```json
{
  "id": "emergency",
  "title": "Emergency Assistance",
  "description": "This requires immediate attention",
  "isUrgentStep": true,
  "fields": [
    {
      "question": "Describe your emergency situation",
      "type": "textarea",
      "name": "emergency_details",
      "required": true,
      "hint": "Provide as much detail as possible. Someone will contact you within 2 hours."
    }
  ]
}
```

## Field Types

### Text Input
```json
{
  "question": "What is your name?",
  "type": "text",
  "name": "name",
  "required": true,
  "hint": "Enter your full name"
}
```

### Radio Buttons
```json
{
  "question": "Select your preference",
  "type": "radio", 
  "name": "preference",
  "required": true,
  "available_options": ["Option 1", "Option 2", "Option 3"]
}
```

### Checkboxes
```json
{
  "question": "Select all that apply",
  "type": "checkboxes",
  "name": "selections",
  "available_options": ["Choice A", "Choice B", "Choice C"]
}
```

### Select Dropdown
```json
{
  "question": "Choose from the list",
  "type": "select",
  "name": "choice",
  "required": true,
  "available_options": ["Item 1", "Item 2", "Item 3"]
}
```

### Date Input
```json
{
  "question": "What is your date of birth?",
  "type": "date",
  "name": "dob",
  "required": true,
  "hint": "For example, 31 3 1980"
}
```

### Textarea
```json
{
  "question": "Provide additional details",
  "type": "textarea", 
  "name": "details",
  "hint": "Maximum 500 words"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Documentation: [GitHub Pages](https://your-username.github.io/dynamic-wizard-forms)
- Issues: [GitHub Issues](https://github.com/your-username/dynamic-wizard-forms/issues)
- Discussions: [GitHub Discussions](https://github.com/your-username/dynamic-wizard-forms/discussions)