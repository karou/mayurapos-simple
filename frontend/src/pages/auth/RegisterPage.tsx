import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);

  // Validation schema using Yup
  const validationSchema = Yup.object({
    username: Yup.string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be at most 30 characters')
      .required('Username is required'),
    email: Yup.string()
      .email('Invalid email address')
      .required('Email is required'),
    password: Yup.string()
      .min(8, 'Password must be at least 8 characters')
      .required('Password is required'),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('password')], 'Passwords must match')
      .required('Confirm password is required'),
  });

  // Initialize formik
  const formik = useFormik({
    initialValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validationSchema,
    onSubmit: async (values) => {
      setIsRegistering(true);
      try {
        await register(values);
        showToast('Registration successful', 'success');
        navigate('/dashboard', { replace: true });
      } catch (error: any) {
        showToast(error.message || 'Registration failed', 'error');
      } finally {
        setIsRegistering(false);
      }
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="p-6 sm:p-8">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
                <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h2 className="mt-4 text-3xl font-extrabold text-secondary-900">MayuraPOS</h2>
              <p className="mt-2 text-sm text-secondary-600">Create a new account</p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={formik.handleSubmit}>
              <div>
                <label htmlFor="username" className="form-label">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  className={`form-input ${
                    formik.touched.username && formik.errors.username ? 'border-danger-300' : ''
                  }`}
                  value={formik.values.username}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.username && formik.errors.username && (
                  <p className="form-error">{formik.errors.username}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="form-label">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className={`form-input ${
                    formik.touched.email && formik.errors.email ? 'border-danger-300' : ''
                  }`}
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.email && formik.errors.email && (
                  <p className="form-error">{formik.errors.email}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="form-label">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  className={`form-input ${
                    formik.touched.password && formik.errors.password ? 'border-danger-300' : ''
                  }`}
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.password && formik.errors.password && (
                  <p className="form-error">{formik.errors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={`form-input ${
                    formik.touched.confirmPassword && formik.errors.confirmPassword ? 'border-danger-300' : ''
                  }`}
                  value={formik.values.confirmPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                  <p className="form-error">{formik.errors.confirmPassword}</p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  className="btn-primary w-full py-2 text-base"
                  disabled={isRegistering}
                >
                  {isRegistering ? (
                    <div className="flex items-center justify-center">
                      <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-800"></div>
                      <span>Creating account...</span>
                    </div>
                  ) : (
                    'Register'
                  )}
                </button>
              </div>

              <div className="text-center text-sm">
                <span className="text-secondary-600">Already have an account? </span>
                <Link to="/login" className="text-primary-600 hover:text-primary-500">
                  Sign in
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;