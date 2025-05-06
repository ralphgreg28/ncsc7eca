import { z } from 'zod';

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters');

export const broadcastMessageSchema = z.object({
  message: z.string().min(1, 'Message content is required'),
  is_active: z.boolean().optional().default(true),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required')
}).refine(data => {
  const start = new Date(data.start_date);
  const end = new Date(data.end_date);
  return end > start;
}, {
  message: 'End date must be after start date',
  path: ['end_date']
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  username: z.string()
    .min(4, 'Username must be at least 4 characters')
    .max(20, 'Username cannot exceed 20 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'Username can only contain letters and numbers (no spaces allowed)'),
  password: passwordSchema,
  confirmPassword: passwordSchema,
  email: z.string().email('Invalid email format'),
  position: z.enum(['Administrator', 'PDO', 'LGU', 'NCSC Admin'], {
    errorMap: () => ({ message: 'Position is required' }),
  }),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional(),
  extensionName: z.string().optional(),
  birthDate: z.string().min(1, 'Birth date is required'),
  sex: z.enum(['Male', 'Female'], {
    errorMap: () => ({ message: 'Sex is required' }),
  })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type BroadcastMessageInput = z.infer<typeof broadcastMessageSchema>;
