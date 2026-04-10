"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceStatus = exports.EmploymentType = exports.NotificationType = exports.NotificationPriority = exports.NotificationChannel = exports.InventoryTransactionType = exports.EquipmentCategory = exports.WorkPassStatus = exports.WorkPassType = exports.ExpenseStatus = exports.ExpenseCategory = exports.InvoiceStatus = exports.QuotationStatus = exports.ProjectStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["ADMIN"] = "ADMIN";
    UserRole["MANAGER"] = "MANAGER";
    UserRole["SUPERVISOR"] = "SUPERVISOR";
    UserRole["EMPLOYEE"] = "EMPLOYEE";
})(UserRole || (exports.UserRole = UserRole = {}));
var ProjectStatus;
(function (ProjectStatus) {
    ProjectStatus["DRAFT"] = "DRAFT";
    ProjectStatus["ACTIVE"] = "ACTIVE";
    ProjectStatus["ON_HOLD"] = "ON_HOLD";
    ProjectStatus["COMPLETED"] = "COMPLETED";
    ProjectStatus["CANCELLED"] = "CANCELLED";
})(ProjectStatus || (exports.ProjectStatus = ProjectStatus = {}));
var QuotationStatus;
(function (QuotationStatus) {
    QuotationStatus["DRAFT"] = "DRAFT";
    QuotationStatus["SENT"] = "SENT";
    QuotationStatus["VIEWED"] = "VIEWED";
    QuotationStatus["APPROVED"] = "APPROVED";
    QuotationStatus["REJECTED"] = "REJECTED";
    QuotationStatus["EXPIRED"] = "EXPIRED";
})(QuotationStatus || (exports.QuotationStatus = QuotationStatus = {}));
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "DRAFT";
    InvoiceStatus["SENT"] = "SENT";
    InvoiceStatus["UNPAID"] = "UNPAID";
    InvoiceStatus["PARTIALLY_PAID"] = "PARTIALLY_PAID";
    InvoiceStatus["PAID"] = "PAID";
    InvoiceStatus["OVERDUE"] = "OVERDUE";
    InvoiceStatus["CANCELLED"] = "CANCELLED";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var ExpenseCategory;
