type DurationField = {
  suffix: string;
  accessor: (duration: number) => number;
};

const times: DurationField[] = [
  {
    suffix: "d",
    accessor: (duration) => Math.floor(duration / (24 * 3600 * 1000)),
  },
  {
    suffix: "h",
    accessor: (duration) => Math.floor(duration / (3600 * 1000)) % 24,
  },
  {
    suffix: "m",
    accessor: (duration) => Math.floor(duration / (60 * 1000)) % 60,
  },
  {
    suffix: "s",
    accessor: (duration) => Math.floor(duration / 1000) % 60,
  },
  {
    suffix: "ms",
    accessor: (duration) => Math.round(duration) % 1000,
  },
];

export const formatDuration = (duration?: number): string => {
  if (duration === undefined) {
    return "unknown";
  }

  if (duration < 0.5) {
    return "0s";
  }

  const res: string[] = [];

  for (const { accessor, suffix } of times) {
    const value = accessor(duration);
    if (res.length === 0 && !value) {
      continue;
    }
    res.push(value + suffix);
    if (res.length > 1) {
      break;
    }
  }

  return res.join(" ");
};
