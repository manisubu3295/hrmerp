"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENCY = exports.PAGINATION_DEFAULTS = exports.DEFAULT_CPF_RATES = exports.DEFAULT_GST_RATE = exports.INVOICE_OVERDUE_DAYS = exports.DEFAULT_PROFIT_MARGIN_TARGET = exports.BUDGET_ALERT_THRESHOLD = exports.WORK_PASS_ALERT_DAYS = void 0;
exports.WORK_PASS_ALERT_DAYS = {
    CRITICAL: 7,
    URGENT: 15,
    WARNING: 30,
};
exports.BUDGET_ALERT_THRESHOLD = 0.8; // 80%
exports.DEFAULT_PROFIT_MARGIN_TARGET = 0.15; // 15%
exports.INVOICE_OVERDUE_DAYS = 14;
exports.DEFAULT_GST_RATE = 0.09; // Singapore 9% GST
exports.DEFAULT_CPF_RATES = {
    EMPLOYEE: 0.2,
    EMPLOYER: 0.17,
};
exports.PAGINATION_DEFAULTS = {
    PAGE: 1,
    LIMIT: 20,
    MAX_LIMIT: 100,
};
exports.CURRENCY = {
    CODE: 'SGD',
    SYMBOL: '$',
    LOCALE: 'en-SG',
};
//# sourceMappingURL=constants.js.map