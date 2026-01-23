import { z } from 'zod';

// Signup form validation schema
export const signupSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Ad gerekli')
    .max(50, 'Ad en fazla 50 karakter olabilir')
    .regex(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s\-']+$/, 'Ad sadece harf içerebilir'),
  lastName: z
    .string()
    .min(1, 'Soyad gerekli')
    .max(50, 'Soyad en fazla 50 karakter olabilir')
    .regex(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s\-']+$/, 'Soyad sadece harf içerebilir'),
  email: z
    .string()
    .min(1, 'E-posta gerekli')
    .email('Geçerli bir e-posta adresi girin')
    .max(255, 'E-posta en fazla 255 karakter olabilir'),
  phone: z
    .string()
    .max(20, 'Telefon numarası en fazla 20 karakter olabilir')
    .regex(/^[\+]?[0-9\s\-\(\)]*$/, 'Geçerli bir telefon numarası girin')
    .optional()
    .or(z.literal('')),
  company: z
    .string()
    .max(100, 'Şirket adı en fazla 100 karakter olabilir')
    .optional()
    .or(z.literal('')),
  password: z
    .string()
    .min(8, 'Şifre en az 8 karakter olmalı')
    .max(72, 'Şifre en fazla 72 karakter olabilir')
    .regex(/[a-z]/, 'Şifre en az bir küçük harf içermeli')
    .regex(/[A-Z]/, 'Şifre en az bir büyük harf içermeli')
    .regex(/[0-9]/, 'Şifre en az bir rakam içermeli'),
});

// Login form validation schema
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'E-posta gerekli')
    .email('Geçerli bir e-posta adresi girin')
    .max(255, 'E-posta en fazla 255 karakter olabilir'),
  password: z
    .string()
    .min(1, 'Şifre gerekli')
    .max(72, 'Şifre en fazla 72 karakter olabilir'),
});

// Profile update validation schema
export const profileUpdateSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Ad gerekli')
    .max(50, 'Ad en fazla 50 karakter olabilir')
    .regex(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s\-']+$/, 'Ad sadece harf içerebilir'),
  lastName: z
    .string()
    .min(1, 'Soyad gerekli')
    .max(50, 'Soyad en fazla 50 karakter olabilir')
    .regex(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s\-']+$/, 'Soyad sadece harf içerebilir'),
  phone: z
    .string()
    .max(20, 'Telefon numarası en fazla 20 karakter olabilir')
    .regex(/^[\+]?[0-9\s\-\(\)]*$/, 'Geçerli bir telefon numarası girin')
    .optional()
    .or(z.literal('')),
  company: z
    .string()
    .max(100, 'Şirket adı en fazla 100 karakter olabilir')
    .optional()
    .or(z.literal('')),
});

export type SignupFormData = z.infer<typeof signupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
