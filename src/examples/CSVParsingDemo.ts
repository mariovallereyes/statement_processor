import { CSVParsingService } from '../services/CSVParsingService';
import { DataUnificationService } from '../services/DataUnificationService';

/**
 * Demo showing how to use the CSV parsing functionality
 */
export class CSVParsingDemo {
  
  /**
   * Example: Parse a standard Bank of America CSV statement
   */
  static async parseStandardBoACSV() {
    const csvContent = `Date,Description,Amount,Running Balance
01/15/2024,"DEBIT CARD PURCHASE STARBUCKS #12345",-4.95,1245.67
01/14/2024,"ACH DEPOSIT PAYROLL COMPANY ABC",2500.00,1250.62
01/13/2024,"CHECK #1234 RENT PAYMENT",-1200.00,-1249.38
01/12/2024,"TRANSFER FROM SAVINGS",500.00,-49.38
01/11/2024,"DEBIT CARD PURCHASE GROCERY STORE",-85.43,-549.38`;

    try {
      console.log('Parsing standard Bank of America CSV...');
      
      const result = await CSVParsingService.parseCSV(csvContent);
      
      console.log(`✅ Successfully parsed ${result.transactions.length} transactions`);
      console.log(`📊 Extraction confidence: ${(result.confidence.extraction * 100).toFixed(1)}%`);
      console.log(`📅 Statement period: ${result.statementPeriod.startDate.toLocaleDateString()} - ${result.statementPeriod.endDate.toLocaleDateString()}`);
      
      // Show first transaction details
      const firstTransaction = result.transactions[0];
      console.log('\n📝 First transaction:');
      console.log(`  Date: ${firstTransaction.date.toLocaleDateString()}`);
      console.log(`  Description: ${firstTransaction.description}`);
      console.log(`  Merchant: ${firstTransaction.merchantName}`);
      console.log(`  Amount: $${firstTransaction.amount.toFixed(2)} (${firstTransaction.type})`);
      console.log(`  Balance: $${firstTransaction.balance?.toFixed(2) || 'N/A'}`);
      
      return result;
    } catch (error) {
      console.error('❌ Error parsing CSV:', error);
      throw error;
    }
  }

  /**
   * Example: Parse alternate Bank of America CSV format with separate debit/credit columns
   */
  static async parseAlternateBoACSV() {
    const csvContent = `Posted Date,Payee,Debit Amount,Credit Amount,Balance
2024-01-15,STARBUCKS STORE #12345,4.95,,1245.67
2024-01-14,PAYROLL DEPOSIT,,2500.00,1250.62
2024-01-13,RENT CHECK #1234,1200.00,,1250.62
2024-01-12,SAVINGS TRANSFER,,500.00,1250.62`;

    try {
      console.log('\nParsing alternate Bank of America CSV format...');
      
      const result = await CSVParsingService.parseCSV(csvContent);
      
      console.log(`✅ Successfully parsed ${result.transactions.length} transactions`);
      console.log(`📊 Extraction confidence: ${(result.confidence.extraction * 100).toFixed(1)}%`);
      
      // Show transaction types
      const debits = result.transactions.filter(t => t.type === 'debit').length;
      const credits = result.transactions.filter(t => t.type === 'credit').length;
      console.log(`💳 Transaction types: ${debits} debits, ${credits} credits`);
      
      return result;
    } catch (error) {
      console.error('❌ Error parsing alternate CSV:', error);
      throw error;
    }
  }

  /**
   * Example: Parse CSV with custom column mapping
   */
  static async parseCustomMappingCSV() {
    const csvContent = `Transaction Date,Merchant Name,Transaction Amount,Account Balance
01/15/2024,STARBUCKS COFFEE,4.95,1245.67
01/14/2024,WHOLE FOODS MARKET,85.43,1240.72
01/13/2024,SHELL GAS STATION,45.67,1195.05`;

    const customMapping = {
      date: 'Transaction Date',
      description: 'Merchant Name',
      amount: 'Transaction Amount',
      balance: 'Account Balance'
    };

    try {
      console.log('\nParsing CSV with custom column mapping...');
      
      const result = await CSVParsingService.parseCSVWithMapping(csvContent, customMapping);
      
      console.log(`✅ Successfully parsed ${result.transactions.length} transactions`);
      console.log('🔧 Used custom column mapping');
      
      return result;
    } catch (error) {
      console.error('❌ Error parsing custom CSV:', error);
      throw error;
    }
  }

