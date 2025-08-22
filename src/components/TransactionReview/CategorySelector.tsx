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
}

// Standard accounting categories for bookkeeping
const STANDARD_CATEGORIES: Category[] = [
  {
    id: 'income',
    name: 'Income',
    subcategories: [
      { id: 'sales', name: 'Sales Revenue' },
      { id: 'services', name: 'Service Revenue' },
      { id: 'interest', name: 'Interest Income' },
      { id: 'other-income', name: 'Other Income' }
    ]
  },
  {
    id: 'expenses',
    name: 'Expenses',
    subcategories: [
      { id: 'office-supplies', name: 'Office Supplies' },
      { id: 'utilities', name: 'Utilities' },
      { id: 'rent', name: 'Rent' },
      { id: 'insurance', name: 'Insurance' },
      { id: 'professional-services', name: 'Professional Services' },
      { id: 'marketing', name: 'Marketing & Advertising' },
      { id: 'travel', name: 'Travel & Entertainment' },
      { id: 'meals', name: 'Meals & Entertainment' },
      { id: 'equipment', name: 'Equipment' },
      { id: 'software', name: 'Software & Subscriptions' },
      { id: 'bank-fees', name: 'Bank Fees' },
      { id: 'other-expenses', name: 'Other Expenses' }
    ]
  },
  {
    id: 'cost-of-goods',
    name: 'Cost of Goods Sold',
    subcategories: [
      { id: 'materials', name: 'Raw Materials' },
      { id: 'inventory', name: 'Inventory Purchases' },
      { id: 'shipping', name: 'Shipping & Freight' },
      { id: 'manufacturing', name: 'Manufacturing Costs' }
    ]
  },
  {
    id: 'assets',
    name: 'Assets',
    subcategories: [
      { id: 'equipment-purchase', name: 'Equipment Purchase' },
      { id: 'furniture', name: 'Furniture & Fixtures' },
      { id: 'vehicles', name: 'Vehicles' },
      { id: 'investments', name: 'Investments' }
    ]
  },
  {
    id: 'liabilities',
    name: 'Liabilities',
    subcategories: [
      { id: 'loan-payment', name: 'Loan Payment' },
      { id: 'credit-card', name: 'Credit Card Payment' },
      { id: 'accounts-payable', name: 'Accounts Payable' },
      { id: 'taxes-payable', name: 'Taxes Payable' }
    ]
  },
  {
    id: 'equity',
    name: 'Owner\'s Equity',
    subcategories: [
      { id: 'owner-investment', name: 'Owner Investment' },
      { id: 'owner-draw', name: 'Owner Draw' },
      { id: 'retained-earnings', name: 'Retained Earnings' }
    ]
  }
];

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategory,
  selectedSubcategory,
  onChange,
  disabled = false
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

  return (
    <div className="category-selector">
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
              onKeyPress={(e) => e.key === 'Enter' && handleAddCustomCategory()}
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
                onKeyPress={(e) => e.key === 'Enter' && handleAddCustomSubcategory()}
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