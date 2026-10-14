import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
});

export const registerSchema = loginSchema.extend({
  password: z.string().min(8).max(200),
  password_confirm: z.string().min(8).max(200).optional(),
}).superRefine((value, ctx) => {
  if (value.password_confirm !== undefined && value.password !== value.password_confirm) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password_confirm'], message: 'Mật khẩu nhập lại không khớp' });
});

export const forgotPasswordSchema = z.object({ email: z.string().trim().email().max(254) });
export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().min(8).max(200),
  password_confirm: z.string().min(8).max(200),
}).superRefine((value, ctx) => {
  if (value.password !== value.password_confirm) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password_confirm'], message: 'Mật khẩu nhập lại không khớp' });
});

export const orderSchema = z.object({
  package_id: z.string().min(1).max(100),
  idempotency_key: z.string().trim().min(8).max(120).optional(),
  payment_method: z.enum(['wallet', 'direct']).default('direct'),
  target: z.object({ uid: z.string().trim().max(120).optional(), login: z.string().trim().max(120).optional() }).default({}),
}).superRefine((value, ctx) => {
  if (!value.target.uid && !value.target.login) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['target'], message: 'Vui lòng nhập UID hoặc tài khoản game' });
});

export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) { const error = new Error('Dữ liệu đầu vào không hợp lệ'); error.statusCode = 400; error.details = result.error.flatten(); throw error; }
  return result.data;
}
