# Visual Form Builder

A web-based GUI for creating JSON wizard form configurations without manually writing JSON.

## Features

- 🎨 **Visual Interface**: Build forms through an intuitive web UI
- ✅ **Real-time Validation**: Validate your configuration before saving
- 📋 **JSON Preview**: Live preview of generated JSON
- 💾 **Import/Export**: Import existing forms or export new ones
- 🔄 **Drag and Reorder**: Easily reorder steps and fields
- 📝 **All Field Types**: Support for text, textarea, radio, checkboxes, select, and date fields
- 🔀 **Conditional Navigation**: Configure step routing based on field values
- 🚨 **Special Steps**: Mark steps as terminal or urgent

## Usage

### Accessing the Form Builder

1. Start your application:
   ```bash
   yarn dev
   ```

2. Navigate to: `http://localhost:3000/form-builder`

### Building a Form

#### 1. **Set Form Details**
   - Enter form title (required)
   - Add optional description

#### 2. **Add Steps**
   - Click "Add Step" to create a new wizard step
   - For each step, configure:
     - **Step ID**: Unique identifier (e.g., `personal_info`)
     - **Step Title**: Display title (e.g., "Personal Information")
     - **Step Description**: Optional explanatory text
     - **Terminal Step**: Check if this step ends the wizard early
     - **Urgent Step**: Check if this requires immediate attention

#### 3. **Add Fields to Steps**
   - Click "Add Field" within a step
   - Configure field properties:
     - **Field Type**: Select from dropdown (text, textarea, radio, etc.)
     - **Field Name**: Variable name (e.g., `full_name`)
     - **Question Text**: What the user sees
     - **Hint Text**: Optional help text
     - **Required**: Check if field is mandatory
     - **Options**: For radio/checkboxes/select, enter one option per line

#### 4. **Reorder Elements**
   - Use "Move up" / "Move down" links on steps and fields
   - Drag and drop support coming soon

#### 5. **Validate Configuration**
   - Click "Validate Configuration" to check for errors
   - Fix any validation issues before saving

#### 6. **Save Your Form**
   - Click "Save to File"
   - Enter a filename (lowercase, letters, numbers, hyphens, underscores only)
   - File is saved to `src/config/your-filename.json`

### Tabs Overview

#### Build Tab
- Main interface for creating form structure
- Add/edit steps and fields
- Configure all field properties

#### JSON Preview Tab
- Click "Update Preview" to see generated JSON
- Copy to clipboard with "Copy JSON" button
- Verify structure before saving

#### Import/Export Tab
- **Export**: Download JSON file to your computer
- **Import**: Paste JSON to load into builder
- **Load Existing**: Select and load forms from `src/config/`

## Field Types

| Type | Description | Options Required |
|------|-------------|------------------|
| `text` | Single-line text input | No |
| `textarea` | Multi-line text input | No |
| `radio` | Radio button group (single choice) | Yes |
| `checkboxes` | Checkbox group (multiple choice) | Yes |
| `select` | Dropdown selection | Yes |
| `date` | GOV.UK date input (day/month/year) | No |

## Configuration Tips

### Step IDs
- Use lowercase letters and underscores
- Examples: `personal_info`, `contact_details`, `case_information`
- Must be unique across all steps

### Field Names
- Use lowercase letters and underscores
- Match your backend variable names
- Examples: `full_name`, `date_of_birth`, `email_address`

### Field Options
For radio, checkboxes, and select fields:
```
Option 1
Option 2
Option 3
```

### Conditional Navigation
While the UI doesn't yet support conditional navigation setup, you can:
1. Export your JSON
2. Manually add `conditionalNavigation` to steps
3. Import back into the builder

Example:
```json
{
  "conditionalNavigation": {
    "field_name": {
      "Yes": "target_step_id",
      "No": "another_step_id"
    }
  }
}
```

## Validation Rules

The validator checks for:
- ✅ Form must have a title
- ✅ Form must have at least one step
- ✅ Each step must have a unique ID
- ✅ Each step must have a title
- ✅ Each step must have at least one field
- ✅ Each field must have a type, name, and question
- ✅ Conditional navigation must reference valid step IDs

## Workflow Example

### Creating a Legal Aid Application Form

1. **Set Form Title**: "Legal Aid Application"
2. **Add Step 1**:
   - ID: `personal_info`
   - Title: "Personal Information"
   - Add fields: `full_name` (text), `date_of_birth` (date), `email` (text)

3. **Add Step 2**:
   - ID: `case_type`
   - Title: "Case Information"
   - Add field: `case_type` (select)
   - Options: Family Law, Housing, Immigration, etc.

4. **Add Step 3**:
   - ID: `financial_info`
   - Title: "Financial Information"
   - Add fields: `monthly_income` (text), `benefits` (checkboxes)

5. **Add Step 4**:
   - ID: `declaration`
   - Title: "Declaration"
   - Add field: `agree` (checkboxes)

6. **Validate** the configuration
7. **Save** as `legal-aid-application.json`
8. **Use** in your dynamic forms controller

## Keyboard Shortcuts

- `Tab`: Navigate between fields
- `Enter`: Submit forms (when focused on buttons)
- `Ctrl+C` / `Cmd+C`: Copy JSON (in preview tab)

## Troubleshooting

### "Validation failed" error
- Check that all required fields are filled
- Ensure step IDs are unique
- Verify field names don't have spaces or special characters
- Confirm options are provided for radio/checkbox/select fields

### "Failed to save file" error
- Check filename uses only lowercase, numbers, hyphens, underscores
- Ensure you have write permissions to `src/config/`
- Try a different filename

### Form doesn't load
- Clear your browser cache
- Check browser console for errors
- Verify the JSON file exists in `src/config/`

## API Endpoints

The form builder uses these endpoints:

- `GET /form-builder` - Load the form builder interface
- `POST /form-builder/validate` - Validate configuration
- `POST /form-builder/save` - Save configuration to file
- `GET /config/:filename.json` - Load existing configuration

## Future Enhancements

- [ ] Visual conditional navigation builder
- [ ] Drag-and-drop reordering
- [ ] Form templates library
- [ ] Field validation rules builder
- [ ] Preview mode (render form as it will appear)
- [ ] Bulk import from Excel/CSV
- [ ] Version control and history
- [ ] Collaboration features

## Related Documentation

- [Dynamic Forms Documentation](../README.md)
- [Form Configuration JSON Schema](../src/types/form-types.ts)
- [GOV.UK Design System](https://design-system.service.gov.uk/)
