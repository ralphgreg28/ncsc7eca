import { z } from 'zod';

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters');

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  username: z.string()
    .min(4, 'Username must be at least 4 characters')
    .max(20, 'Username cannot exceed 20 characters')
    .regex(/^[a-zA-Z0-9]+$/, 'Username can only contain letters and numbers'),
  password: passwordSchema,
  confirmPassword: passwordSchema,
  email: z.string().email('Invalid email format'),
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