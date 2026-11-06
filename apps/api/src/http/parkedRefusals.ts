const CONFLICT = 409;
const SERVICE_UNAVAILABLE = 503;

// The same bodies on the walk and on the answer: the app reads both the same way.
export const SESSION_CLOSED_BODY = { statusCode: CONFLICT, error: 'SESSION_CLOSED', message: 'This session is closed.' } as const;
export const LOT_BUSY_BODY = { statusCode: SERVICE_UNAVAILABLE, error: 'LOT_BUSY', message: 'The parking lot is busy; try again.' } as const;
