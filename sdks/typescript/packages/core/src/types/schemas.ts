import { z } from "zod";

/**
 * Zod schemas for T402 protocol types.
 * Used for runtime validation of incoming data.
 */

// Network format: "namespace:reference" (CAIP-2)
export const NetworkSchema = z.string().regex(/^[a-z0-9-]+:[a-zA-Z0-9-]+$/, {
  message: "Network must be in CAIP-2 format (e.g., 'eip155:1', 'solana:mainnet')",
});

// Resource info for V2 protocol
export const ResourceInfoSchema = z.object({
  url: z.string().url({ message: "Resource URL must be a valid URL" }),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

// Payment requirements (what the server needs)
export const PaymentRequirementsSchema = z.object({
  scheme: z.string().min(1, { message: "Scheme is required" }),
  network: NetworkSchema,
  asset: z.string().min(1, { message: "Asset address is required" }),
  amount: z.string().regex(/^\d+$/, { message: "Amount must be a non-negative integer string" }),
  payTo: z.string().min(1, { message: "PayTo address is required" }),
  maxTimeoutSeconds: z
    .number()
    .int()
    .positive({ message: "maxTimeoutSeconds must be a positive integer" }),
  extra: z.record(z.unknown()),
});

// Payment required response (402 response)
export const PaymentRequiredSchema = z.object({
  t402Version: z.literal(2, {
    errorMap: () => ({ message: "t402Version must be 2 for V2 protocol" }),
  }),
  error: z.string().optional(),
  resource: ResourceInfoSchema,
  accepts: z
    .array(PaymentRequirementsSchema)
    .min(1, { message: "At least one payment option is required" }),
  extensions: z.record(z.unknown()).optional(),
});

// Payment payload (client's signed payment)
export const PaymentPayloadSchema = z.object({
  t402Version: z.literal(2, {
    errorMap: () => ({ message: "t402Version must be 2 for V2 protocol" }),
  }),
  resource: ResourceInfoSchema.optional(),
  accepted: PaymentRequirementsSchema,
  payload: z.record(z.unknown()),
  extensions: z.record(z.unknown()).optional(),
});

// Verify response from facilitator
export const VerifyResponseSchema = z.object({
  isValid: z.boolean(),
  invalidReason: z.string().optional(),
  payer: z.string().optional(),
});

// Settle response from facilitator
export const SettleResponseSchema = z.object({
  success: z.boolean(),
  transaction: z.string(),
  network: NetworkSchema,
  errorReason: z.string().optional(),
  payer: z.string().optional(),
});

// V1 schemas for backward compatibility
export const PaymentRequirementsV1Schema = z.object({
  scheme: z.string().min(1),
  network: z.string().min(1),
  asset: z.string().min(1),
  amount: z.string().regex(/^\d+$/),
  payTo: z.string().min(1),
  maxTimeoutSeconds: z.number().int().positive(),
  extra: z.record(z.unknown()).optional(),
});

export const PaymentPayloadV1Schema = z.object({
  t402Version: z.literal(1).optional(),
  accepted: PaymentRequirementsV1Schema,
  payload: z.record(z.unknown()),
});

// Type inference helpers
export type ValidatedPaymentPayload = z.infer<typeof PaymentPayloadSchema>;
export type ValidatedPaymentRequired = z.infer<typeof PaymentRequiredSchema>;
export type ValidatedPaymentRequirements = z.infer<typeof PaymentRequirementsSchema>;
export type ValidatedVerifyResponse = z.infer<typeof VerifyResponseSchema>;
export type ValidatedSettleResponse = z.infer<typeof SettleResponseSchema>;

/**
 * Parse and validate a PaymentPayload.
 *
 * @param data - The data to parse
 * @returns The validated payment payload
 * @throws ZodError if validation fails
 */
export function parsePaymentPayload(data: unknown): ValidatedPaymentPayload {
  return PaymentPayloadSchema.parse(data);
}

/**
 * Parse and validate a PaymentRequired response.
 *
 * @param data - The data to parse
 * @returns The validated payment required response
 * @throws ZodError if validation fails
 */
export function parsePaymentRequired(data: unknown): ValidatedPaymentRequired {
  return PaymentRequiredSchema.parse(data);
}

/**
 * Parse and validate PaymentRequirements.
 *
 * @param data - The data to parse
 * @returns The validated payment requirements
 * @throws ZodError if validation fails
 */
export function parsePaymentRequirements(data: unknown): ValidatedPaymentRequirements {
  return PaymentRequirementsSchema.parse(data);
}

/**
 * Safely parse a PaymentPayload, returning a result object.
 *
 * @param data - The data to parse
 * @returns The safe parse result
 */
export function safeParsePaymentPayload(
  data: unknown,
): z.SafeParseReturnType<unknown, ValidatedPaymentPayload> {
  return PaymentPayloadSchema.safeParse(data);
}

/**
 * Safely parse a PaymentRequired response, returning a result object.
 *
 * @param data - The data to parse
 * @returns The safe parse result
 */
export function safeParsePaymentRequired(
  data: unknown,
): z.SafeParseReturnType<unknown, ValidatedPaymentRequired> {
  return PaymentRequiredSchema.safeParse(data);
}

/**
 * Safely parse PaymentRequirements, returning a result object.
 *
 * @param data - The data to parse
 * @returns The safe parse result
 */
export function safeParsePaymentRequirements(
  data: unknown,
): z.SafeParseReturnType<unknown, ValidatedPaymentRequirements> {
  return PaymentRequirementsSchema.safeParse(data);
}
