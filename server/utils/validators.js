import { z } from 'zod';
import { normalizeEmail, normalizeMobile } from './helpers.js';

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(120);

export const mobileSchema = z
  .string({ required_error: 'Mobile number is required' })
  .transform(normalizeMobile)
  .refine((v) => /^\+?\d{10,15}$/.test(v), 'Enter a valid mobile number (10–15 digits)');

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain at least one letter and one number');

export const nameSchema = z.string({ required_error: 'Full name is required' }).trim().min(2, 'Full name is too short').max(80);

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const signupSchema = z
  .object({
    fullName: nameSchema,
    email: emailSchema,
    mobile: mobileSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: 'Confirm your password' }),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
  portal: z.enum(['customer', 'admin', 'cashier']).optional(),
});

export const forgotSchema = z.object({ email: emailSchema });
export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP'),
  purpose: z.enum(['password_reset', 'email_change']).optional(),
});
export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const profileUpdateSchema = z.object({
  fullName: nameSchema.optional(),
  mobile: mobileSchema.optional(),
  address: z.object({ line1: z.string().trim().max(200).optional(), city: z.string().trim().max(60).optional() }).optional(),
});

export const cartAddSchema = z.object({
  productId: objectId,
  variationId: objectId,
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});
export const cartPatchSchema = z.object({ quantity: z.coerce.number().int().min(1).max(99) });
export const cartPriceSchema = z.object({
  items: z.array(z.object({ productId: objectId, variationId: objectId, quantity: z.coerce.number().int().min(1).max(99) })).max(50),
  deliveryMethod: z.enum(['home', 'pickup']).optional(),
});

export const checkoutSchema = z.object({
  deliveryMethod: z.enum(['home', 'pickup']),
  paymentMethod: z.enum(['cod', 'online']),
  delivery: z.object({
    fullName: nameSchema,
    mobile: mobileSchema,
    email: emailSchema,
    city: z.string().trim().max(60).optional().default(''),
    address: z.string().trim().max(300).optional().default(''),
    instructions: z.string().trim().max(300).optional().default(''),
  }),
  idempotencyKey: z.string().min(8).max(100),
  simulateOutcome: z.enum(['success', 'failure']).optional(),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required').max(120),
  description: z.string().trim().max(2000).optional().default(''),
  category: z.enum(['women', 'men', 'kids']),
  price: z.coerce.number().min(0, 'Price must be positive'),
  salePrice: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().min(0).nullable()).optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  images: z.array(z.string()).max(5).optional(),
  variations: z
    .array(
      z.object({
        _id: z.string().optional(),
        size: z.string().trim().min(1, 'Size is required').max(20),
        color: z.string().trim().min(1, 'Color is required').max(30),
        colorHex: z.string().trim().max(9).optional().default(''),
        barcode: z.string().trim().max(40).optional().default(''),
        stockQuantity: z.coerce.number().int().min(0, 'Stock cannot be negative'),
        sku: z.string().trim().max(40).optional().default(''),
      })
    )
    .min(1, 'Add at least one variation'),
});

export const orderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'ready_for_pickup', 'shipped', 'delivered', 'cancelled']),
  note: z.string().trim().max(300).optional(),
});

export const cashierCreateSchema = z
  .object({
    fullName: nameSchema,
    email: emailSchema,
    mobile: mobileSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
export const cashierUpdateSchema = z.object({
  fullName: nameSchema.optional(),
  email: emailSchema.optional(),
  mobile: mobileSchema.optional(),
});
export const cashierStatusSchema = z.object({ accountStatus: z.enum(['active', 'inactive']) });

export const posSaleSchema = z.object({
  items: z.array(z.object({ productId: objectId, variationId: objectId, quantity: z.coerce.number().int().min(1).max(99) })).min(1, 'Cart is empty'),
  customer: z
    .object({
      userId: objectId.optional(),
      fullName: z.string().trim().max(80).optional().default(''),
      mobile: z.string().trim().optional().default(''),
      email: z.string().trim().optional().default(''),
    })
    .optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional().default(0),
  paymentMethod: z.enum(['cash', 'card', 'wallet']),
  amountReceived: z.coerce.number().min(0).optional(),
  simulateOutcome: z.enum(['success', 'failure']).optional(),
  emailReceipt: z.boolean().optional().default(false),
  idempotencyKey: z.string().min(8).max(100),
});

export const returnSchema = z.object({
  orderId: objectId,
  items: z.array(z.object({ orderItemId: objectId, quantity: z.coerce.number().int().min(1), resellable: z.boolean() })).min(1, 'Select at least one item'),
  reason: z.enum(['wrong_size', 'defective', 'wrong_product', 'other']),
  reasonNote: z.string().trim().max(300).optional().default(''),
  refundMethod: z.enum(['cash', 'card', 'wallet']),
  idempotencyKey: z.string().min(8).max(100),
});

export const exchangeSchema = z.object({
  orderId: objectId,
  items: z.array(z.object({ orderItemId: objectId, quantity: z.coerce.number().int().min(1), resellable: z.boolean() })).min(1),
  replacements: z.array(z.object({ productId: objectId, variationId: objectId, quantity: z.coerce.number().int().min(1).max(99) })).min(1, 'Select a replacement'),
  reason: z.enum(['wrong_size', 'defective', 'wrong_product', 'other']),
  reasonNote: z.string().trim().max(300).optional().default(''),
  settlementMethod: z.enum(['cash', 'card', 'wallet']),
  simulateOutcome: z.enum(['success', 'failure']).optional(),
  idempotencyKey: z.string().min(8).max(100),
});

export { normalizeEmail };