(function (ExpenseCategory) {
    ExpenseCategory["TRANSPORT"] = "TRANSPORT";
    ExpenseCategory["MEALS"] = "MEALS";
    ExpenseCategory["MATERIALS"] = "MATERIALS";
    ExpenseCategory["SUB_CONTRACTOR"] = "SUB_CONTRACTOR";
    ExpenseCategory["PERMITS"] = "PERMITS";
    ExpenseCategory["ACCOMMODATION"] = "ACCOMMODATION";
    ExpenseCategory["MISCELLANEOUS"] = "MISCELLANEOUS";
})(ExpenseCategory || (exports.ExpenseCategory = ExpenseCategory = {}));
var ExpenseStatus;
(function (ExpenseStatus) {
    ExpenseStatus["PENDING"] = "PENDING";
    ExpenseStatus["APPROVED"] = "APPROVED";
    ExpenseStatus["REJECTED"] = "REJECTED";
})(ExpenseStatus || (exports.ExpenseStatus = ExpenseStatus = {}));
var WorkPassType;
(function (WorkPassType) {
    WorkPassType["WORK_PERMIT"] = "WORK_PERMIT";
    WorkPassType["S_PASS"] = "S_PASS";
    WorkPassType["EMPLOYMENT_PASS"] = "EMPLOYMENT_PASS";
    WorkPassType["TRAINING_WORK_PERMIT"] = "TRAINING_WORK_PERMIT";
    WorkPassType["LETTER_OF_CONSENT"] = "LETTER_OF_CONSENT";
})(WorkPassType || (exports.WorkPassType = WorkPassType = {}));
var WorkPassStatus;
(function (WorkPassStatus) {
    WorkPassStatus["ACTIVE"] = "ACTIVE";
    WorkPassStatus["EXPIRING_SOON"] = "EXPIRING_SOON";
    WorkPassStatus["EXPIRED"] = "EXPIRED";
    WorkPassStatus["RENEWED"] = "RENEWED";
    WorkPassStatus["CANCELLED"] = "CANCELLED";
})(WorkPassStatus || (exports.WorkPassStatus = WorkPassStatus = {}));
var EquipmentCategory;
(function (EquipmentCategory) {
    EquipmentCategory["SAFETY_EQUIPMENT"] = "SAFETY_EQUIPMENT";
    EquipmentCategory["TOOLS"] = "TOOLS";
    EquipmentCategory["CONSUMABLES"] = "CONSUMABLES";
    EquipmentCategory["MACHINERY"] = "MACHINERY";
    EquipmentCategory["VEHICLES"] = "VEHICLES";
    EquipmentCategory["IT_EQUIPMENT"] = "IT_EQUIPMENT";
    EquipmentCategory["OTHER"] = "OTHER";
})(EquipmentCategory || (exports.EquipmentCategory = EquipmentCategory = {}));
var InventoryTransactionType;
(function (InventoryTransactionType) {
    InventoryTransactionType["PURCHASE"] = "PURCHASE";
    InventoryTransactionType["ISSUE"] = "ISSUE";
    InventoryTransactionType["RETURN"] = "RETURN";
    InventoryTransactionType["LOSS"] = "LOSS";
    InventoryTransactionType["DAMAGE"] = "DAMAGE";
    InventoryTransactionType["ADJUSTMENT"] = "ADJUSTMENT";
})(InventoryTransactionType || (exports.InventoryTransactionType = InventoryTransactionType = {}));
var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["IN_APP"] = "IN_APP";
    NotificationChannel["EMAIL"] = "EMAIL";
    NotificationChannel["WHATSAPP"] = "WHATSAPP";
})(NotificationChannel || (exports.NotificationChannel = NotificationChannel = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["LOW"] = "LOW";
    NotificationPriority["MEDIUM"] = "MEDIUM";
    NotificationPriority["HIGH"] = "HIGH";
    NotificationPriority["URGENT"] = "URGENT";
    NotificationPriority["CRITICAL"] = "CRITICAL";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
var NotificationType;
(function (NotificationType) {
    // Compliance
    NotificationType["WORK_PASS_EXPIRING_30"] = "WORK_PASS_EXPIRING_30";
    NotificationType["WORK_PASS_EXPIRING_15"] = "WORK_PASS_EXPIRING_15";
    NotificationType["WORK_PASS_EXPIRING_7"] = "WORK_PASS_EXPIRING_7";
    NotificationType["WORK_PASS_EXPIRED"] = "WORK_PASS_EXPIRED";
    NotificationType["WORK_PASS_RENEWED"] = "WORK_PASS_RENEWED";
    // Finance
    NotificationType["INVOICE_OVERDUE"] = "INVOICE_OVERDUE";
    NotificationType["PROJECT_BUDGET_80"] = "PROJECT_BUDGET_80";
    NotificationType["PAYMENT_RECEIVED"] = "PAYMENT_RECEIVED";
    NotificationType["PROFIT_BELOW_TARGET"] = "PROFIT_BELOW_TARGET";
    // Operations
    NotificationType["PROJECT_END_APPROACHING"] = "PROJECT_END_APPROACHING";
    NotificationType["EQUIPMENT_MAINTENANCE_DUE"] = "EQUIPMENT_MAINTENANCE_DUE";
    NotificationType["INVENTORY_LOW_STOCK"] = "INVENTORY_LOW_STOCK";
    NotificationType["PROJECT_COMPLETED"] = "PROJECT_COMPLETED";
    // HR
    NotificationType["EMPLOYEE_CERT_EXPIRING"] = "EMPLOYEE_CERT_EXPIRING";
    NotificationType["PAYROLL_REMINDER"] = "PAYROLL_REMINDER";
    NotificationType["EMPLOYEE_SAFETY_TRAINING_DUE"] = "EMPLOYEE_SAFETY_TRAINING_DUE";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var EmploymentType;
(function (EmploymentType) {
    EmploymentType["FULL_TIME"] = "FULL_TIME";
    EmploymentType["PART_TIME"] = "PART_TIME";
    EmploymentType["CONTRACT"] = "CONTRACT";
    EmploymentType["FOREIGN_WORKER"] = "FOREIGN_WORKER";
})(EmploymentType || (exports.EmploymentType = EmploymentType = {}));
var AttendanceStatus;
(function (AttendanceStatus) {
    AttendanceStatus["PRESENT"] = "PRESENT";
    AttendanceStatus["ABSENT"] = "ABSENT";
    AttendanceStatus["HALF_DAY"] = "HALF_DAY";
    AttendanceStatus["OVERTIME"] = "OVERTIME";
    AttendanceStatus["LEAVE"] = "LEAVE";
})(AttendanceStatus || (exports.AttendanceStatus = AttendanceStatus = {}));
//# sourceMappingURL=enums.js.map