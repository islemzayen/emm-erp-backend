// services/payrollSummary.service.js
// Read-only service — produces the monthly payroll data Finance needs.
// Finance module calls GET /api/payroll/summary?month=YYYY-MM

const User            = require("../../models/User");
const DailyAttendance = require("../../models/DailyAttendance");
const Avance          = require("../../models/Avance");

// ── Pay cycle rule ────────────────────────────────────────────────────────────
// Employee joined ON the last day of the month → no pay this month
function isExcludedByPayCycle(emp, month) {
  if (!emp.joinedDate) return false;
  const joinDate = new Date(emp.joinedDate);
  const lastDay  = new Date(month + "-01");
  lastDay.setMonth(lastDay.getMonth() + 1);
  lastDay.setDate(0);
  joinDate.setHours(0, 0, 0, 0);
  lastDay.setHours(0, 0, 0, 0);
  return joinDate.getTime() === lastDay.getTime();
}

// ── CNSS constants (Tunisian Labour Law) ─────────────────────────────────────
const CNSS_EMPLOYEE_RATE = 0.0967;  // 9.67%  deducted from brut (employee's share)
const CNSS_EMPLOYER_RATE = 0.2000;  // 20.00% paid by employer on top of brut
const CNSS_TOTAL_RATE    = 0.2967;  // 29.67% total

// salary field = agreed NET (what employee expects in hand).
// Brut is back-calculated: brut = net / (1 - 0.0967)

function calcPayroll(emp, att, avances, month) {
  if (isExcludedByPayCycle(emp, month)) {
    return {
      employeeId: String(emp._id), employeeName: emp.name,
      department: emp.department,  position: emp.position || "",
      agreedNet: emp.salary || 0,
      brutMonthly: 0, effectiveBase: 0, overtimePay: 0, absenceDeduction: 0,
      absentDays: 0, grossSalary: 0,
      cnssEmployee: 0, cnssEmployer: 0, cnssTotal: 0,
      avanceDeductions: 0, netSalary: 0,
      note: "Joined on last day of month — excluded from this pay cycle",
    };
  }

  const agreedNet   = emp.salary || 0;
  const brutMonthly = Math.round(agreedNet / (1 - CNSS_EMPLOYEE_RATE));
  const hourly      = brutMonthly / 208;
  const daily       = brutMonthly / 26;

  const hoursWorked    = att ? (att.totalHoursWorked || 0) : 0;
  const extraHours     = att ? (att.totalExtraHours  || 0) : 0;
  const absentDays     = att ? (att.absentDays       || 0) : 0;

  const effectiveBase    = hoursWorked === 0 ? 0 : Math.round(hourly * hoursWorked);
  const overtimePay      = Math.round(hourly * extraHours);
  const absenceDeduction = Math.round(daily  * absentDays);

  const grossSalary    = effectiveBase + overtimePay;

  // CNSS split
  const cnssEmployee   = hoursWorked === 0 ? 0 : Math.round(grossSalary * CNSS_EMPLOYEE_RATE);
  const cnssEmployer   = hoursWorked === 0 ? 0 : Math.round(grossSalary * CNSS_EMPLOYER_RATE);
  const cnssTotal      = cnssEmployee + cnssEmployer;

  const avTotal = avances
    .filter(a => String(a.employeeId) === String(emp._id) &&
      (a.status === "Deducted" || a.status === "Approved" || a.status === "approved"))
    .reduce((s, a) => s + (a.amount || 0), 0);

  // Net = agreed salary − avance only (CNSS is informational, not deducted)
  const netSalary = agreedNet - avTotal;

  return {
    employeeId:       String(emp._id),
    employeeName:     emp.name,
    department:       emp.department,
    position:         emp.position || "",
    agreedNet,           // salary as stored — the agreed take-home amount
    brutMonthly,         // back-calculated monthly brut
    effectiveBase,       // earned brut based on hours
    overtimePay,
    absenceDeduction,
    absentDays,
    hoursWorked,
    grossSalary,
    cnssEmployee,        // 9.67% — deducted from employee
    cnssEmployer,        // 20.00% — company's cost
    cnssTotal,           // 29.67%
    avanceDeductions: avTotal,
    netSalary,
  };
}

// ── Attendance aggregation ────────────────────────────────────────────────────
async function getAttMap(month) {
  const records = await DailyAttendance.find({ date: { $regex: `^${month}` } });
  const map = {};
  for (const r of records) {
    const id = String(r.employeeId);
    if (!map[id]) map[id] = {
      presentDays: 0, absentDays: 0, lateDays: 0,
      totalExtraHours: 0, totalHoursWorked: 0,
    };
    if (r.status === "Present") map[id].presentDays++;
    if (r.status === "Absent")  map[id].absentDays++;
    if (r.status === "Late")    { map[id].lateDays++; map[id].presentDays++; }
    map[id].totalExtraHours  += r.extraHours  || 0;
    map[id].totalHoursWorked += r.hoursWorked || 0;
  }
  return map;
}

// ── Main export ───────────────────────────────────────────────────────────────
exports.getPayrollSummary = async (month) => {
  const [employees, avances, attMap] = await Promise.all([
    // Include all staff — employees AND managers
    User.find({
      role: { $in: ["EMPLOYEE", "HR_MANAGER", "MARKETING_MANAGER", "SALES_MANAGER"] }
    }).select("-password"),
    Avance.find(),
    getAttMap(month),
  ]);

  const rows = employees.map(emp =>
    calcPayroll(emp, attMap[String(emp._id)], avances, month)
  );

  // Totals for Finance — what the company needs to pay out
  const totals = {
    month,
    totalAgreedNet:        rows.reduce((s, r) => s + r.agreedNet,         0),
    totalBrut:             rows.reduce((s, r) => s + r.brutMonthly,       0),
    totalEarned:           rows.reduce((s, r) => s + r.effectiveBase,     0),
    totalOvertime:         rows.reduce((s, r) => s + r.overtimePay,       0),
    totalCnssEmployee:     rows.reduce((s, r) => s + r.cnssEmployee,      0),
    totalCnssEmployer:     rows.reduce((s, r) => s + r.cnssEmployer,      0),
    totalCnssTotal:        rows.reduce((s, r) => s + r.cnssTotal,         0),
    totalAvances:          rows.reduce((s, r) => s + r.avanceDeductions,  0),
    totalNetSalary:        rows.reduce((s, r) => s + r.netSalary,         0),
    employeeCount:         rows.length,
  };

  return { month, totals, employees: rows };
};