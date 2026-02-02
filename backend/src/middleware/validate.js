const { z } = require('zod');

/**
 * Reusable validation middleware factory
 * Creates middleware that validates request body against a Zod schema
 *
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        errors,
      });
    }

    // Replace req.body with parsed/transformed data
    req.body = result.data;
    next();
  };
}

// ============================================
// AUTH SCHEMAS
// ============================================

const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .max(255, 'Email must be at most 255 characters')
    .transform((val) => val.toLowerCase().trim()),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email format')
    .max(255, 'Email must be at most 255 characters')
    .transform((val) => val.toLowerCase().trim()),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters')
    .max(128, 'Password must be at most 128 characters'),
  firstName: z
    .string({ required_error: 'First name is required' })
    .min(1, 'First name is required')
    .max(100, 'First name must be at most 100 characters')
    .transform((val) => val.trim()),
  lastName: z
    .string({ required_error: 'Last name is required' })
    .min(1, 'Last name is required')
    .max(100, 'Last name must be at most 100 characters')
    .transform((val) => val.trim()),
  department: z
    .string()
    .max(100, 'Department must be at most 100 characters')
    .optional()
    .transform((val) => val?.trim()),
  jobTitle: z
    .string()
    .max(100, 'Job title must be at most 100 characters')
    .optional()
    .transform((val) => val?.trim()),
});

// ============================================
// PERSONALIZATION SCHEMAS
// ============================================

const checkinSchema = z.object({
  overallFeeling: z
    .number({ required_error: 'Overall feeling is required' })
    .int('Overall feeling must be an integer')
    .min(1, 'Overall feeling must be at least 1')
    .max(5, 'Overall feeling must be at most 5'),
  energyLevel: z
    .number()
    .int('Energy level must be an integer')
    .min(1, 'Energy level must be at least 1')
    .max(5, 'Energy level must be at most 5')
    .optional()
    .nullable(),
  stressLevel: z
    .number()
    .int('Stress level must be an integer')
    .min(1, 'Stress level must be at least 1')
    .max(5, 'Stress level must be at most 5')
    .optional()
    .nullable(),
  motivationLevel: z
    .number()
    .int('Motivation level must be an integer')
    .min(1, 'Motivation level must be at least 1')
    .max(5, 'Motivation level must be at most 5')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(1000, 'Notes must be at most 1000 characters')
    .optional()
    .nullable()
    .transform((val) => val?.trim() || null),
});

const preferencesSchema = z.object({
  idealSleepHours: z
    .number()
    .min(4, 'Ideal sleep hours must be at least 4')
    .max(12, 'Ideal sleep hours must be at most 12')
    .optional()
    .nullable(),
  sleepFlexibility: z
    .enum(['rigid', 'moderate', 'flexible'], {
      errorMap: () => ({ message: 'Sleep flexibility must be rigid, moderate, or flexible' }),
    })
    .optional()
    .nullable(),
  chronotype: z
    .enum(['early_bird', 'neutral', 'night_owl'], {
      errorMap: () => ({ message: 'Chronotype must be early_bird, neutral, or night_owl' }),
    })
    .optional()
    .nullable(),
  idealWorkHours: z
    .number()
    .min(4, 'Ideal work hours must be at least 4')
    .max(16, 'Ideal work hours must be at most 16')
    .optional()
    .nullable(),
  preferredWorkPattern: z
    .enum(['steady', 'burst', 'flexible'], {
      errorMap: () => ({ message: 'Preferred work pattern must be steady, burst, or flexible' }),
    })
    .optional()
    .nullable(),
  maxMeetingHoursDaily: z
    .number()
    .min(0, 'Max meeting hours must be at least 0')
    .max(12, 'Max meeting hours must be at most 12')
    .optional()
    .nullable(),
  socialEnergyType: z
    .enum(['introvert', 'ambivert', 'extrovert'], {
      errorMap: () => ({ message: 'Social energy type must be introvert, ambivert, or extrovert' }),
    })
    .optional()
    .nullable(),
  idealExerciseMinutes: z
    .number()
    .int('Ideal exercise minutes must be an integer')
    .min(0, 'Ideal exercise minutes must be at least 0')
    .max(300, 'Ideal exercise minutes must be at most 300')
    .optional()
    .nullable(),
  exerciseImportance: z
    .enum(['low', 'moderate', 'high'], {
      errorMap: () => ({ message: 'Exercise importance must be low, moderate, or high' }),
    })
    .optional()
    .nullable(),
  weightSleep: z
    .number()
    .int('Weight must be an integer')
    .min(0, 'Weight must be at least 0')
    .max(100, 'Weight must be at most 100')
    .optional()
    .nullable(),
  weightExercise: z
    .number()
    .int('Weight must be an integer')
    .min(0, 'Weight must be at least 0')
    .max(100, 'Weight must be at most 100')
    .optional()
    .nullable(),
  weightWorkload: z
    .number()
    .int('Weight must be an integer')
    .min(0, 'Weight must be at least 0')
    .max(100, 'Weight must be at most 100')
    .optional()
    .nullable(),
  weightMeetings: z
    .number()
    .int('Weight must be an integer')
    .min(0, 'Weight must be at least 0')
    .max(100, 'Weight must be at most 100')
    .optional()
    .nullable(),
  weightHeartMetrics: z
    .number()
    .int('Weight must be an integer')
    .min(0, 'Weight must be at least 0')
    .max(100, 'Weight must be at most 100')
    .optional()
    .nullable(),
  setupCompleted: z.boolean().optional().nullable(),
});

module.exports = {
  validate,
  loginSchema,
  registerSchema,
  checkinSchema,
  preferencesSchema,
};
