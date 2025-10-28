export function summarizeReasons (reasons = []) {
  if (!reasons.length) return 'No significant anomalies detected.';
  return reasons.map((reason, idx) => `${idx + 1}. ${reason}`).join(' ');
}

export default { summarizeReasons };
