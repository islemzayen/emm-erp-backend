const Avance = require("../../models/Avance");
const User   = require("../../models/User");

exports.createAvance = (data) => Avance.create(data);

exports.getAvances = (filters = {}) => {
  const query = {};
  if (filters.employeeId) query.employeeId = filters.employeeId;
  if (filters.status)     query.status = filters.status;
  if (filters.department) query.department = filters.department;
  return Avance.find(query).sort({ createdAt: -1 });
};

exports.approveAndDeduct = async (id, approverName) => {
  const avance = await Avance.findById(id);
  if (!avance) throw new Error("Avance not found");
  if (avance.status !== "Pending") throw new Error("Avance already processed");

  const employee = await User.findById(avance.employeeId);
  if (!employee) throw new Error("Employee not found");

  const salaryBefore = employee.salary;
  const salaryAfter  = Math.max(0, salaryBefore - avance.amount);

  // Deduct from salary
  await User.findByIdAndUpdate(avance.employeeId, { salary: salaryAfter });

  // Update avance record
  return Avance.findByIdAndUpdate(id, {
    status:       "Deducted",
    approvedBy:   approverName,
    approvedAt:   new Date(),
    deductedAt:   new Date(),
    salaryBefore,
    salaryAfter,
  }, { new: true });
};

exports.deleteAvance = (id) => Avance.findByIdAndDelete(id);
