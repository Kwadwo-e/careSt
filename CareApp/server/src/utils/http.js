export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const required = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new HttpError(400, `${label} is required.`);
  }
  return String(value).trim();
};

export const normalizeStatus = (value) => {
  if (!['pending', 'accepted', 'rejected'].includes(value)) {
    throw new HttpError(400, 'Status must be pending, accepted, or rejected.');
  }
  return value;
};

export const normalizeDecision = (value) => {
  if (!['accepted', 'rejected'].includes(value)) {
    throw new HttpError(400, 'Decision must be accepted or rejected.');
  }
  return value;
};
