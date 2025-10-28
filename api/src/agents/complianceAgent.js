export async function runComplianceAgent ({ requestedAction, context }) {
  const issues = [];
  if (requestedAction === 'freeze_card' && !context?.otp) {
    issues.push('OTP required before freezing card');
  }
  if (requestedAction === 'open_dispute' && !context?.reasonCode) {
    issues.push('Reason code must be provided');
  }
  return {
    tool: 'compliance',
    ok: issues.length === 0,
    output: {
      blocked: issues.length > 0,
      issues
    }
  };
}

export default { runComplianceAgent };
