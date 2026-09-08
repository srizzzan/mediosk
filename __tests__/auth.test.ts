import { NextApiRequest, NextApiResponse } from 'next'
import { createRequest, createResponse } from 'node-mocks-http'

// test unauthenticated access to patient profile
describe('Authentication & RBAC', ()=>{
  test('unauthenticated patient profile returns 401', async ()=>{
    // mock getSession to return null
    jest.resetModules()
    jest.mock('next-auth/react', () => ({ getSession: jest.fn().mockResolvedValue(null) }))
    const {default: handler} = await import('../src/pages/api/patient/profile')
    const req = createRequest({ method: 'GET' }) as unknown as NextApiRequest
    const res = createResponse()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(401)
  })
})
