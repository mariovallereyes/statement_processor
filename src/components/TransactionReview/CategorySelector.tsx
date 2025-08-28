import React, { useState, useEffect } from 'react';

export interface Category {
  id: string;
  name: string;
  subcategories?: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string;
}

export interface CategorySelectorProps {
  selectedCategory?: string;
  selectedSubcategory?: string;
  onChange: (category: string, subcategory?: string) => void;
  disabled?: boolean;
  aiSuggestion?: {
    category: string;
    subcategory?: string;
    confidence: number;
  };
}

// QuickBooks Online compatible chart of accounts for small business
const STANDARD_CATEGORIES: Category[] = [
  // INCOME CATEGORIES
  {
    id: 'Income',
    name: 'Income',
    subcategories: [
      { id: 'Sales Revenue', name: 'Sales Revenue' },
      { id: 'Service Revenue', name: 'Service Revenue' },
      { id: 'Product Sales', name: 'Product Sales' },
      { id: 'Consulting Income', name: 'Consulting Income' },
      { id: 'Interest Income', name: 'Interest Income' },
      { id: 'Dividend Income', name: 'Dividend Income' },
      { id: 'Other Income', name: 'Other Income' },
      { id: 'Uncategorized Income', name: 'Uncategorized Income' }
    ]
  },

  // COST OF GOODS SOLD
  {
    id: 'Cost of Goods Sold',
    name: 'Cost of Goods Sold',
    subcategories: [
      { id: 'Job Materials', name: 'Job Materials' },
      { id: 'Construction Materials', name: 'Construction Materials' },
      { id: 'Subcontractor Services', name: 'Subcontractor Services' },
      { id: 'Parts Purchases', name: 'Parts Purchases' },
      { id: 'Freight and Shipping', name: 'Freight and Shipping' },
      { id: 'Equipment Rental', name: 'Equipment Rental' },
      { id: 'Media Purchases', name: 'Media Purchases' },
      { id: 'Merchant Account Fees', name: 'Merchant Account Fees' }
    ]
  },

  // OPERATING EXPENSES
  {
    id: 'Payroll Expenses',
    name: 'Payroll Expenses',
    subcategories: [
      { id: 'Salaries & Wages', name: 'Salaries & Wages' },
      { id: 'Employee Benefits', name: 'Employee Benefits' },
      { id: 'Payroll Taxes', name: 'Payroll Taxes' },
      { id: 'Workers Compensation', name: 'Workers Compensation' },
      { id: 'Health Insurance', name: 'Health Insurance' },
      { id: 'Retirement Plans', name: 'Retirement Plans' },
      { id: 'Contractor Payments', name: 'Contractor Payments' },
      { id: 'Freelancer Payments', name: 'Freelancer Payments' }
    ]
  },

  {
    id: 'Professional Services',
    name: 'Professional Services',
    subcategories: [
      { id: 'Accounting & Bookkeeping', name: 'Accounting & Bookkeeping' },
      { id: 'Legal Fees', name: 'Legal Fees' },
      { id: 'Consulting Fees', name: 'Consulting Fees' },
      { id: 'Tax Preparation', name: 'Tax Preparation' },
      { id: 'Financial Services', name: 'Financial Services' },
      { id: 'Business Coaching', name: 'Business Coaching' },
      { id: 'Other Professional Fees', name: 'Other Professional Fees' }
    ]
  },

  {
    id: 'Office Expenses',
    name: 'Office Expenses',
    subcategories: [
      { id: 'Office Supplies', name: 'Office Supplies' },
      { id: 'Computer and Internet', name: 'Computer and Internet' },
      { id: 'Software Subscriptions', name: 'Software Subscriptions' },
      { id: 'Printing & Reproduction', name: 'Printing & Reproduction' },
      { id: 'Postage and Delivery', name: 'Postage and Delivery' },
      { id: 'Office Equipment', name: 'Office Equipment' },
      { id: 'Telephone', name: 'Telephone' }
    ]
  },

  {
    id: 'Marketing & Advertising',
    name: 'Marketing & Advertising',
    subcategories: [
      { id: 'Advertising', name: 'Advertising' },
      { id: 'Online Marketing', name: 'Online Marketing' },
      { id: 'Print Marketing', name: 'Print Marketing' },
      { id: 'Website & SEO', name: 'Website & SEO' },
      { id: 'Trade Shows', name: 'Trade Shows' },
      { id: 'Promotional Materials', name: 'Promotional Materials' },
      { id: 'Social Media Marketing', name: 'Social Media Marketing' }
    ]
  },

  {
    id: 'Travel & Entertainment',
    name: 'Travel & Entertainment',
    subcategories: [
      { id: 'Travel Expenses', name: 'Travel Expenses' },
      { id: 'Meals & Entertainment', name: 'Meals & Entertainment' },
      { id: 'Lodging', name: 'Lodging' },
      { id: 'Business Meals', name: 'Business Meals' },
      { id: 'Transportation', name: 'Transportation' },
      { id: 'Auto Expenses', name: 'Auto Expenses' }
    ]
  },

  {
    id: 'Utilities',
    name: 'Utilities',
    subcategories: [
      { id: 'Electricity', name: 'Electricity' },
      { id: 'Gas', name: 'Gas' },
      { id: 'Water & Sewer', name: 'Water & Sewer' },
      { id: 'Internet', name: 'Internet' },
      { id: 'Phone', name: 'Phone' },
      { id: 'Waste Management', name: 'Waste Management' },
      { id: 'Security Services', name: 'Security Services' }
    ]
  },

  {
    id: 'Insurance',
    name: 'Insurance',
    subcategories: [
      { id: 'General Liability', name: 'General Liability' },
      { id: 'Professional Liability', name: 'Professional Liability' },
      { id: 'Property Insurance', name: 'Property Insurance' },
      { id: 'Auto Insurance', name: 'Auto Insurance' },
      { id: 'Health Insurance', name: 'Health Insurance' },
      { id: 'Life Insurance', name: 'Life Insurance' },
      { id: 'Disability Insurance', name: 'Disability Insurance' }
    ]
  },

  {
    id: 'Rent & Lease',
    name: 'Rent & Lease',
    subcategories: [
      { id: 'Office Rent', name: 'Office Rent' },
      { id: 'Equipment Lease', name: 'Equipment Lease' },
      { id: 'Vehicle Lease', name: 'Vehicle Lease' },
      { id: 'Storage Rent', name: 'Storage Rent' },
      { id: 'Property Lease', name: 'Property Lease' }
    ]
  },

  {
    id: 'Maintenance & Repairs',
    name: 'Maintenance & Repairs',
    subcategories: [
      { id: 'Building Repairs', name: 'Building Repairs' },
      { id: 'Equipment Maintenance', name: 'Equipment Maintenance' },
      { id: 'Vehicle Maintenance', name: 'Vehicle Maintenance' },
      { id: 'Computer Repairs', name: 'Computer Repairs' },
      { id: 'Janitorial Services', name: 'Janitorial Services' }
    ]
  },

  {
    id: 'Banking & Financial',
    name: 'Banking & Financial',
    subcategories: [
      { id: 'Bank Service Charges', name: 'Bank Service Charges' },
      { id: 'Credit Card Fees', name: 'Credit Card Fees' },
      { id: 'Interest Expense', name: 'Interest Expense' },
      { id: 'Loan Payments', name: 'Loan Payments' },
      { id: 'Investment Fees', name: 'Investment Fees' },
      { id: 'Foreign Exchange', name: 'Foreign Exchange' }
    ]
  },

  {
    id: 'Taxes & Licenses',
    name: 'Taxes & Licenses',
    subcategories: [
      { id: 'Business Licenses', name: 'Business Licenses' },
      { id: 'Property Taxes', name: 'Property Taxes' },
      { id: 'Sales Tax', name: 'Sales Tax' },
      { id: 'Payroll Taxes', name: 'Payroll Taxes' },
      { id: 'Federal Taxes', name: 'Federal Taxes' },
      { id: 'State Taxes', name: 'State Taxes' },
      { id: 'Permits & Fees', name: 'Permits & Fees' }
    ]
  },

  {
    id: 'Education & Training',
    name: 'Education & Training',
    subcategories: [
      { id: 'Continuing Education', name: 'Continuing Education' },
      { id: 'Employee Training', name: 'Employee Training' },
      { id: 'Conferences & Seminars', name: 'Conferences & Seminars' },
      { id: 'Books & Publications', name: 'Books & Publications' },
      { id: 'Online Courses', name: 'Online Courses' },
      { id: 'Professional Development', name: 'Professional Development' }
    ]
  },

  // OWNER'S EQUITY & DISTRIBUTIONS
  {
    id: 'Owner\'s Equity',
    name: 'Owner\'s Equity',
    subcategories: [
      { id: 'Owner Investment', name: 'Owner Investment' },
      { id: 'Owner Draw', name: 'Owner Draw' },
      { id: 'Owner Distribution', name: 'Owner Distribution' },
      { id: 'Retained Earnings', name: 'Retained Earnings' },
      { id: 'Capital Contributions', name: 'Capital Contributions' },
      { id: 'Partner Distributions', name: 'Partner Distributions' }
    ]
  },

  // ASSETS
  {
    id: 'Assets',
    name: 'Assets',
    subcategories: [
      { id: 'Cash & Cash Equivalents', name: 'Cash & Cash Equivalents' },
      { id: 'Accounts Receivable', name: 'Accounts Receivable' },
      { id: 'Inventory', name: 'Inventory' },
      { id: 'Equipment', name: 'Equipment' },
      { id: 'Furniture & Fixtures', name: 'Furniture & Fixtures' },
      { id: 'Vehicles', name: 'Vehicles' },
      { id: 'Investments', name: 'Investments' },
      { id: 'Prepaid Expenses', name: 'Prepaid Expenses' }
    ]
  },

  // LIABILITIES
  {
    id: 'Liabilities',
    name: 'Liabilities',
    subcategories: [
      { id: 'Accounts Payable', name: 'Accounts Payable' },
      { id: 'Credit Card Payable', name: 'Credit Card Payable' },
      { id: 'Loans Payable', name: 'Loans Payable' },
      { id: 'Accrued Expenses', name: 'Accrued Expenses' },
      { id: 'Sales Tax Payable', name: 'Sales Tax Payable' },
      { id: 'Payroll Liabilities', name: 'Payroll Liabilities' },
      { id: 'Long-term Debt', name: 'Long-term Debt' }
    ]
  },

  // MISCELLANEOUS
  {
    id: 'Other Expenses',
    name: 'Other Expenses',
    subcategories: [
      { id: 'Depreciation', name: 'Depreciation' },
      { id: 'Bad Debt', name: 'Bad Debt' },
      { id: 'Charitable Contributions', name: 'Charitable Contributions' },
      { id: 'Dues & Subscriptions', name: 'Dues & Subscriptions' },
      { id: 'Uniforms', name: 'Uniforms' },
      { id: 'Miscellaneous', name: 'Miscellaneous' },
      { id: 'Uncategorized Expense', name: 'Uncategorized Expense' }
    ]
  }
];

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategory,
  selectedSubcategory,
  onChange,
  disabled = false,
  aiSuggestion
}) => {
  const [categories, setCategories] = useState<Category[]>(STANDARD_CATEGORIES);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [showCustomSubcategoryInput, setShowCustomSubcategoryInput] = useState(false);
  const [customSubcategoryName, setCustomSubcategoryName] = useState('');

  // Load custom categories from localStorage on component mount
  useEffect(() => {
    const savedCustomCategories = localStorage.getItem('customCategories');
    if (savedCustomCategories) {
      try {
        const customCategories = JSON.parse(savedCustomCategories);
        setCategories(prev => [...prev, ...customCategories]);
      } catch (error) {
        console.error('Error loading custom categories:', error);
      }
    }
  }, []);

  const selectedCategoryObj = categories.find(cat => cat.id === selectedCategory);
  const availableSubcategories = selectedCategoryObj?.subcategories || [];

  const handleCategoryChange = (categoryId: string) => {
    if (categoryId === 'add-custom') {
      setShowCustomCategoryInput(true);
      return;
    }

    onChange(categoryId);
  };

  const handleSubcategoryChange = (subcategoryId: string) => {
    if (subcategoryId === 'add-custom') {
      setShowCustomSubcategoryInput(true);
      return;
    }

    onChange(selectedCategory!, subcategoryId);
  };

  const handleAddCustomCategory = () => {
    if (!customCategoryName.trim()) return;

    const newCategory: Category = {
      id: `custom-${Date.now()}`,
      name: customCategoryName.trim(),
      subcategories: []
    };

    const updatedCategories = [...categories, newCategory];
    setCategories(updatedCategories);

    // Save custom categories to localStorage
    const customCategories = updatedCategories.filter(cat => cat.id.startsWith('custom-'));
    localStorage.setItem('customCategories', JSON.stringify(customCategories));

    // Select the new category
    onChange(newCategory.id);

    // Reset state
    setCustomCategoryName('');
    setShowCustomCategoryInput(false);
  };

  const handleAddCustomSubcategory = () => {
    if (!customSubcategoryName.trim() || !selectedCategory) return;

    const newSubcategory: Subcategory = {
      id: `custom-sub-${Date.now()}`,
      name: customSubcategoryName.trim()
    };

    const updatedCategories = categories.map(cat => {
      if (cat.id === selectedCategory) {
        return {
          ...cat,
          subcategories: [...(cat.subcategories || []), newSubcategory]
        };
      }
      return cat;
    });

    setCategories(updatedCategories);

    // Save custom categories to localStorage
    const customCategories = updatedCategories.filter(cat => cat.id.startsWith('custom-'));
    localStorage.setItem('customCategories', JSON.stringify(customCategories));

    // Select the new subcategory
    onChange(selectedCategory, newSubcategory.id);

    // Reset state
    setCustomSubcategoryName('');
    setShowCustomSubcategoryInput(false);
  };

  const cancelCustomCategory = () => {
    setShowCustomCategoryInput(false);
    setCustomCategoryName('');
  };

  const cancelCustomSubcategory = () => {
    setShowCustomSubcategoryInput(false);
    setCustomSubcategoryName('');
  };

  const handleApplyAISuggestion = () => {
    if (aiSuggestion) {
      onChange(aiSuggestion.category, aiSuggestion.subcategory);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  };

  return (
    <div className="category-selector">
      {aiSuggestion && (
        <div className={`ai-suggestion-panel confidence-${getConfidenceColor(aiSuggestion.confidence)}`}>
          <div className="suggestion-header">
            <span className="ai-icon">🤖</span>
            <span className="suggestion-label">AI Suggestion</span>
            <span className={`confidence-badge ${getConfidenceColor(aiSuggestion.confidence)}`}>
              {(aiSuggestion.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="suggestion-content">
            <strong>{aiSuggestion.category}</strong>
            {aiSuggestion.subcategory && (
              <>
                <span className="separator"> › </span>
                <span className="subcategory">{aiSuggestion.subcategory}</span>
              </>
            )}
          </div>
          <button
            onClick={handleApplyAISuggestion}
            className="apply-suggestion-btn"
            disabled={disabled}
          >
            ✓ Apply Suggestion
          </button>
        </div>
      )}
      
      <div className="category-selection">
        <select
          value={selectedCategory || ''}
          onChange={(e) => handleCategoryChange(e.target.value)}
          disabled={disabled}
          className="category-select"
        >
          <option value="">Select Category</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value="add-custom">+ Add Custom Category</option>
        </select>

        {showCustomCategoryInput && (
          <div className="custom-input-panel">
            <input
              type="text"
              value={customCategoryName}
              onChange={(e) => setCustomCategoryName(e.target.value)}
              placeholder="Enter custom category name"
              className="custom-input"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomCategory()}
            />
            <button onClick={handleAddCustomCategory} className="add-btn">Add</button>
            <button onClick={cancelCustomCategory} className="cancel-btn">Cancel</button>
          </div>
        )}
      </div>

      {selectedCategory && availableSubcategories.length > 0 && (
        <div className="subcategory-selection">
          <select
            value={selectedSubcategory || ''}
            onChange={(e) => handleSubcategoryChange(e.target.value)}
            disabled={disabled}
            className="subcategory-select"
          >
            <option value="">Select Subcategory (Optional)</option>
            {availableSubcategories.map(subcategory => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </option>
            ))}
            <option value="add-custom">+ Add Custom Subcategory</option>
          </select>

          {showCustomSubcategoryInput && (
            <div className="custom-input-panel">
              <input
                type="text"
                value={customSubcategoryName}
                onChange={(e) => setCustomSubcategoryName(e.target.value)}
                placeholder="Enter custom subcategory name"
                className="custom-input"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomSubcategory()}
              />
              <button onClick={handleAddCustomSubcategory} className="add-btn">Add</button>
              <button onClick={cancelCustomSubcategory} className="cancel-btn">Cancel</button>
            </div>
          )}
        </div>
      )}

      {selectedCategory && (
        <div className="selected-category-display">
          <span className="category-breadcrumb">
            {categories.find(cat => cat.id === selectedCategory)?.name}
            {selectedSubcategory && (
              <>
                {' > '}
                {availableSubcategories.find(sub => sub.id === selectedSubcategory)?.name}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
};