/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from 'pdfkit';

type Numeric = number | string | { toNumber(): number } | any;

interface InvoiceLineItem {
  description: string;
  quantity: Numeric;
  unit: string;
  unitRate: Numeric;
  amount: Numeric;
}

interface InvoiceData {
  invoiceCode: string;
  issueDate: Date | string;
  dueDate: Date | string;
  client: { name: string; contactEmail?: string | null; address?: string | null };
  project?: { name: string; projectCode: string } | null;
  lineItems: InvoiceLineItem[];
  subtotal: Numeric;
  taxRate: Numeric;
  taxAmount: Numeric;
  totalAmount: Numeric;
  paidAmount: Numeric;
  outstandingAmount: Numeric;
  notes?: string | null;
}

interface QuotationLineItem {
  description: string;
  workerType?: string | null;
  quantity: Numeric;
  unit: string;
  unitRate: Numeric;
  amount: Numeric;
}

interface QuotationData {
  quotationCode: string;
  title: string;
  validUntil: Date | string;
  client: { name: string; contactEmail?: string | null; address?: string | null };
  lineItems: QuotationLineItem[];
  subtotal: Numeric;
  discountAmount: Numeric;
  taxRate: Numeric;
  taxAmount: Numeric;
  totalAmount: Numeric;
  notes?: string | null;
  termsAndCond?: string | null;
}

