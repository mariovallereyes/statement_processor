# Bank Statement Processor - User Guide

## Overview

The Bank Statement Processor is a privacy-first web application that helps you process Bank of America statements using artificial intelligence. All processing happens locally in your browser - your financial data never leaves your device.

## Key Features

- **🔒 Complete Privacy**: All processing happens locally in your browser
- **🤖 AI-Powered**: Advanced machine learning for transaction extraction and classification
- **📊 Smart Export**: Export to QuickBooks and other accounting formats
- **🎯 Learning System**: Improves accuracy based on your corrections
- **⚡ Offline Ready**: Works without internet after initial load
- **🔄 Rule Management**: Create custom rules for automatic classification

## Getting Started

### System Requirements

- **Browser**: Chrome 80+, Firefox 75+, Safari 13+, or Edge 80+
- **Memory**: At least 4GB RAM recommended for large files
- **Storage**: 100MB free space for AI models and caching
- **Internet**: Required for initial load, then works offline

### First Time Setup

1. **Open the Application**
   - Navigate to the application URL in your browser
   - Allow the app to download AI models (one-time setup)
   - The app will show "Ready" when setup is complete

2. **Take the Tour** (Optional)
   - Click the 🎯 button in the top-right corner
   - Follow the guided tour to learn key features
   - You can retake the tour anytime with `Ctrl+H`

## Processing Bank Statements

### Step 1: Upload Your Statement

1. **Supported Formats**
   - PDF statements from Bank of America
   - CSV exports from Bank of America online banking
   - Maximum file size: 50MB

2. **Upload Methods**
   - **Drag & Drop**: Drag your file onto the upload area
   - **Browse**: Click "browse" to select a file
   - **Keyboard**: Press `Ctrl+U` to open file picker

3. **File Validation**
   - The app automatically validates Bank of America formats
   - Invalid files will show helpful error messages
   - Supported file types are clearly indicated

### Step 2: AI Processing

The app automatically processes your statement through several stages:

1. **File Upload** ✅
   - Validates file format and size
   - Prepares file for processing

2. **Data Extraction** 🔄
   - **PDF Files**: Uses OCR and document understanding
   - **CSV Files**: Intelligent column mapping and parsing
   - Extracts transactions, dates, amounts, and descriptions

3. **AI Classification** 🤖
   - Analyzes transaction descriptions using NLP
   - Assigns categories based on merchant patterns
   - Calculates confidence scores for each classification

4. **Review Ready** ✅
   - Determines if manual review is needed
   - High-confidence transactions may be auto-approved
   - Uncertain transactions are flagged for your review

### Step 3: Review and Correct

#### Understanding Confidence Indicators

- **🟢 High Confidence (90%+)**: Likely accurate, minimal review needed
- **🟡 Medium Confidence (70-89%)**: Review recommended
- **🔴 Low Confidence (<70%)**: Manual verification required

#### Transaction Review Interface

1. **Transaction List**
   - View all extracted transactions
   - Sort by date, amount, or confidence
   - Filter by category or confidence level

2. **Editing Transactions**
   - Click any transaction to edit details
   - Modify category, subcategory, or description
   - Add notes or tags for future reference

3. **Bulk Operations**
   - Select multiple transactions with checkboxes
   - Apply category changes to multiple transactions
   - Create rules based on selected transactions

#### Category Management

1. **Standard Categories**
   - Pre-loaded with common accounting categories
   - Organized by business and personal use
   - Compatible with QuickBooks and other software

2. **Custom Categories**
   - Create your own categories and subcategories
   - Organize categories to match your needs
   - Categories are saved for future use

### Step 4: Rule Management

Create rules to automatically classify similar transactions in the future.

#### Creating Rules

1. **From Transaction Review**
   - Select transactions with similar patterns
   - Click "Create Rule" in the bulk actions menu
   - The app suggests rule conditions automatically

2. **Manual Rule Creation**
   - Go to "Manage Rules" section
   - Click "Create New Rule"
   - Define conditions and actions

#### Rule Conditions

- **Merchant Name**: Contains, equals, starts with, ends with
- **Amount**: Equals, greater than, less than, between
- **Description**: Contains keywords or patterns
- **Date Range**: Specific dates or recurring patterns

