import type { ReceiptDetailResponse, ReceiptListResponse } from '@palier/shared-types';
import type { FastifyInstance } from 'fastify';
import type { DriverAccess } from '../../domain/drivers/driverSessions.ts';
import type { ReceiptRepository } from '../../domain/receipts/ReceiptRepository.ts';
import { receiptDetailOf, receiptSummaryOf } from '../../domain/receipts/receiptViews.ts';
import { consentedDriverGuards } from '../requireConsent.ts';
import { signedInDriver } from '../requireDriver.ts';
import { SESSION_NOT_FOUND_BODY } from '../sessionNotFound.ts';
import { entrySessionParametersSchema, type EntrySessionParameters } from '../schemas/entrySchemas.ts';
import { receiptDetailResponseSchema, receiptListResponseSchema } from '../schemas/receiptSchemas.ts';

// The driver's past receipts: only their own, and the id of someone else's answers like an unknown one.
export function registerReceiptRoutes(server: FastifyInstance, driverAccess: DriverAccess, receipts: ReceiptRepository): void {
  const onRequest = consentedDriverGuards(driverAccess);
  server.get('/v1/me/receipts', { onRequest, schema: { response: { 200: receiptListResponseSchema } } }, async (request): Promise<ReceiptListResponse> => {
    const sessions = await receipts.listPaidSessions(signedInDriver(request).id);
    return { receipts: sessions.map(receiptSummaryOf) };
  });
  server.get<{ Params: EntrySessionParameters }>(
    '/v1/me/receipts/:sessionId',
    { onRequest, schema: { params: entrySessionParametersSchema, response: { 200: receiptDetailResponseSchema } } },
    async (request, reply): Promise<ReceiptDetailResponse | typeof reply> => {
      const session = await receipts.findPaidSession(request.params.sessionId, signedInDriver(request).id);
      return session === null ? reply.status(404).send(SESSION_NOT_FOUND_BODY) : { receipt: receiptDetailOf(session) };
    },
  );
}
