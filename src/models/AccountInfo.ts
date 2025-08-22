export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface AccountInfo {
  accountNumber: string;
  accountType: string;
  bankName: string;
  customerName: string;
  statementPeriod: DateRange;
  openingBalance: number;
  closingBalance: number;
}