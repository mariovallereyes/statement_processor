// Comprehensive test using user's actual problematic data

const userProblematicData = `HOTLUM POWELL INTEGRATED SERVICES LLC ! Account # 3251 1637 8291 ! January 1, 2023 to January 31, 2023 Page 4 of 6 Withdrawals and other debits - continued Date Description Amount Deel, Inc. DES:Deel Inc. ID:ST-L6R3D2X6G5K2 INDN::1800948598 CCD PAYPAL DES:INST XFER ID:DAS TRADER INDN:MARIO VALLE REYES CO ID:PAYPALSI77 WEB PAYPAL DES:INST XFER ID:UBER INDN:MARIO VALLE REYES CO ID:PAYPALSI77 WEB PAYPAL DES:INST XFER ID:UBER INDN:MARIO VALLE REYES CO ID:PAYPALSI77 WEB PAYPAL DES:INST XFER ID:GOOGLE GOOGLE S INDN:MARIO VALLE REYES CO ID:PAYPALSI77 WEB Deel, Inc. DES:Deel Inc. ID:ST-Z8J2X2N7Y8A4 INDN:LIFESLICE INC CO ID:1800948598 CCD AMERICAN EXPRESS DES:ACH PMT ID:M1790 INDN:Mario Valle Reyes CO ID:1133133497 CCD Card account # XXXX XXXX XXXX 3911 CHECKCARD 1231 JACK IN THE BOX 0556 SAN FRANCISCOCA 24692162365102323571517 CKCD 5814 XXXXXXXXXXXX3911 XXXX XXXX XXXX 3911 CHECKCARD 0101 GOOGLE *GSUITE_hotlump cc@google.comCA 24692163001102805869718 RECURRING CKCD 7372 XXXXXXXXXXXX3911 XXXX XXXX XXXX 3911 PURCHASE 0103 WIX.COM 1033255895 WWW.WIX.COM CA PURCHASE 0104 WIX.COM 1033350221 WWW.WIX.COM CA PMNT SENT 0104 REMITLY* J486 WWW.REMITLY.CWA CHECKCARD 0105 APPLE.COM/BILL 866-712-7753 CA 24692163005105811653212 CKCD 5818 XXXXXXXXXXXX3911 XXXX XXXX XXXX 3911 CHECKCARD 0108 APPLE.COM/BILL 866-712-7753 CA 24692163008108050980475 RECURRING CKCD 5818 XXXXXXXXXXXX3911`;

console.log("=== COMPREHENSIVE TRANSACTION EXTRACTION TEST ===");
console.log("Input length:", userProblematicData.length, "characters");

