import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const SignIn = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const resp = await api.signin({ email: formData.email, password: formData.password });
      // store token then redirect to intended page or home
      if (resp?.token) localStorage.setItem('auth_token', resp.token);
      if (resp?.user?.isAdmin) {
        localStorage.setItem('auth_is_admin', 'true');
      } else {
        try { localStorage.removeItem('auth_is_admin'); } catch {}
      }
      const redirectTo = location.state?.from?.pathname || '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-gray-100 to-gray-200">
      <div className="flex h-screen">
        {/* Left Side - Logo */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 items-center justify-center">
          <div className="text-center">
            <Link to="/" className="inline-block mb-8">
              <h1 className="text-5xl font-serif font-bold text-black">
                Crumblecut
              </h1>
            </Link>
            <p className="text-lg text-gray-600 max-w-sm mx-auto leading-relaxed">
              Discover premium Fashion crafted for comfort and style.
            </p>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center py-8 px-4">
          <div className="w-full max-w-sm">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-6">
              <Link to="/" className="inline-block mb-6">
                <h1 className="text-2xl font-serif font-bold text-black">
                  Crumblecut
                </h1>
              </Link>
            </div>

            {/* Form Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-serif font-semibold text-neutral-800 mb-1">
                Welcome Back
              </h2>
              <p className="text-gray-600">
                Sign in to your account to continue shopping
              </p>
            </div>

            {/* Sign In Form */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-neutral-100">
              {error && (<div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>)}
              {success && (<div className="mb-4 text-sm text-green-600 bg-green-50 p-3 rounded-lg">{success}</div>)}

              {/* Email/Password Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                    placeholder="Enter your password"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-rose-500 focus:ring-rose-400 border-neutral-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-600">Remember me</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-rose-500 hover:text-rose-600 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white py-2 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              {/* Sign Up Link */}
              <div className="mt-8 text-center">
                <p className="text-gray-600">
                  Don't have an account?{' '}
                  <Link
                    to="/signup"
                    className="text-rose-500 hover:text-rose-600 font-semibold transition-colors"
                  >
                    Sign up here
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;