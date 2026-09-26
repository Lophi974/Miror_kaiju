export const ACTION = {
  RESERVE: "reserve",
  REQUEST: "request",
  TRANSFER: "transfer",
  REQUISITION: "requisition",
  TRESHOLD: "threshold",
  DECIDE: "decide",
};

const RULE = {
  [ACTION.RESERVE]: {
    roles: ["QC"],
    minLevel: 2,
  },
  [ACTION.REQUEST]: {
    roles: ["QC"],
    minLevel: 3,
  },
  [ACTION.TRANSFER]: {
    roles: ["LC"],
    minLevel: 4,
  },
  [ACTION.REQUISITION]: {
    roles: ["CD"],
    minLevel: 4,
  },
  [ACTION.DECIDE]: {
    roles: ["QC"],
    minLevel: 3,
  },
};

export function firstStepChecking(
  role: string,
  severityLevel: number,
  action: string,
): boolean {
  console.log(
    `Checking authorization for role: ${role}, severityLevel: ${severityLevel}, action: ${action}`,
  );

  if (!action || !RULE[action]) {
    return false;
  }

  if (severityLevel < RULE[action].minLevel) return false;

  if (RULE[action].roles.includes(role)) return true;

  if (action === ACTION.REQUEST && role === "LC" && severityLevel >= 4)
    return true;

  if (action === ACTION.REQUEST && severityLevel === 5) return true;

  if (action === ACTION.TRANSFER && role === "CD" && severityLevel === 5)
    return true;

  return false;
}
