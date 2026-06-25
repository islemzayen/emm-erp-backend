process.env.JWT_SECRET = "test-secret";

const avanceService      = require("../hr/services/avance.service");
const Avance             = require("../models/Avance");
const User               = require("../models/User");
const SystemNotification = require("../models/SystemNotification");

async function makeEmployee(salary = 2000) {
  return User.create({
    name: "Adel Employee", email: "adel@test.com", password: "123456",
    role: "EMPLOYEE", department: "HR", salary,
  });
}

describe("avance.service", () => {
  describe("createAvance", () => {
    it("creates a pending advance and notifies Finance", async () => {
      const emp = await makeEmployee();

      const avance = await avanceService.createAvance({
        employeeId: emp._id, employeeName: emp.name, department: "HR",
        amount: 300, reason: "Medical",
      });

      expect(avance.status).toBe("Pending");

      const notif = await SystemNotification.findOne({
        recipientRole: "FINANCE_MANAGER", type: "ADVANCE_REQUESTED",
      });
      expect(notif).not.toBeNull();
    });
  });

  describe("approveAndDeduct", () => {
    it("deducts the salary, marks the advance Deducted and notifies HR", async () => {
      const emp = await makeEmployee(2000);

      const avance = await avanceService.createAvance({
        employeeId: emp._id, employeeName: emp.name, department: "HR",
        amount: 300, reason: "Medical",
      });

      const updated = await avanceService.approveAndDeduct(avance._id, "Finance Mgr");

      expect(updated.status).toBe("Deducted");
      expect(updated.salaryBefore).toBe(2000);
      expect(updated.salaryAfter).toBe(1700);

      const empAfter = await User.findById(emp._id);
      expect(empAfter.salary).toBe(1700);

      const notif = await SystemNotification.findOne({
        recipientRole: "HR_MANAGER", type: "ADVANCE_APPROVED",
      });
      expect(notif).not.toBeNull();
    });

    it("throws when re-approving an already processed advance", async () => {
      const emp = await makeEmployee();

      const avance = await avanceService.createAvance({
        employeeId: emp._id, employeeName: emp.name, department: "HR",
        amount: 300, reason: "Medical",
      });
      await avanceService.approveAndDeduct(avance._id, "Finance Mgr");

      await expect(
        avanceService.approveAndDeduct(avance._id, "Finance Mgr")
      ).rejects.toThrow("already processed");
    });
  });

  describe("declineAvance", () => {
    it("marks the advance Rejected and notifies HR", async () => {
      const emp = await makeEmployee();

      const avance = await avanceService.createAvance({
        employeeId: emp._id, employeeName: emp.name, department: "HR",
        amount: 300, reason: "Medical",
      });

      const updated = await avanceService.declineAvance(avance._id, "Finance Mgr", "Budget");

      expect(updated.status).toBe("Rejected");

      const notif = await SystemNotification.findOne({
        recipientRole: "HR_MANAGER", type: "ADVANCE_DECLINED",
      });
      expect(notif).not.toBeNull();
    });
  });
});
