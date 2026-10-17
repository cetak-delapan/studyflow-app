const PRIORITY_META = {
  High: {
    label: "Tinggi",
    description: "Deadline hari ini, sudah lewat, atau maksimal 3 hari lagi.",
    className: "border-red-200 bg-red-50 text-red-700",
    dotClassName: "bg-red-600",
  },
  Medium: {
    label: "Sedang",
    description: "Deadline masih dalam 4 sampai 7 hari.",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    dotClassName: "bg-amber-500",
  },
  Low: {
    label: "Rendah",
    description: "Deadline masih lebih dari 7 hari lagi.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-600",
  },
};

function parseDateOnly(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function getDaysUntilDeadline(deadline) {
  const parsed = parseDateOnly(deadline);
  if (!parsed) return null;

  const deadlineUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((deadlineUtc - todayUtc) / 86400000);
}

export function getDeadlinePriority(deadline) {
  const daysLeft = getDaysUntilDeadline(deadline);
  if (daysLeft === null) return null;
  if (daysLeft <= 3) return "High";
  if (daysLeft <= 7) return "Medium";
  return "Low";
}

export function getPriorityMeta(priority) {
  return PRIORITY_META[priority] || null;
}
