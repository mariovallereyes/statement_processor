// Quick test to demonstrate the transaction parsing issue

const sampleExtractedText = `HOTLUM POWELL INTEGRATED SERVICES LLC ! Account # 3251 1637 8291 ! January 1, 2023 to January 31, 2023 Page 4 of 6 Withdrawals and other debits - continued Date Description Amount Deel, Inc. DES:Deel Inc. ID:ST-L6R3D2X6G5K2 INDN::1800948598 CCD PAYPAL DES:INST XFER ID:DAS TRADER INDN:MARIO VALLE REYES CO ID:PAYPALSI77 WEB PAYPAL DES:INST XFER ID:UBER INDN:MARIO VALLE REYES CO ID:PAYPALSI77 WEB PAYPAL DES:INST XFER ID:UBER INDN:MARIO VALLE REYES CO ID:PAYPALSI77 WEB PAYPAL DES:INST XFER ID:GOOGLE GOOGLE S INDN:MARIO VALLE REYES CO ID:PAYPALSI77 WEB Deel, Inc. DES:Deel Inc. ID:ST-Z8J2X2N7Y8A4 INDN:LIFESLICE INC CO ID:1800948598 CCD AMERICAN EXPRESS DES:ACH PMT ID:M1790 INDN:Mario Valle Reyes CO ID:1133133497 CCD Card account # XXXX XXXX XXXX 3911 CHECKCARD 1231 JACK IN THE BOX 0556 SAN FRANCISCOCA 24692162365102323571517 CKCD 5814 XXXXXXXXXXXX3911 XXXX XXXX XXXX 3911 CHECKCARD 0101 GOOGLE *GSUITE_hotlump cc@google.comCA 24692163001102805869718 RECURRING CKCD 7372 XXXXXXXXXXXX3911`;

console.log("=== CURRENT PARSING APPROACH ===");
console.log("Text is treated as ONE transaction:");
console.log(`Length: ${sampleExtractedText.length} characters`);
console.log(`Lines when split: ${sampleExtractedText.split('\n').length}`);
console.log("Individual lines:");
sampleExtractedText.split('\n').forEach((line, i) => {
  console.log(`${i}: "${line}"`);
});

console.log("\n=== WHAT WE NEED TO EXTRACT ===");
console.log("Individual transactions that should be parsed:");
console.log("1. CHECKCARD 1231 JACK IN THE BOX 0556 SAN FRANCISCOCA - Amount: Unknown");
console.log("2. CHECKCARD 0101 GOOGLE *GSUITE_hotlump cc@google.comCA - Amount: Unknown"); 
console.log("3. PAYPAL DES:INST XFER ID:DAS TRADER - Amount: Unknown");
console.log("4. PAYPAL DES:INST XFER ID:UBER - Amount: Unknown");
console.log("5. AMERICAN EXPRESS DES:ACH PMT - Amount: Unknown");

console.log("\n=== SOLUTION NEEDED ===");
console.log("1. Parse the text block to identify transaction patterns");
console.log("2. Extract individual transaction lines with dates, descriptions, amounts");
console.log("3. Handle missing newlines between transactions");
console.log("4. Identify transaction boundaries using keywords like 'CHECKCARD', 'PAYPAL', etc.");