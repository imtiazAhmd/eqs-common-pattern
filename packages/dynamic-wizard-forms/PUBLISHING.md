# Publishing Your Dynamic Wizard Forms Library

This guide walks you through the complete process of making your dynamic wizard forms implementation into a reusable npm library.

## 🗂️ Package Structure

Your library is now organized as a proper npm package:

```
packages/dynamic-wizard-forms/
├── src/                     # Source TypeScript files
│   ├── index.ts            # Main entry point
│   ├── types.ts            # Type definitions
│   ├── navigator.ts        # Navigation logic
│   ├── validator.ts        # Validation utilities
│   ├── middleware.ts       # Express middleware
│   └── utils.ts           # Utility functions
├── templates/              # Nunjucks templates
│   ├── wizard-step.njk     # Main step template
│   └── form-field.njk      # Field rendering macro
├── examples/               # Example implementation
│   ├── app.js             # Demo Express app
│   ├── config/            # Sample configurations
│   └── package.json       # Example dependencies
├── dist/                  # Built files (generated)
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript config
├── rollup.config.js       # Build configuration
└── README.md              # Documentation
```

## 🚀 Steps to Publish

### 1. Build the Library

```bash
cd packages/dynamic-wizard-forms
npm install
npm run build
```

This creates:
- `dist/index.js` - CommonJS build
- `dist/index.esm.js` - ES modules build  
- `dist/index.d.ts` - TypeScript declarations

### 2. Test Locally

Test with the example project:

```bash
cd examples
npm install
npm start
```

Visit http://localhost:3000 to test the wizard.

### 3. Update Package Details

Edit `package.json`:

```json
{
  "name": "@yourorg/dynamic-wizard-forms",
  "version": "1.0.0",
  "author": "Your Name <your.email@example.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourorg/dynamic-wizard-forms.git"
  },
  "keywords": [
    "wizard", "forms", "conditional", "navigation",
    "express", "nunjucks", "govuk", "typescript"
  ]
}
```

### 4. Create GitHub Repository

```bash
git init
git add .
git commit -m "Initial commit: Dynamic wizard forms library"
git branch -M main
git remote add origin https://github.com/yourorg/dynamic-wizard-forms.git
git push -u origin main
```

### 5. Publish to npm

```bash
# Login to npm (first time only)
npm login

# Publish the package
npm publish --access public

# Or for scoped packages
npm publish --access public
```

## 📦 How Others Will Use It

### Installation

```bash
npm install @yourorg/dynamic-wizard-forms
```

### Basic Usage

```javascript
import express from 'express';
import { createWizard, loadWizardFromJSON } from '@yourorg/dynamic-wizard-forms';

const app = express();

// Configure sessions, templating, etc.
// ...

// Load wizard configuration
const wizardConfig = loadWizardFromJSON('./my-wizard.json');

// Create wizard routes
const wizard = createWizard(wizardConfig, {
  formId: 'my-form',
  basePath: '/wizard'
});

// Setup routes
app.get('/wizard/:formId', wizard.get);
app.post('/wizard/:formId', wizard.post);
app.get('/wizard/:formId/success', wizard.success);
```

### Configuration File

Users create JSON files defining their wizard:

```json
{
  "title": "My Application",
  "steps": [
    {
      "id": "step1",
      "title": "First Step",
      "fields": [
        {
          "question": "What is your name?",
          "type": "text", 
          "name": "name",
          "required": true
        }
      ],
      "conditionalNavigation": {
        "field_name": {
          "value": "next_step_id"
        }
      }
    }
  ]
}
```

## 🔧 Advanced Features

### Custom Templates

Users can override templates:

```javascript
const wizard = createWizard(wizardConfig, {
  templatePath: 'my-custom-wizard-template'
});
```

### Custom Validation

```javascript
import { validateStep } from '@yourorg/dynamic-wizard-forms';

// Add custom validation logic
const customValidation = (field, value) => {
  if (field.name === 'email' && !isValidEmail(value)) {
    return 'Invalid email format';
  }
  return null;
};
```

### Programmatic Navigation

```javascript
import { WizardNavigator } from '@yourorg/dynamic-wizard-forms';

const navigator = new WizardNavigator(wizardConfig, options);
const nextStep = navigator.getNextStepNumber(currentStep, formData);
```

## 📋 Distribution Checklist

- ✅ **Package Structure**: Organized with src/, dist/, templates/
- ✅ **Build System**: Rollup configuration for multiple output formats
- ✅ **TypeScript**: Full type definitions and declarations
- ✅ **Documentation**: Comprehensive README with examples
- ✅ **Templates**: Reusable Nunjucks templates included
- ✅ **Example Project**: Working demonstration
- ✅ **Testing**: Jest configuration (add tests as needed)
- ✅ **Validation**: Input validation and error handling
- ✅ **Session Management**: Built-in session handling
- ✅ **Conditional Logic**: Dynamic step routing
- ✅ **GOV.UK Support**: Compatible with GOV.UK Design System

## 🎯 Key Benefits for Users

### 1. **Zero Configuration Setup**
```javascript
// Just install and use
const wizard = createWizard(myConfig);
```

### 2. **JSON Configuration** 
```json
// No coding required - just configure
{
  "steps": [...],
  "conditionalNavigation": {...}
}
```

### 3. **Full TypeScript Support**
```typescript
// IntelliSense and type safety
import { WizardForm, WizardStep } from '@yourorg/dynamic-wizard-forms';
```

### 4. **Flexible Templates**
- Use provided GOV.UK templates
- Customize with your own branding
- Override specific components

### 5. **Built-in Features**
- Session management
- Form validation  
- Error handling
- Progress indicators
- Conditional navigation
- Terminal/urgent steps

## 🔄 Version Management

### Semantic Versioning
- `1.0.0` - Initial stable release
- `1.0.x` - Bug fixes
- `1.x.0` - New features (backward compatible)
- `2.0.0` - Breaking changes

### Release Process
```bash
# Update version
npm version patch|minor|major

# Build and test
npm run build
npm test

# Publish
npm publish
```

## 📈 Monitoring Usage

Track library adoption:
- npm download statistics
- GitHub stars/forks
- Issue reports and feature requests
- Community contributions

## 🤝 Community & Support

- **GitHub Issues** - Bug reports and feature requests
- **Documentation** - Keep README updated with examples
- **Examples** - Provide real-world use cases
- **Changelog** - Document all changes

Your dynamic wizard forms library is now ready to be shared with the world! 🎉