// Enhanced parsing function based on our fixes
function intelligentLineSplitting(text) {
    let lines = text.split('\n').filter(line => line.trim().length > 0);
    
    const averageLineLength = text.length / lines.length;
    const hasLongLines = lines.some(line => line.length > 200);
    
    if (hasLongLines || averageLineLength > 150) {
        const enhancedLines = [];
        
        for (const line of lines) {
            if (line.length > 200) {
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
    
    // Enhanced Bank of America transaction boundary patterns
    const boundaryPatterns = [
        // CHECKCARD transactions - capture everything until next transaction type
        /\b(CHECKCARD\s+\d{4}\s+[^C]+?)(?=\s*CHECKCARD\s+\d{4}|\s*PURCHASE\s+\d{4}|\s*PAYPAL\s+DES:|\s*Deel,\s+Inc\.|\s*PMNT\s+SENT|$)/g,
        // PURCHASE transactions
        /\b(PURCHASE\s+\d{4}\s+[^P]+?)(?=\s*CHECKCARD\s+\d{4}|\s*PURCHASE\s+\d{4}|\s*PAYPAL\s+DES:|\s*Deel,\s+Inc\.|\s*PMNT\s+SENT|$)/g,
        // PAYPAL transactions
        /\b(PAYPAL\s+DES:[^P]+?)(?=\s*PAYPAL\s+DES:|\s*CHECKCARD|\s*PURCHASE|\s*Deel,\s+Inc\.|\s*AMERICAN\s+EXPRESS|$)/g,
        // Deel transactions
        /(Deel,\s+Inc\.\s+DES:[^D]+?)(?=\s*Deel,\s+Inc\.|\s*PAYPAL|\s*CHECKCARD|\s*AMERICAN\s+EXPRESS|$)/g,
        // AMERICAN EXPRESS transactions
        /(AMERICAN\s+EXPRESS\s+DES:[^A]+?)(?=\s*AMERICAN\s+EXPRESS|\s*CHECKCARD|\s*PURCHASE|\s*Card\s+account|$)/g,
        // PMNT SENT transactions
        /(PMNT\s+SENT\s+[^P]+?)(?=\s*PMNT\s+SENT|\s*CHECKCARD|\s*PURCHASE|\s*PAYPAL|$)/g,
        // RECURRING transactions  
        /(RECURRING\s+[^R]+?)(?=\s*RECURRING|\s*CHECKCARD|\s*PURCHASE|$)/g
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

function shouldSkipLine(line) {
    const skipPatterns = [
        // Bank statement headers
        /^[A-Z\s]+LLC\s*!\s*Account\s*#/i,
        /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+,\s+\d{4}\s+to\s+/i,
        /^Page\s*\d+\s*of\s*\d+/i,
        /^Date\s+(Transaction\s+)?[Dd]escription\s+Amount$/i,
        /^(DEPOSITS|WITHDRAWALS|CHECKS|FEES)\s+(and\s+other\s+)?(credits|debits)/i,
        /continued\s+on\s+the\s+next\s+page/i
    ];
    return skipPatterns.some(pattern => pattern.test(line));
}

// Test the parsing
const parsedLines = intelligentLineSplitting(userProblematicData);

console.log("\n=== EXTRACTED TRANSACTIONS ===");
let validTransactions = 0;
parsedLines.forEach((line, index) => {
    const shouldSkip = shouldSkipLine(line);
    const isValid = !shouldSkip && line.length > 20;
    
    if (isValid) {
        validTransactions++;
        console.log(`✓ Transaction ${validTransactions}:`);
        console.log(`  "${line}"`);
        console.log(`  Length: ${line.length} characters`);
        
        // Try to identify transaction type and extract key info
        const type = line.match(/^(CHECKCARD|PURCHASE|PAYPAL|Deel|AMERICAN EXPRESS|PMNT SENT)/)?.[1] || 'UNKNOWN';
        const dateMatch = line.match(/\b(\d{4})\s+/)?.[1] || 'No date found';
        const merchantMatch = line.match(/(JACK IN THE BOX|GOOGLE|WIX\.COM|APPLE\.COM|REMITLY)/i)?.[1] || 'Unknown merchant';
        
        console.log(`  Type: ${type}, Date: ${dateMatch}, Merchant: ${merchantMatch}`);
        console.log('');
    } else if (shouldSkip) {
        console.log(`⏭️  Skipped (header): "${line.substring(0, 50)}..."`);
    } else {
        console.log(`❓ Questionable: "${line.substring(0, 50)}..."`);
    }
});

console.log("=== SUMMARY ===");
console.log("Total parsed lines:", parsedLines.length);
console.log("Valid transactions found:", validTransactions);
console.log("Expected transactions: ~10-15 (based on visual count)");
console.log("");

if (validTransactions >= 8) {
    console.log("✅ SUCCESS: Good transaction extraction rate!");
} else if (validTransactions >= 5) {
    console.log("⚠️  PARTIAL: Some transactions extracted, needs improvement");  
} else {
    console.log("❌ FAILED: Very few transactions extracted");
}

console.log("\n=== TRANSACTION TYPES FOUND ===");
const types = {};
parsedLines.filter(line => !shouldSkipLine(line)).forEach(line => {
    const type = line.match(/^(CHECKCARD|PURCHASE|PAYPAL|Deel|AMERICAN EXPRESS|PMNT SENT)/)?.[1] || 'UNKNOWN';
    types[type] = (types[type] || 0) + 1;
});
Object.entries(types).forEach(([type, count]) => {
    console.log(`${type}: ${count} transactions`);
});