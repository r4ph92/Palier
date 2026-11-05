import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { idPathParametersSchema } from '../../src/http/schemas/uuidSchema.ts';

const UUID = '0b7e4c1a-9d2f-4a63-8e15-3c5f6a7b8d90';

async function statusOf(id: string): Promise<number> {
  const server = Fastify({ ajv: { customOptions: { coerceTypes: false } } });
  server.get('/:id', { schema: { params: idPathParametersSchema } }, () => 'ok');
  const response = await server.inject({ method: 'GET', url: `/${encodeURIComponent(id)}` });
  await server.close();
  return response.statusCode;
}

describe('idPathParametersSchema', () => {
  it.each([
    ['lower case', UUID],
    ['upper case', UUID.toUpperCase()],
  ])('accepts a canonical uuid in %s', async (_case, id) => {
    expect(await statusOf(id)).toBe(200);
  });

  it.each([
    ['a urn:uuid: prefix', `urn:uuid:${UUID}`],
    ['a trailing character', `${UUID}x`],
    ['a leading character', `x${UUID}`],
    ['braces', `{${UUID}}`],
    ['an overlong id', `${UUID}${UUID}`],
    ['no dashes', UUID.replaceAll('-', '')],
    ['a newline at the end', `${UUID}\n`],
  ])('refuses %s with 400', async (_case, id) => {
    expect(await statusOf(id)).toBe(400);
  });
});
