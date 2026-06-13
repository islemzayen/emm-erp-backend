const statsService = require("../services/onlineSalesStats.service");

async function onlineSalesStatsRoutes(fastify) {
  // GET /api/online-sales/stats
  fastify.get("/stats", {
    preHandler: [fastify.authenticate],
  }, async (req, reply) => {
    const stats = await statsService.getDashboardStats();
    return reply.send(stats);
  });
}

module.exports = onlineSalesStatsRoutes;
