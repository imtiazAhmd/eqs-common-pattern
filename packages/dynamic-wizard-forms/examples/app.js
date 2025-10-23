/**
 * Example Express.js application using dynamic-wizard-forms library
 */

const express = require('express');
const nunjucks = require('nunjucks');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');

// Import the wizard library
const { createWizard, loadWizardFromJSON } = require('dynamic-wizard-forms');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for demo - configure properly in production
}));

// Session configuration (required for wizard forms)
app.use(session({
  secret: 'demo-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Body parser for form submissions
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files (GOV.UK Frontend assets)
app.use('/govuk-frontend', express.static(path.join(__dirname, 'node_modules/govuk-frontend/govuk')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Configure Nunjucks template engine
const templatePaths = [
  path.join(__dirname, 'views'),
  path.join(__dirname, '../templates'), // Library templates
  path.join(__dirname, 'node_modules/govuk-frontend')
];

nunjucks.configure(templatePaths, {
  autoescape: true,
  express: app,
  watch: true // Enable for development
});

app.set('view engine', 'njk');

// Load wizard configuration from JSON
try {
  const wizardConfig = loadWizardFromJSON(path.join(__dirname, 'config/sample-wizard.json'));
  
  // Create wizard with configuration
  const wizard = createWizard(wizardConfig, {
    formId: 'sample-application',
    basePath: '/wizard',
    sessionPrefix: 'demo_wizard',
    templatePath: 'wizard-step',
    progressIndicator: true,
    backLink: {
      text: 'Back to start',
      href: '/'
    }
  });
  
  // Setup wizard routes
  app.get('/wizard/:formId', wizard.get);
  app.post('/wizard/:formId', wizard.post);
  app.get('/wizard/:formId/success', wizard.success);
  
  console.log('✅ Wizard configured successfully');
  
} catch (error) {
  console.error('❌ Error loading wizard configuration:', error.message);
  process.exit(1);
}

// Home page
app.get('/', (req, res) => {
  res.render('index', {
    pageTitle: 'Dynamic Wizard Forms Demo',
    wizardUrl: '/wizard/sample-application'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    session: !!req.session
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    pageTitle: 'Page not found',
    message: 'The page you were looking for could not be found',
    statusCode: 404
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Application error:', error);
  
  res.status(500).render('error', {
    pageTitle: 'Something went wrong',
    message: 'An unexpected error occurred',
    statusCode: 500,
    error: process.env.NODE_ENV === 'development' ? error : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Demo server running on http://localhost:${PORT}`);
  console.log(`📝 Try the wizard at: http://localhost:${PORT}/wizard/sample-application`);
});

module.exports = app;