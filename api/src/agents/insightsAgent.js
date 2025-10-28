import { getCustomerInsights } from '../db/queries.js';

export async function runInsightsAgent ({ customerId }) {
  const insights = await getCustomerInsights(customerId);
  return {
    tool: 'insights',
    ok: true,
    output: {
      summary: insights.summary,
      topCategories: insights.categories,
      topMerchants: insights.merchants
    }
  };
}

export default { runInsightsAgent };
