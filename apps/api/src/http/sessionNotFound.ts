const NOT_FOUND = 404;

// One body for an unknown id and another driver's session, on every route that takes a session id: neither can be told apart.
export const SESSION_NOT_FOUND_BODY = { statusCode: NOT_FOUND, error: 'SESSION_NOT_FOUND', message: 'No such entry.' } as const;
