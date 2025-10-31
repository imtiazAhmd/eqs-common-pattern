# Dynamic Wizard Forms - JSON-Driven Form Generation
[![Standards Icon]][Standards Link]

![govuk-frontend 5.10.2](https://img.shields.io/badge/govuk--frontend%20version-5.10.2-005EA5?logo=gov.uk&style=flat)

A flexible, type-safe system for generating multi-step wizard forms from JSON configuration, built with Express, TypeScript, and GOV.UK Design System components.

## Overview

**This is a prototype and the outcome of a Learning & Development project**, led by **Imtiaz Ahmed** (Lead Software Developer, CCQ/MCC Team, LAA Digital). The project investigates how to simplify and standardize form generation across LAA Digital services.

This system enables rapid development of complex, multi-step forms through JSON configuration, eliminating the need to manually code each form page. It supports conditional navigation, field validation, and session management out of the box.

### Visual Form Builder

In addition to the JSON-driven form engine, this project includes a **Visual Form Builder**—a web-based GUI that allows both technical and non-technical users to create, configure, and manage wizard forms without writing JSON manually. The form builder provides:

- **Intuitive Interface**: Build forms visually through a web UI
- **Real-time Validation**: Check configurations before saving
- **Live JSON Preview**: See generated JSON as you build
- **Import/Export**: Load existing forms or export new configurations
- **All Field Types**: Support for text, textarea, radio, checkboxes, select, and date fields
- **Step Management**: Easily add, reorder, and configure wizard steps

Access the form builder at `/form-builder` after starting the application. See the [Visual Form Builder Documentation](./docs/FORM_BUILDER.md) for detailed usage instructions.

For questions or more information, contact: [imtiaz.ahmed@justice.gov.uk](mailto:imtiaz.ahmed@justice.gov.uk)

## Features

- **JSON-Driven Configuration**: Define entire multi-step forms in JSON
- **Conditional Navigation**: Dynamic step routing based on user responses
- **Terminal Steps**: Support for early wizard termination (e.g., eligibility failures)
- **Urgent Steps**: Flag steps requiring immediate attention
- **Type-Safe**: Full TypeScript support with validated types
- **GOV.UK Design System**: Built-in integration with all GDS components
- **Session Management**: Automatic form data persistence across steps
- **Validation**: Server-side validation with error summary generation

## Architecture

### System Flow

```
JSON Config → Controller → Helper Functions → Nunjucks Templates → GOV.UK Macros
     ↓            ↓              ↓                    ↓                  ↓
  Config      Request         Process             Render            Display
  Loading     Handling        Data/Nav            Views             Components
```

### Component Breakdown

#### 1. JSON Configuration (`src/config/*.json`)

Define your wizard form structure:

```json
{
  "title": "Legal Aid Application",
  "description": "Complete application for legal aid assistance",
  "steps": [
    {
      "id": "personal_info",
      "title": "Personal Information",
      "description": "Tell us about yourself",
      "fields": [
        {
          "question": "What is your full name?",
          "type": "text",
          "name": "full_name",
          "required": true,
          "hint": "Enter your full legal name"
        }
      ],
      "conditionalNavigation": {
        "applying_for_other": {
          "Yes": "representative_details",
          "No": "contact_details"
        }
      }
    }
  ]
}
```

**Supported Field Types:**
- `text` - Single-line text input
- `textarea` - Multi-line text input
- `radio` - Radio button group
- `checkboxes` - Checkbox group (multi-select)
- `select` - Dropdown selection
- `date` - GOV.UK date input (day/month/year)

**Conditional Navigation:**

Define step routing based on field values:

```json
"conditionalNavigation": {
  "field_name": {
    "value1": "target_step_id",
    "value2": "another_step_id",
    "default": "fallback_step_id"
  }
}
```

**Special Step Types:**
- `isTerminalStep: true` - Ends the wizard (e.g., user not eligible)
- `isUrgentStep: true` - Flags urgent matters requiring immediate action

#### 2. Controller (`src/controllers/dynamicFormController.ts`)

The controller orchestrates the entire form flow:

**Key Responsibilities:**
- Load and validate JSON configuration
- Handle GET requests to render form steps
- Process POST submissions and validate data
- Manage session storage for multi-step data
- Coordinate navigation between steps

**Main Functions:**

```typescript
// Display available forms
export function getFormsList(req, res, next)

// Render a specific form step
export function getDynamicForm(req, res, next)

// Process form submission and navigate
export function postDynamicForm(req, res, next)

// Display success page with submitted data
export function getFormSuccess(req, res, next)
```

**Request Flow:**

1. **GET `/dynamic-forms/:formId?step=N`**
   - Parse step number from query parameter
   - Load form configuration from JSON
   - Retrieve existing session data
   - Process field configuration
   - Render wizard-step template

2. **POST `/dynamic-forms/:formId?step=N`**
   - Extract form data from request body
   - Validate required fields
   - Store data in session
   - Determine next step (conditional or sequential)
   - Redirect to appropriate step or success page

#### 3. Helper Functions (`src/controllers/wizardFormHelpers.ts`)

Modular utilities for common wizard operations:

**Navigation Helpers:**

```typescript
// Parse step parameter safely
parseStepParameter(stepParam: unknown): number

// Determine next step based on conditional logic
determineNextStep(currentStep, formData): string | null

// Find step index by step ID
findStepIndexById(steps, stepId): number

// Handle conditional navigation with all logic
handleConditionalNavigation(params, res): void
```

**Validation & Rendering:**

```typescript
// Render step with validation errors
renderStepWithErrors(params): void
```

**Data Transformation Helpers (`src/helpers/dataTransformers.ts`):**

```typescript
// Type guards
isRecord(value): boolean
hasProperty(obj, key): boolean

// Form data processing
extractFormFields(body, keys): Record<string, unknown>
dateStringFromThreeFields(day, month, year): string
```

#### 4. Type Definitions (`src/types/form-types.ts`)

TypeScript interfaces ensure type safety:

```typescript
export interface FormField {
  question: string;
  type: 'radio' | 'checkboxes' | 'text' | 'textarea' | 'date' | 'select';
  name?: string;
  required?: boolean;
  hint?: string;
  available_options?: string[];
}

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  conditionalNavigation?: ConditionalNavigation;
  isTerminalStep?: boolean;
  isUrgentStep?: boolean;
}

export interface WizardForm {
  title: string;
  description?: string;
  steps: WizardStep[];
}
```

#### 5. Nunjucks Templates

**Main Template (`views/dynamic-forms/wizard-step.njk`):**

Renders the wizard step with:
- Progress indicator
- Error summary (if validation fails)
- Step title and description
- Form fields (via macro)
- Navigation buttons (Previous/Next/Submit)
- Special handling for terminal/urgent steps

**Key Template Variables:**
- `formId` - Form identifier
- `currentStep` / `totalSteps` - Progress tracking
- `formConfig` - Array of processed fields
- `formData` - Current form data from session
- `error` - Validation errors
- `isTerminalStep` / `isUrgentStep` - Step flags

#### 6. Form Field Macro (`views/dynamic-forms/macros/form-field.njk`)

Dynamically renders GOV.UK components based on field type:

```nunjucks
{% macro renderFormField(field, fieldValue, fieldError, formData) %}
  {% if field.type === 'text' %}
    {{ govukInput({ ... }) }}
  {% elif field.type === 'textarea' %}
    {{ govukTextarea({ ... }) }}
  {% elif field.type === 'radio' %}
    {{ govukRadios({ ... }) }}
  {% elif field.type === 'checkboxes' %}
    {{ govukCheckboxes({ ... }) }}
  {% elif field.type === 'select' %}
    {{ govukSelect({ ... }) }}
  {% elif field.type === 'date' %}
    {{ govukDateInput({ ... }) }}
  {% endif %}
{% endmacro %}
```

**Features:**
- Automatic population from `fieldValue`
- Error message display from `fieldError`
- Hint text support
- Pre-selection of previously entered values
- GOV.UK accessibility standards compliance

## Data Flow Example

### User Journey: Step Navigation

1. **User visits Step 1**
   ```
   GET /dynamic-forms/legal-aid-application?step=1
   ```

2. **Controller processes request:**
   - Loads JSON config
   - Parses step number (1)
   - Retrieves step config from `steps[0]`
   - Checks session for existing data
   - Renders `wizard-step.njk` with step data

3. **User fills form and clicks "Save and continue"**
   ```
   POST /dynamic-forms/legal-aid-application?step=1
   action=next
   full_name=John Smith
   ```

4. **Controller processes submission:**
   - Validates required fields
   - Stores data in session: `wizardForm_legal-aid-application_step_1`
   - Checks conditional navigation rules
   - Determines next step (2 or conditional target)
   - Redirects: `302 → /dynamic-forms/legal-aid-application?step=2`

5. **Template renders:**
   - `wizard-step.njk` loops through `formConfig`
   - Calls `renderFormField` macro for each field
   - Macro selects appropriate GOV.UK component
   - Pre-fills values from session data

### Conditional Navigation Example

Given this config:
```json
"conditionalNavigation": {
  "applying_for_other": {
    "Yes": "representative_details",
    "No": "contact_details"
  }
}
```

**Flow:**
1. User selects "Yes" on "applying_for_other" field
2. `determineNextStep()` checks field value against navigation map
3. Finds match: `"Yes" → "representative_details"`
4. `findStepIndexById()` locates step with id "representative_details"
5. Redirects to that step instead of sequential next step

## Session Management

Form data is stored across steps using Express sessions:

```typescript
// Store step data
storeSessionData(req, `wizardForm_${formId}_step_${stepNumber}`, data)

// Retrieve step data
getSessionData(req, `wizardForm_${formId}_step_${stepNumber}`)

// On final submission, consolidate all steps
consolidateFormData(req, formId, totalSteps)
```

## Validation

Server-side validation ensures data quality:

**Required Field Validation:**
- Checks if required fields have values
- Special handling for date fields (day/month/year)
- Generates error messages and summary

**Error Display:**
- GOV.UK error summary at top of page
- Inline error messages on individual fields
- Accessible error links to problematic fields

## Get Started

### Prerequisites

- node stable version [24.10.0](https://nodejs.org/en/blog/release/v24.10.0/)
- [Yarn 4.9.2](https://yarnpkg.com/) package manager (see installation instructions below)
- TypeScript 5.8.3

#### Installing Yarn

This project uses Yarn 4.9.2 managed by corepack (built into Node.js 16.10+). To ensure all team members use the same version, follow these installation steps:

1. **Enable corepack (if not already enabled):**

   ```shell
   corepack enable
   ```

2. **Install dependencies:**

   ```shell
   yarn install
   ```

3. **Verify the installation:**

   ```shell
   yarn --version
   # Should output: 4.9.2
   ```

**To Note:**

- Corepack automatically uses the Yarn version specified in the `packageManager` field of `package.json`. No additional setup is required once corepack is enabled
- Corepack is the preferred `yarn` way, to install the package manager, instead of `npm install -g yarn` in your ci/cd pipeline
- `yarn install --immutable` ensures that the lockfile (`yarn.lock`) is not modified during the installation process

### Start the application

#### Set local environment variables

Create your local config file `.env` from the template file:

```shell
cp .env.example .env
```

#### Align to the Node Version specified for this project

If using Node Version Manager (nvm), use the following command to switch to the correct version:

```shell
nvm use
nvm install
```

#### Install dependencies and run application for development

```shell
yarn install
yarn build
yarn dev
```

Then, load <http://localhost:3000/> in your browser to access the app.

#### Install dependencies and run application for production

```shell
yarn install
yarn build
yarn start
```

##### Node Version Manager

You may have to tell your local machine to use the latest version of node already installed on your device, before installing and running the application. Use the following command.

```shell
nvm install node
```

##### Running locally with docker

Prerequisites, Docker Desktop

- To build the docker image

  ```shell
  docker build -t your-repo-name:latest .
  ```

- To run the docker image

  ```shell
  docker run -d -p 8888:3000 your-repo-name:latest
  ```

  (The application should be running at <http://localhost:8888>)

- To stop the container

  obtain the container id

  ```shell
  docker ps
  ```

  stop the container

  ```shell
  docker stop {container_id}
  ```

## Creating a New Form

1. **Create JSON configuration** in `src/config/your-form.json`
2. **Update controller** to load your configuration
3. **Add route** in `routes/index.ts`
4. **Test** the wizard flow

Example configuration structure available in `src/config/ccq.json` and `src/config/cla_public.json`.

## Testing

Run the test suite:

```shell
yarn test
```

## GitHub Actions

- These have been disabled in this GitHub template repo. Make sure you enable them when setting up your project.

## Licence

[Licence](./LICENSE)

[Standards Link]: https://operations-engineering-reports.cloud-platform.service.justice.gov.uk/public-report/govuk-frontend-express "Change this to point at your repo. Also needs changing in the url in the icon below."
[Standards Icon]: https://img.shields.io/endpoint?labelColor=231f20&color=005ea5&style=for-the-badge&label=MoJ%20Compliant&url=https%3A%2F%2Foperations-engineering-reports.cloud-platform.service.justice.gov.uk%2Fapi%2Fv1%2Fcompliant_public_repositories%2Fendpoint%2Fgovuk-frontend-express&logo=data:image/png;base64,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