function fmt(amount: Numeric): string {
  const n = typeof amount === 'object' && amount !== null && typeof amount.toNumber === 'function'
    ? amount.toNumber()
    : Number(amount);
  return `SGD ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function drawHeader(doc: InstanceType<typeof PDFDocument>, title: string, code: string): void {
  doc.fontSize(20).fillColor('#1976D2').text('Aadhirai HRM OS', 50, 50);
  doc.fontSize(10).fillColor('#666666').text('Construction & Manpower Management', 50, 75);
  doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#1976D2').lineWidth(2).stroke();

  doc.fontSize(16).fillColor('#1a1a1a').text(title, 50, 115);
  doc.fontSize(10).fillColor('#555555').text(code, 50, 140);
  doc.fillColor('#1a1a1a');
}

function drawClientBlock(doc: InstanceType<typeof PDFDocument>, client: { name: string; contactEmail?: string | null; address?: string | null }, y: number): void {
  doc.fontSize(9).fillColor('#555555').text('BILL TO:', 50, y);
  doc.fontSize(10).fillColor('#1a1a1a').text(client.name, 50, y + 14);
  if (client.address) doc.fontSize(9).text(client.address, 50, y + 28);
  if (client.contactEmail) doc.fontSize(9).text(client.contactEmail, 50, y + 42);
}

function drawLineItemsTable(doc: InstanceType<typeof PDFDocument>, items: Array<{ description: string; quantity: string | number; unit: string; unitRate: string | number; amount: string | number }>, startY: number): number {
  const cols = { desc: 50, qty: 300, unit: 350, rate: 400, amount: 480 };
  let y = startY;

  // Header row
  doc.fillColor('#1976D2').rect(50, y, 495, 18).fill();
  doc.fontSize(8).fillColor('#ffffff');
  doc.text('DESCRIPTION', cols.desc + 3, y + 5);
  doc.text('QTY', cols.qty, y + 5);
  doc.text('UNIT', cols.unit, y + 5);
  doc.text('RATE', cols.rate, y + 5);
  doc.text('AMOUNT', cols.amount, y + 5);
  y += 20;

  // Item rows
  items.forEach((item, i) => {
    if (i % 2 === 0) doc.fillColor('#f5f5f5').rect(50, y, 495, 18).fill();
    doc.fillColor('#1a1a1a').fontSize(9);
    doc.text(item.description, cols.desc + 3, y + 4, { width: 240 });
    doc.text(String(Number(item.quantity).toFixed(1)), cols.qty, y + 4);
    doc.text(item.unit, cols.unit, y + 4);
    doc.text(fmt(item.unitRate), cols.rate, y + 4);
    doc.text(fmt(item.amount), cols.amount, y + 4);
    y += 20;
  });

  return y;
}

function drawTotals(doc: InstanceType<typeof PDFDocument>, subtotal: number | string, taxRate: number | string, taxAmount: number | string, totalAmount: number | string, y: number, extras?: Array<{ label: string; value: string }>): number {
  y += 10;
  const labelX = 380;
  const valueX = 480;

  doc.fontSize(9).fillColor('#555555');
  doc.text('Subtotal:', labelX, y); doc.text(fmt(subtotal), valueX, y); y += 16;
  doc.text(`GST (${(Number(taxRate) * 100).toFixed(0)}%):`, labelX, y); doc.text(fmt(taxAmount), valueX, y); y += 16;

  if (extras) {
    extras.forEach(({ label, value }) => {
      doc.text(label, labelX, y); doc.text(value, valueX, y); y += 16;
    });
  }

  doc.moveTo(labelX, y).lineTo(545, y).strokeColor('#1976D2').lineWidth(1).stroke();
  y += 6;
  doc.fontSize(11).fillColor('#1976D2').font('Helvetica-Bold');
  doc.text('TOTAL:', labelX, y); doc.text(fmt(totalAmount), valueX, y);
  doc.font('Helvetica');
  return y + 20;
}

/**
 * Generate invoice PDF and return a Buffer.
 */
export async function generateInvoicePdf(invoice: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawHeader(doc, 'TAX INVOICE', invoice.invoiceCode);

    // Dates block
    doc.fontSize(9).fillColor('#555555');
    doc.text(`Issue Date: ${fmtDate(invoice.issueDate)}`, 400, 115);
    doc.text(`Due Date: ${fmtDate(invoice.dueDate)}`, 400, 130);
    if (invoice.project) doc.text(`Project: ${invoice.project.projectCode}`, 400, 145);

    drawClientBlock(doc, invoice.client, 160);

    let y = drawLineItemsTable(
      doc,
      invoice.lineItems.map((l) => ({ description: l.description, quantity: l.quantity, unit: l.unit, unitRate: l.unitRate, amount: l.amount })),
      230,
    );

    const extras: Array<{ label: string; value: string }> = [];
    if (Number(invoice.paidAmount) > 0) {
      extras.push({ label: 'Paid:', value: fmt(invoice.paidAmount) });
      extras.push({ label: 'Outstanding:', value: fmt(invoice.outstandingAmount) });
    }

    y = drawTotals(doc, invoice.subtotal, invoice.taxRate, invoice.taxAmount, invoice.totalAmount, y, extras);

    if (invoice.notes) {
      y += 10;
      doc.fontSize(9).fillColor('#555555').text('Notes:', 50, y);
      doc.fontSize(9).fillColor('#1a1a1a').text(invoice.notes, 50, y + 14, { width: 495 });
    }

    doc.end();
  });
}

/**
 * Generate quotation PDF and return a Buffer.
 */
export async function generateQuotationPdf(quotation: QuotationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    drawHeader(doc, 'QUOTATION', quotation.quotationCode);

    doc.fontSize(9).fillColor('#555555');
    doc.text(`Title: ${quotation.title}`, 400, 115);
    doc.text(`Valid Until: ${fmtDate(quotation.validUntil)}`, 400, 130);

    drawClientBlock(doc, quotation.client, 160);

    let y = drawLineItemsTable(
      doc,
      quotation.lineItems.map((l) => ({
        description: l.workerType ? `${l.description} (${l.workerType})` : l.description,
        quantity: l.quantity,
        unit: l.unit,
        unitRate: l.unitRate,
        amount: l.amount,
      })),
      230,
    );

    const extras: Array<{ label: string; value: string }> = [];
    if (Number(quotation.discountAmount) > 0) {
      extras.push({ label: 'Discount:', value: `-${fmt(quotation.discountAmount)}` });
    }

    y = drawTotals(doc, quotation.subtotal, quotation.taxRate, quotation.taxAmount, quotation.totalAmount, y, extras);

    if (quotation.notes) {
      y += 10;
      doc.fontSize(9).fillColor('#555555').text('Notes:', 50, y);
      doc.fontSize(9).fillColor('#1a1a1a').text(quotation.notes, 50, y + 14, { width: 495 });
      y += 30;
    }

    if (quotation.termsAndCond) {
      y += 10;
      doc.fontSize(9).fillColor('#555555').text('Terms & Conditions:', 50, y);
      doc.fontSize(9).fillColor('#1a1a1a').text(quotation.termsAndCond, 50, y + 14, { width: 495 });
    }

    doc.end();
  });
}

// ─── Payslip ─────────────────────────────────────────────────────────────────

const MONTH_NAMES_PDF = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export interface PayslipData {
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    jobTitle?: string | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
  };
  project: { name: string; projectCode: string };
  month: number;
  year: number;
  daysWorked: number;
  paidLeaveDays?: Numeric;
  unpaidLeaveDays?: Numeric;
  leaveDeduction?: Numeric;
  basicPay: Numeric;
  overtimePay: Numeric;
  allowances: Numeric;
  cpfEmployee: Numeric;
  cpfEmployer: Numeric;
  totalPayable: Numeric;
  totalCostToCompany: Numeric;
  isPaid: boolean;
  paidAt?: Date | null;
  orgName?: string;
}

/**
 * Generate a payslip PDF and return a Buffer.
 */
export async function generatePayslipPdf(data: PayslipData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const orgName = data.orgName ?? 'Aadhirai HRM OS';
    const period = `${MONTH_NAMES_PDF[data.month - 1]} ${data.year}`;

    // Header
    doc.fontSize(20).fillColor('#1976D2').text(orgName, 50, 50);
    doc.fontSize(10).fillColor('#666666').text('Payslip', 50, 74);
    doc.moveTo(50, 96).lineTo(545, 96).strokeColor('#1976D2').lineWidth(2).stroke();

    // Title band
    doc.fillColor('#1976D2').rect(50, 108, 495, 24).fill();
    doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold')
      .text(`PAYSLIP — ${period}`, 58, 114);
    doc.font('Helvetica');

    // Employee info block
    let y = 148;
    doc.fontSize(9).fillColor('#555555').text('EMPLOYEE:', 50, y);
    doc.fontSize(10).fillColor('#1a1a1a')
      .text(`${data.employee.firstName} ${data.employee.lastName}`, 50, y + 13);
    doc.fontSize(9).fillColor('#555555').text(data.employee.employeeCode, 50, y + 27);
    if (data.employee.jobTitle) doc.text(data.employee.jobTitle, 50, y + 40);

    doc.fontSize(9).fillColor('#555555').text('PROJECT:', 300, y);
    doc.fontSize(10).fillColor('#1a1a1a').text(data.project.name, 300, y + 13);
    doc.fontSize(9).fillColor('#555555').text(data.project.projectCode, 300, y + 27);
    doc.text(`Days Worked: ${data.daysWorked}`, 300, y + 40);

    const paidLeaveDays = Number(data.paidLeaveDays ?? 0);
    const unpaidLeaveDays = Number(data.unpaidLeaveDays ?? 0);
    let leaveLineY = y + 53;
    if (paidLeaveDays > 0) {
      doc.text(`Paid Leave: ${paidLeaveDays} day(s)`, 300, leaveLineY);
      leaveLineY += 13;
    }
    if (unpaidLeaveDays > 0) {
      doc.fillColor('#c62828').text(`Unpaid Leave: ${unpaidLeaveDays} day(s) (not paid)`, 300, leaveLineY);
      doc.fillColor('#1a1a1a');
    }

    y += 70;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e0e0e0').lineWidth(1).stroke();
    y += 12;

    const drawRow = (label: string, amount: Numeric, bold = false, color = '#1a1a1a') => {
      doc.fontSize(9).fillColor('#555555').text(label, 60, y);
      doc.fontSize(9).fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .text(fmt(amount), 420, y, { width: 120, align: 'right' });
      doc.font('Helvetica');
      y += 18;
    };

    // Earnings header
    doc.fillColor('#f5f5f5').rect(50, y - 4, 495, 20).fill();
    doc.fontSize(8).fillColor('#555555').font('Helvetica-Bold')
      .text('EARNINGS', 60, y + 2).text('AMOUNT (SGD)', 420, y + 2, { width: 120, align: 'right' });
    doc.font('Helvetica');
    y += 20;

    const basicPay = Number(data.basicPay);
    const overtimePay = Number(data.overtimePay);
    const allowances = Number(data.allowances);
    const grossPay = basicPay + overtimePay + allowances;

    drawRow('Basic Pay', basicPay);
    if (overtimePay > 0) drawRow('Overtime Pay', overtimePay);
    if (allowances > 0) drawRow('Allowances', allowances);
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
    y += 6;
    drawRow('Gross Pay', grossPay, true);
    y += 8;

    // Deductions header
    doc.fillColor('#f5f5f5').rect(50, y - 4, 495, 20).fill();
    doc.fontSize(8).fillColor('#555555').font('Helvetica-Bold')
      .text('DEDUCTIONS', 60, y + 2).text('AMOUNT (SGD)', 420, y + 2, { width: 120, align: 'right' });
    doc.font('Helvetica');
    y += 20;

    const cpfEE = Number(data.cpfEmployee);
    const cpfER = Number(data.cpfEmployer);
    if (cpfEE > 0 || cpfER > 0) {
      drawRow('CPF Employee Contribution', cpfEE, false, '#d97706');
      drawRow('CPF Employer Contribution (info)', cpfER, false, '#64748b');
    } else {
      drawRow('CPF (Not Applicable)', 0, false, '#94a3b8');
    }

    const leaveDeduction = Number(data.leaveDeduction ?? 0);
    if (leaveDeduction > 0) {
      // Informational only — this amount is already reflected in Basic Pay
      // above (unpaid leave days are excluded from days worked), not
      // subtracted again here.
      drawRow(`Unpaid Leave (${unpaidLeaveDays} day(s), already excluded from Basic Pay)`, leaveDeduction, false, '#94a3b8');
    }

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#1976D2').lineWidth(1).stroke();
    y += 8;

    // Net pay banner
    doc.fillColor('#1976D2').rect(50, y, 495, 28).fill();
    doc.fontSize(11).fillColor('#ffffff').font('Helvetica-Bold').text('NET PAY:', 60, y + 8);
    doc.text(fmt(data.totalPayable), 420, y + 8, { width: 120, align: 'right' });
    doc.font('Helvetica');
    y += 38;

    // Bank info
    if (data.employee.bankName || data.employee.bankAccountNo) {
      y += 6;
      doc.fontSize(9).fillColor('#555555').text('Payment to:', 50, y);
      if (data.employee.bankName) doc.text(data.employee.bankName, 50, y + 13);
      if (data.employee.bankAccountNo) doc.text(`Account: ${data.employee.bankAccountNo}`, 50, y + 26);
      y += 40;
    }

    // Status
    y += 6;
    const statusColor = data.isPaid ? '#059669' : '#d97706';
    const statusLabel = data.isPaid ? `PAID${data.paidAt ? ' on ' + fmtDate(data.paidAt) : ''}` : 'PENDING PAYMENT';
    doc.fontSize(10).fillColor(statusColor).font('Helvetica-Bold').text(`Status: ${statusLabel}`, 50, y);
    doc.font('Helvetica');

    // Footer
    doc.fontSize(8).fillColor('#94a3b8')
      .text('This payslip is computer generated and does not require a signature.', 50, 780, { width: 495, align: 'center' });

    doc.end();
  });
}
