process.env.JWT_SECRET = "test-secret";

const calendarService    = require("../marketing/services/marketingCalendar.service");
const MarketingBudget    = require("../models/MarketingBudget");
const MarketingEvent     = require("../models/MarketingEvent");
const SystemNotification = require("../models/SystemNotification");

const YEAR = 2026;

describe("marketingCalendar.service", () => {
  describe("transferBudget", () => {
    it("moves allocation atomically between two months", async () => {
      await calendarService.setAnnualBudget(YEAR, 12000, null);
      await calendarService.updateMonthlyAllocations(YEAR, [
        { month: "2026-01", allocated: 1000 },
      ]);

      const result = await calendarService.transferBudget(YEAR, "2026-01", "2026-02", 400);

      const jan = result.monthlyAllocations.find(m => m.month === "2026-01");
      const feb = result.monthlyAllocations.find(m => m.month === "2026-02");
      expect(jan.allocated).toBe(600);
      expect(feb.allocated).toBe(400);
    });

    it("rejects a transfer exceeding the source month's allocation", async () => {
      await calendarService.setAnnualBudget(YEAR, 12000, null);
      await calendarService.updateMonthlyAllocations(YEAR, [
        { month: "2026-01", allocated: 300 },
      ]);

      await expect(
        calendarService.transferBudget(YEAR, "2026-01", "2026-02", 500)
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("extra-budget workflow", () => {
    async function makeEvent() {
      return calendarService.createEvent(
        { title: "Trade Fair", date: "2026-03-10", budget: 5000 },
        null
      );
    }

    it("flags the event and notifies Finance on request", async () => {
      const event = await makeEvent();

      const updated = await calendarService.requestExtraBudget(event._id, "Need more");

      expect(updated.budgetRequestStatus).toBe("requested");

      const notif = await SystemNotification.findOne({
        recipientRole: "FINANCE_MANAGER", type: "BUDGET_EXTRA_REQUEST",
      });
      expect(notif).not.toBeNull();
    });

    it("notifies Marketing when Finance approves the request", async () => {
      const event = await makeEvent();
      await calendarService.requestExtraBudget(event._id, "Need more");

      const updated = await calendarService.approveBudgetRequest(event._id, "Finance Mgr");
      expect(updated.budgetRequestStatus).toBe("approved");

      const notif = await SystemNotification.findOne({
        recipientRole: "MARKETING_MANAGER", type: "BUDGET_APPROVED",
      });
      expect(notif).not.toBeNull();
    });

    it("notifies Marketing when Finance declines the request", async () => {
      const event = await makeEvent();
      await calendarService.requestExtraBudget(event._id, "Need more");

      const updated = await calendarService.declineBudgetRequest(event._id, "Finance Mgr", "Budget cap");
      expect(updated.budgetRequestStatus).toBe("declined");

      const notif = await SystemNotification.findOne({
        recipientRole: "MARKETING_MANAGER", type: "BUDGET_DECLINED",
      });
      expect(notif).not.toBeNull();
    });
  });
});