  /**
   * Example: Unify multiple CSV sources
   */
  static async unifyMultipleCSVSources() {
    console.log('\n🔄 Unifying multiple CSV sources...');
    
    try {
      // Parse multiple CSV files
      const result1 = await this.parseStandardBoACSV();
      const result2 = await this.parseAlternateBoACSV();
      
      // Create unified inputs
      const inputs = [
        {
          source: 'csv' as const,
          rawData: {},
          extractionResult: result1
        },
        {
          source: 'csv' as const,
          rawData: {},
          extractionResult: result2
        }
      ];

      // Unify with options
      const unifiedResult = DataUnificationService.unifyExtractionResults(inputs, {
        mergeDuplicates: true,
        sortByDate: true,
        validateTransactions: true,
        enhanceDescriptions: true
      });

      console.log(`✅ Unified ${unifiedResult.transactions.length} transactions from multiple sources`);
      console.log(`📊 Overall confidence: ${(unifiedResult.confidence.overall * 100).toFixed(1)}%`);
      console.log(`📅 Combined period: ${unifiedResult.statementPeriod.startDate.toLocaleDateString()} - ${unifiedResult.statementPeriod.endDate.toLocaleDateString()}`);
      
      // Show transaction summary
      const totalAmount = unifiedResult.transactions.reduce((sum, t) => sum + t.amount, 0);
      console.log(`💰 Total transaction amount: $${totalAmount.toFixed(2)}`);
      
      return unifiedResult;
    } catch (error) {
      console.error('❌ Error unifying CSV sources:', error);
      throw error;
    }
  }

  /**
   * Example: Handle error scenarios gracefully
   */
  static async demonstrateErrorHandling() {
    console.log('\n⚠️  Demonstrating error handling...');
    
    // Invalid CSV format
    const invalidCSV = `Invalid,Headers,Format
some,random,data
not,bank,statement`;

    try {
      await CSVParsingService.parseCSV(invalidCSV);
    } catch (error) {
      console.log('✅ Correctly caught invalid CSV format error:', (error as Error).message);
    }

    // Empty CSV
    try {
      await CSVParsingService.parseCSV('');
    } catch (error) {
      console.log('✅ Correctly caught empty CSV error');
    }

    // CSV with missing required columns
    const incompleteCSV = `Date,Description
01/15/2024,STARBUCKS
01/14/2024,GROCERY STORE`;

    try {
      await CSVParsingService.parseCSV(incompleteCSV);
    } catch (error) {
      console.log('✅ Correctly caught missing columns error:', (error as Error).message);
    }
  }

  /**
   * Example: Show supported column patterns
   */
  static showSupportedColumnPatterns() {
    console.log('\n📋 Supported Bank of America CSV column patterns:');
    
    const patterns = CSVParsingService.getSupportedColumnMappings();
    
    Object.entries(patterns).forEach(([fieldType, patternList]) => {
      console.log(`\n${fieldType.toUpperCase()}:`);
      patternList.forEach(pattern => {
        console.log(`  - "${pattern}"`);
      });
    });
  }

  /**
   * Run all demos
   */
  static async runAllDemos() {
    console.log('🚀 Starting CSV Parsing Demo\n');
    console.log('=' .repeat(50));
    
    try {
      // Show supported patterns
      this.showSupportedColumnPatterns();
      
      // Parse different formats
      await this.parseStandardBoACSV();
      await this.parseAlternateBoACSV();
      await this.parseCustomMappingCSV();
      
      // Unify multiple sources
      await this.unifyMultipleCSVSources();
      
      // Demonstrate error handling
      await this.demonstrateErrorHandling();
      
      console.log('\n' + '='.repeat(50));
      console.log('✅ All demos completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Demo failed:', error);
    }
  }
}

// Export for use in other files
export default CSVParsingDemo;

// Uncomment to run demos when this file is executed directly
// CSVParsingDemo.runAllDemos();