#### Rule Actions

- **Set Category**: Assign specific category and subcategory
- **Set Description**: Standardize transaction descriptions
- **Add Tags**: Apply labels for organization
- **Set Confidence**: Override AI confidence scores

#### Rule Management

- **Priority System**: Higher priority rules are applied first
- **Rule Testing**: Preview rule effects before saving
- **Rule History**: Track rule performance and usage
- **Import/Export**: Share rules between devices or users

### Step 5: Duplicate Detection

The app automatically identifies potential duplicate transactions.

#### Duplicate Detection Criteria

- **Exact Matches**: Same date, amount, and description
- **Near Matches**: Similar amounts and dates within tolerance
- **Pattern Matches**: Recurring transactions with slight variations

#### Resolving Duplicates

1. **Review Duplicates**
   - View grouped potential duplicates
   - See similarity scores and reasons
   - Compare transaction details side-by-side

2. **Resolution Options**
   - **Keep All**: No duplicates, keep all transactions
   - **Keep First**: Remove later occurrences
   - **Keep Last**: Remove earlier occurrences
   - **Custom Selection**: Choose specific transactions to keep
   - **Remove All**: Delete entire duplicate group

### Step 6: Export Results

#### Export Formats

1. **QuickBooks Online**
   - Standard QBO CSV format
   - Includes all required fields
   - Ready for direct import

2. **QuickBooks Desktop**
   - IIF format for older QuickBooks versions
   - Maintains category mappings
   - Preserves transaction relationships

3. **Generic CSV**
   - Customizable column layout
   - Compatible with Excel and other tools
   - Includes all transaction metadata

4. **JSON**
   - Complete data export with all details
   - Includes confidence scores and AI metadata
   - Suitable for custom integrations

#### Export Options

- **Date Range**: Export specific time periods
- **Category Filter**: Export only certain categories
- **Confidence Filter**: Export only high-confidence transactions
- **Include Metadata**: Add AI confidence and processing info

## Advanced Features

### Keyboard Shortcuts

- `Ctrl+U`: Upload new file
- `Ctrl+H`: Show onboarding tour
- `?`: Display keyboard shortcuts
- `Alt+1`: Focus upload area
- `Escape`: Close dialogs and modals
- `Tab`: Navigate between form fields
- `Enter`: Confirm actions and submit forms

### Offline Functionality

The app works completely offline after initial setup:

1. **Offline Capabilities**
   - Process statements without internet
   - All AI models cached locally
   - Data stored in browser storage
   - Export functionality available offline

2. **Sync When Online**
   - AI models update automatically
   - Performance improvements downloaded
   - No user data is transmitted

### Performance Optimization

1. **Large File Handling**
   - Files processed in chunks to prevent memory issues
   - Progress indicators for long operations
   - Automatic cleanup of temporary data

2. **Memory Management**
   - Efficient processing of large statements
   - Automatic garbage collection
   - Memory usage monitoring and alerts

### Data Privacy and Security

1. **Local Processing**
   - All data remains on your device
   - No cloud processing or storage
   - No account creation required

2. **Data Storage**
   - Uses browser's secure storage (IndexedDB)
   - Data encrypted in browser storage
   - Automatic cleanup of old data

3. **Session Management**
   - Work saved automatically
   - Resume processing after browser restart
   - Clear data option for shared computers

## Troubleshooting

### Common Issues

#### File Upload Problems

**Problem**: File won't upload or shows error
**Solutions**:
- Verify file is from Bank of America
- Check file size is under 50MB
- Ensure file isn't corrupted or password-protected
- Try a different browser

**Problem**: PDF text extraction fails
**Solutions**:
- Ensure PDF contains text (not just images)
- Try downloading a fresh copy from your bank
- Check if PDF is password-protected
- Use CSV format if available

#### Processing Issues

**Problem**: AI classification is inaccurate
**Solutions**:
- Review and correct classifications to improve learning
- Create specific rules for recurring transactions
- Check transaction descriptions for clarity
- Verify merchant names are recognizable

