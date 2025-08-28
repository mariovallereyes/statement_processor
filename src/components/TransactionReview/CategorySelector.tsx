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

// AI-compatible transaction categories for bank statement processing
const STANDARD_CATEGORIES: Category[] = [
  {
    id: 'Transportation',
    name: 'Transportation',
    subcategories: [
      { id: 'Gas & Fuel', name: 'Gas & Fuel' },
      { id: 'Public Transit', name: 'Public Transit' },
      { id: 'Rideshare/Taxi', name: 'Rideshare/Taxi' },
      { id: 'Parking', name: 'Parking' },
      { id: 'Vehicle Maintenance', name: 'Vehicle Maintenance' },
      { id: 'Other Transport', name: 'Other Transport' }
    ]
  },
  {
    id: 'Transfer',
    name: 'Transfer',
    subcategories: [
      { id: 'Account Transfer', name: 'Account Transfer' },
      { id: 'Person-to-Person', name: 'Person-to-Person' },
      { id: 'Wire Transfer', name: 'Wire Transfer' },
      { id: 'Check Deposit', name: 'Check Deposit' },
      { id: 'Other Transfer', name: 'Other Transfer' }
    ]
  },
  {
    id: 'Business/Software',
    name: 'Business/Software',
    subcategories: [
      { id: 'Software/SaaS', name: 'Software/SaaS' },
      { id: 'Development Tools', name: 'Development Tools' },
      { id: 'Cloud Services', name: 'Cloud Services' },
      { id: 'Domain/Hosting', name: 'Domain/Hosting' },
      { id: 'Business Apps', name: 'Business Apps' },
      { id: 'Other Business', name: 'Other Business' }
    ]
  },
  {
    id: 'Business/Marketing',
    name: 'Business/Marketing',
    subcategories: [
      { id: 'Advertising', name: 'Advertising' },
      { id: 'Social Media', name: 'Social Media' },
      { id: 'Email Marketing', name: 'Email Marketing' },
      { id: 'Analytics', name: 'Analytics' },
      { id: 'Design Tools', name: 'Design Tools' },
      { id: 'Other Marketing', name: 'Other Marketing' }
    ]
  },
  {
    id: 'Banking/Fees',
    name: 'Banking/Fees',
    subcategories: [
      { id: 'Account Fees', name: 'Account Fees' },
      { id: 'ATM Fees', name: 'ATM Fees' },
      { id: 'Overdraft Fees', name: 'Overdraft Fees' },
      { id: 'Wire Fees', name: 'Wire Fees' },
      { id: 'Foreign Transaction', name: 'Foreign Transaction' },
      { id: 'Other Bank Fees', name: 'Other Bank Fees' }
    ]
  },
  {
    id: 'Food & Dining',
    name: 'Food & Dining',
    subcategories: [
      { id: 'Restaurants', name: 'Restaurants' },
      { id: 'Fast Food', name: 'Fast Food' },
      { id: 'Coffee Shops', name: 'Coffee Shops' },
      { id: 'Groceries', name: 'Groceries' },
      { id: 'Delivery', name: 'Delivery' },
      { id: 'Other Food', name: 'Other Food' }
    ]
  },
  {
    id: 'Shopping',
    name: 'Shopping',
    subcategories: [
      { id: 'Retail', name: 'Retail' },
      { id: 'Online Shopping', name: 'Online Shopping' },
      { id: 'Clothing', name: 'Clothing' },
      { id: 'Electronics', name: 'Electronics' },
      { id: 'Home & Garden', name: 'Home & Garden' },
      { id: 'Other Shopping', name: 'Other Shopping' }
    ]
  },
  {
    id: 'Recurring/Subscription',
    name: 'Recurring/Subscription',
    subcategories: [
      { id: 'Streaming Services', name: 'Streaming Services' },
      { id: 'Software Subscriptions', name: 'Software Subscriptions' },
      { id: 'Utilities', name: 'Utilities' },
      { id: 'Insurance', name: 'Insurance' },
      { id: 'Memberships', name: 'Memberships' },
      { id: 'Other Recurring', name: 'Other Recurring' }
    ]
  },
  {
    id: 'Income/Deposit',
    name: 'Income/Deposit',
    subcategories: [
      { id: 'Salary', name: 'Salary' },
      { id: 'Freelance', name: 'Freelance' },
      { id: 'Investment Income', name: 'Investment Income' },
      { id: 'Refund', name: 'Refund' },
      { id: 'Government Payment', name: 'Government Payment' },
      { id: 'Other Income', name: 'Other Income' }
    ]
  },
  {
    id: 'Healthcare',
    name: 'Healthcare',
    subcategories: [
      { id: 'Medical', name: 'Medical' },
      { id: 'Dental', name: 'Dental' },
      { id: 'Pharmacy', name: 'Pharmacy' },
      { id: 'Insurance', name: 'Insurance' },
      { id: 'Therapy', name: 'Therapy' },
      { id: 'Other Healthcare', name: 'Other Healthcare' }
    ]
  },
  {
    id: 'Entertainment',
    name: 'Entertainment',
    subcategories: [
      { id: 'Movies', name: 'Movies' },
      { id: 'Gaming', name: 'Gaming' },
      { id: 'Sports', name: 'Sports' },
      { id: 'Hobbies', name: 'Hobbies' },
      { id: 'Books/Media', name: 'Books/Media' },
      { id: 'Other Entertainment', name: 'Other Entertainment' }
    ]
  },
  {
    id: 'Utilities',
    name: 'Utilities',
    subcategories: [
      { id: 'Electric', name: 'Electric' },
      { id: 'Gas', name: 'Gas' },
      { id: 'Water', name: 'Water' },
      { id: 'Internet', name: 'Internet' },
      { id: 'Phone', name: 'Phone' },
      { id: 'Trash/Recycling', name: 'Trash/Recycling' },
      { id: 'Other Utilities', name: 'Other Utilities' }
    ]
  },
  {
    id: 'Other',
    name: 'Other',
    subcategories: [
      { id: 'Uncategorized', name: 'Uncategorized' },
      { id: 'Charity', name: 'Charity' },
      { id: 'Education', name: 'Education' },
      { id: 'Travel', name: 'Travel' },
      { id: 'Personal Care', name: 'Personal Care' },
      { id: 'Other', name: 'Other' }
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