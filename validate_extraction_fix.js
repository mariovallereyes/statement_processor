// Test the enhanced transaction extraction logic

const sampleExtractedText = `HOTLUM POWELL INTEGRATED SERVICES LLC ! Account # 3251 1637 8291 ! January 1, 2023 to January 31, 2023 Page 4 of 6 Withdrawals and other debits - continued Date Description Amount CHECKCARD 1231 JACK IN THE BOX 0556 SAN FRANCISCOCA 24692162365102323571517 CKCD 5814 XXXXXXXXXXXX3911 CHECKCARD 0101 GOOGLE *GSUITE_hotlump cc@google.comCA 24692163001102805869718 RECURRING CKCD 7372 XXXXXXXXXXXX3911 PURCHASE 0103 WIX.COM 1033255895 WWW.WIX.COM CA PURCHASE 0104 WIX.COM 1033350221 WWW.WIX.COM CA PAYPAL DES:INST XFER ID:DAS TRADER INDN:MARIO VALLE REYES CO ID:PAYPALSI77 WEB PAYPAL DES:INST XFER ID:UBER INDN:MARIO VALLE REYES CO ID:PAYPALSI77 WEB`;

console.log("=== TESTING ENHANCED PARSING ===");
console.log("Original text length:", sampleExtractedText.length);

// Simulate the enhanced line splitting logic
function intelligentLineSplitting(text) {
    let lines = text.split('\n').filter(line => line.trim().length > 0);
    
    const averageLineLength = text.length / lines.length;
    const hasLongLines = lines.some(line => line.length > 200);
    
    console.log("Average line length:", averageLineLength);
    console.log("Has long lines:", hasLongLines);
    
    if (hasLongLines || averageLineLength > 150) {
        const enhancedLines = [];
        
        for (const line of lines) {
            if (line.length > 200) {
                console.log("Processing long line of length:", line.length);
                const splitTransactions = splitLineIntoTransactions(line);
                enhancedLines.push(...splitTransactions);
            } else {
                enhancedLines.push(line);
            }
        }
        
        lines = enhancedLines;
    }
    
    return lines.filter(line => line.trim().length > 0);
}

function splitLineIntoTransactions(longLine) {
    const transactions = [];
    
    // Bank of America transaction boundary patterns - enhanced
    const boundaryPatterns = [
        // CHECKCARD transactions - improved pattern to capture full transactions
        /\b(CHECKCARD\s+\d{4}\s+[^C]+?)(?=\s*CHECKCARD\s+\d{4}|\s*PURCHASE\s+\d{4}|\s*PAYPAL\s+DES:|\s*$)/g,
        // PURCHASE transactions
        /\b(PURCHASE\s+\d{4}\s+[^P]+?)(?=\s*CHECKCARD\s+\d{4}|\s*PURCHASE\s+\d{4}|\s*PAYPAL\s+DES:|\s*$)/g,
        // PAYPAL transactions
        /\b(PAYPAL\s+DES:[^P]+?)(?=\s*PAYPAL\s+DES:|\s*CHECKCARD|\s*PURCHASE|\s*$)/g,
    ];
    
    let processed = false;
    
    // Try each pattern to extract transactions
    for (const pattern of boundaryPatterns) {
        pattern.lastIndex = 0;
        let matches;
        
        while ((matches = pattern.exec(longLine)) !== null) {
            const transaction = matches[1].trim();
            if (transaction && transaction.length > 10) {
                transactions.push(transaction);
                processed = true;
            }
        }
    }
    
    if (!processed) {
        transactions.push(longLine);
    }
    
    return transactions;
}

// Test the parsing
const parsedLines = intelligentLineSplitting(sampleExtractedText);

console.log("\n=== PARSED TRANSACTION LINES ===");
parsedLines.forEach((line, index) => {
    console.log(`${index + 1}: "${line}"`);
    console.log(`   Length: ${line.length} characters`);
    console.log(`   Contains date pattern: ${/\b\d{4}\s+/.test(line)}`);
    console.log(`   Contains transaction keywords: ${/(CHECKCARD|PURCHASE|PAYPAL)/.test(line)}`);
    console.log('');
});

console.log("=== SUMMARY ===");
console.log("Original lines:", sampleExtractedText.split('\n').length);
console.log("Enhanced lines:", parsedLines.length);
console.log("Average new line length:", parsedLines.reduce((sum, line) => sum + line.length, 0) / parsedLines.length);