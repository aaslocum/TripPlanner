import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mocks
const mockGet = vi.fn();
const mockGetDb = vi.fn();

vi.mock('../../db/connection.js', () => ({
  getDb: (...args) => mockGetDb(...args),
  get: (...args) => mockGet(...args),
}));

vi.mock('../../config/env.js', () => ({
  default: {
    authBypass: false,
    jwtSecret: 'test-jwt-secret',
  },
}));

const { authMiddleware, adminMiddleware, selfOnlyMiddleware, tripMemberMiddleware } = await import('../auth.js');

function makeMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

describe('authMiddleware', () => {
  const fakeDb = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue(fakeDb);
  });

  it('authenticates a valid JWT and attaches user to req', async () => {
    const user = { user_id: 1, first_name: 'Alex', role: 'admin' };
    const token = jwt.sign({ sub: 1 }, 'test-jwt-secret');
    mockGet.mockReturnValue(user);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(user);
  });

  it('returns 401 when no Authorization header', async () => {
    const req = { headers: {} };
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for malformed Authorization header', async () => {
    const req = { headers: { authorization: 'NotBearer token' } };
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid JWT', async () => {
    const req = { headers: { authorization: 'Bearer invalid.token.here' } };
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.message).toBe('Invalid token');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for expired JWT', async () => {
    const token = jwt.sign({ sub: 1, exp: Math.floor(Date.now() / 1000) - 60 }, 'test-jwt-secret');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user not found in DB', async () => {
    const token = jwt.sign({ sub: 999 }, 'test-jwt-secret');
    mockGet.mockReturnValue(null);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeMockRes();
    const next = vi.fn();

    await authMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error.message).toBe('User not found');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('adminMiddleware', () => {
  it('passes for admin users', () => {
    const req = { user: { role: 'admin' } };
    const res = makeMockRes();
    const next = vi.fn();

    adminMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for non-admin users', () => {
    const req = { user: { role: 'user' } };
    const res = makeMockRes();
    const next = vi.fn();

    adminMiddleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.error.message).toBe('Admin access required');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when no user on req', () => {
    const req = {};
    const res = makeMockRes();
    const next = vi.fn();

    adminMiddleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('selfOnlyMiddleware', () => {
  it('passes when user matches param id', () => {
    const req = { user: { user_id: 5 }, params: { id: '5' } };
    const res = makeMockRes();
    const next = vi.fn();

    selfOnlyMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when user does not match param id', () => {
    const req = { user: { user_id: 5 }, params: { id: '6' } };
    const res = makeMockRes();
    const next = vi.fn();

    selfOnlyMiddleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('tripMemberMiddleware', () => {
  const fakeDb = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue(fakeDb);
  });

  it('returns 400 when tripId is missing', async () => {
    const middleware = tripMemberMiddleware();
    const req = { body: {}, user: { user_id: 1, role: 'user' } };
    const res = makeMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('bypasses membership check for admin users', async () => {
    const middleware = tripMemberMiddleware();
    const req = { body: { tripId: 1 }, user: { user_id: 1, role: 'admin' } };
    const res = makeMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockGet).not.toHaveBeenCalled(); // no DB lookup needed
  });

  it('passes when user is a trip member', async () => {
    mockGet.mockReturnValue({ 1: 1 });
    const middleware = tripMemberMiddleware();
    const req = { body: { tripId: 1 }, user: { user_id: 2, role: 'user' } };
    const res = makeMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when user is not a trip member', async () => {
    mockGet.mockReturnValue(null);
    const middleware = tripMemberMiddleware();
    const req = { body: { tripId: 1 }, user: { user_id: 2, role: 'user' } };
    const res = makeMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.error.message).toBe('Not a member of this trip');
    expect(next).not.toHaveBeenCalled();
  });

  it('uses custom getTripId function', async () => {
    mockGet.mockReturnValue({ 1: 1 });
    const middleware = tripMemberMiddleware(req => req.params.tripId);
    const req = { params: { tripId: 42 }, body: {}, user: { user_id: 2, role: 'user' } };
    const res = makeMockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    // Verify the DB was queried with tripId 42
    expect(mockGet).toHaveBeenCalledWith(fakeDb, expect.any(String), [42, 2]);
  });
});