**Problem**: Slow processing speed
**Solutions**:
- Close other browser tabs to free memory
- Process smaller files or date ranges
- Clear browser cache and reload
- Restart browser if memory usage is high

#### Export Problems

**Problem**: Export file won't download
**Solutions**:
- Check browser's download settings
- Disable popup blockers for the site
- Try a different export format
- Clear browser cache and retry

**Problem**: QuickBooks won't import file
**Solutions**:
- Verify you selected the correct QuickBooks format
- Check that all required fields are populated
- Ensure date formats match QuickBooks settings
- Try importing a smaller batch first

### Performance Tips

1. **Optimize Browser**
   - Use latest browser version
   - Close unnecessary tabs
   - Clear cache periodically
   - Disable unnecessary extensions

2. **File Management**
   - Process statements in monthly batches
   - Use CSV format when possible (faster than PDF)
   - Remove old processed files from browser storage
   - Export and backup processed data regularly

3. **Rule Optimization**
   - Create specific rules for common transactions
   - Use rule priorities effectively
   - Test rules before applying to large datasets
   - Review and update rules periodically

### Browser-Specific Issues

#### Chrome
- Enable "Allow sites to save and read cookie data" for full functionality
- If service worker issues occur, go to chrome://settings/content/all and clear site data

#### Firefox
- Ensure "Enhanced Tracking Protection" allows the site
- Check that IndexedDB is enabled in about:config

#### Safari
- Enable "Prevent cross-site tracking" exceptions for the site
- Ensure "Block all cookies" is not enabled

#### Edge
- Similar to Chrome, check site permissions
- Ensure "Tracking prevention" allows the site

## Getting Help

### Built-in Help

1. **Contextual Help**
   - Click the ❓ icon next to any feature
   - Hover over elements for tooltips
   - Use the help button in the top navigation

2. **Onboarding Tour**
   - Comprehensive walkthrough of all features
   - Available anytime with `Ctrl+H`
   - Skip or replay sections as needed

### Self-Service Resources

1. **Error Messages**
   - Detailed error descriptions with suggested solutions
   - Links to relevant help sections
   - Recovery options when available

2. **Performance Monitoring**
   - Built-in performance reports
   - Recommendations for optimization
   - Memory and processing statistics

### Best Practices

1. **Regular Maintenance**
   - Clear old data monthly
   - Update rules based on new transaction patterns
   - Export and backup important classifications
   - Review performance reports periodically

2. **Data Organization**
   - Use consistent category naming
   - Create rules for recurring transactions
   - Tag transactions for easy filtering
   - Maintain clean, descriptive transaction descriptions

3. **Security Practices**
   - Use the app on trusted devices only
   - Clear data when using shared computers
   - Keep browser updated for security patches
   - Don't share exported files containing sensitive data

## Tips for Best Results

### Preparing Your Statements

1. **Download Quality**
   - Use the highest quality PDF export from your bank
   - Ensure CSV exports include all necessary columns
   - Download complete monthly statements rather than partial periods

2. **File Organization**
   - Name files consistently (e.g., "BofA_Statement_2024-01.pdf")
   - Process statements in chronological order
   - Keep original files as backup

### Improving AI Accuracy

1. **Provide Feedback**
   - Correct misclassified transactions
   - Confirm correct classifications
   - Create rules for patterns the AI misses

2. **Consistent Categories**
   - Use the same category names consistently
   - Create subcategories for better organization
   - Map categories to your accounting system

3. **Transaction Descriptions**
   - Edit unclear merchant names for consistency
   - Add notes for complex transactions
   - Standardize recurring transaction descriptions

### Workflow Optimization

1. **Batch Processing**
   - Process multiple months at once when possible
   - Create rules early to benefit from automation
   - Review and export in regular intervals

2. **Quality Control**
   - Always review low-confidence transactions
   - Spot-check high-confidence classifications
   - Verify totals match your bank statements

3. **Integration Planning**
   - Map categories to your accounting software before starting
   - Test export formats with small batches first
   - Establish consistent export procedures

This user guide covers all aspects of using the Bank Statement Processor effectively. The application is designed to be intuitive, but these detailed instructions will help you get the most out of its powerful features while maintaining complete privacy and security of your financial data.