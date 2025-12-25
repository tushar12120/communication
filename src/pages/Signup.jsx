import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Mail, Lock, User, Phone } from 'lucide-react';

const Signup = () => {
    const { signUp } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        phone: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (formData.phone.length < 10) {
            setError('Please enter a valid phone number');
            return;
        }

        setLoading(true);

        try {
            // Check if phone already exists
            const { data: existingPhone, error: phoneCheckError } = await supabase
                .from('profiles')
                .select('id')
                .eq('phone', formData.phone)
                .maybeSingle();

            console.log('Phone check result:', existingPhone, phoneCheckError);

            if (existingPhone) {
                throw new Error('This phone number is already registered');
            }

            // Create auth user with metadata
            console.log('Creating auth user...');
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        phone: formData.phone
                    }
                }
            });

            console.log('Auth result:', authData, authError);

            if (authError) {
                throw authError;
            }

            if (authData?.user) {
                console.log('User created with ID:', authData.user.id);

                // Manually insert profile as backup (in case trigger doesn't work)
                const profileData = {
                    id: authData.user.id,
                    email: formData.email,
                    full_name: formData.fullName,
                    phone: formData.phone,
                    about: 'Hey there! I am using ChatVerse.',
                    updated_at: new Date().toISOString()
                };

                console.log('Inserting profile:', profileData);

                const { data: insertedProfile, error: profileError } = await supabase
                    .from('profiles')
                    .upsert(profileData, { onConflict: 'id' })
                    .select();

                console.log('Profile insert result:', insertedProfile, profileError);

                if (profileError) {
                    console.error('Profile Error Details:', profileError);
                    // Don't throw - trigger might have already created it
                }
            } else {
                throw new Error('User creation failed - no user data returned');
            }

            // Redirect to login
            alert('Account created successfully! Please login.');
            navigate('/login');
        } catch (err) {
            console.error('Signup error:', err);
            setError(err.message || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px',
            backgroundColor: 'var(--startup-background)',
            color: 'var(--inverse)'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '35px 40px',
                borderRadius: '16px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                width: '100%',
                maxWidth: '420px'
            }}>
                {/* Logo */}
                <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 15px auto'
                }}>
                    <MessageSquare size={30} color="white" />
                </div>

                <h2 style={{ textAlign: 'center', color: 'var(--primary-strong)', marginBottom: '8px' }}>Create Account</h2>
                <p style={{ textAlign: 'center', color: 'var(--secondary)', marginBottom: '25px', fontSize: '14px' }}>
                    Join ChatVerse today
                </p>

                {error && (
                    <div style={{
                        backgroundColor: '#ffebee',
                        color: '#c62828',
                        padding: '10px 15px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Full Name */}
                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px' }}>
                            <User size={20} color="var(--secondary)" style={{ marginRight: '12px' }} />
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="Full Name"
                                required
                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '15px', color: '#333' }}
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px' }}>
                            <Phone size={20} color="var(--secondary)" style={{ marginRight: '12px' }} />
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="Phone Number (e.g. 9876543210)"
                                required
                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '15px', color: '#333' }}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px' }}>
                            <Mail size={20} color="var(--secondary)" style={{ marginRight: '12px' }} />
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Email Address"
                                required
                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '15px', color: '#333' }}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px' }}>
                            <Lock size={20} color="var(--secondary)" style={{ marginRight: '12px' }} />
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Password (min 6 characters)"
                                required
                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '15px', color: '#333' }}
                            />
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div style={{ marginBottom: '25px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px' }}>
                            <Lock size={20} color="var(--secondary)" style={{ marginRight: '12px' }} />
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Confirm Password"
                                required
                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '15px', color: '#333' }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '24px',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--secondary)', fontSize: '14px' }}>
                    Already have an account?{' '}
                    <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                        Sign In
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;
