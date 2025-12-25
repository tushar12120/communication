
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Check } from 'lucide-react';

const SetupProfile = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [phone, setPhone] = useState('');
    const [about, setAbout] = useState('Hey there! I am using ChatVerse.');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (phone.length < 10) {
            setError("Please enter a valid phone number.");
            setLoading(false);
            return;
        }

        try {
            // Check if phone already exists
            const { data: existingUser } = await supabase
                .from('profiles')
                .select('id')
                .eq('phone', phone)
                .neq('id', user.id) // Exclude self
                .single();

            if (existingUser) {
                throw new Error("Phone number already linked to another account.");
            }

            // Upsert Profile (Handle both update and create)
            const updates = {
                id: user.id,
                phone: phone,
                about: about,
                updated_at: new Date(),
                email: user.email,
                full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
                avatar_url: user.user_metadata?.avatar_url
            };

            const { error: updateError } = await supabase
                .from('profiles')
                .upsert(updates);

            if (updateError) throw updateError;

            // Redirect to home
            window.location.href = '/';
        } catch (err) {
            setError(err.message);
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
            height: '100vh',
            backgroundColor: 'var(--startup-background)',
            color: 'var(--inverse)'
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '40px',
                borderRadius: '16px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '450px'
            }}>
                <h2 style={{ color: 'var(--primary-strong)', textAlign: 'center', marginBottom: '10px' }}>Profile Setup</h2>
                <p style={{ textAlign: 'center', color: 'var(--secondary)', marginBottom: '30px' }}>
                    Complete your profile to connect with friends.
                </p>

                {error && <div style={{ color: 'red', marginBottom: '15px', textAlign: 'center', fontSize: '14px' }}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--primary-strong)', fontSize: '14px', fontWeight: 500 }}>
                            Phone Number
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '10px' }}>
                            <Phone size={20} color="var(--secondary)" style={{ marginRight: '10px' }} />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="e.g. 9876543210"
                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '16px' }}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '30px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--primary-strong)', fontSize: '14px', fontWeight: 500 }}>
                            About
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '10px' }}>
                            <User size={20} color="var(--secondary)" style={{ marginRight: '10px' }} />
                            <input
                                type="text"
                                value={about}
                                onChange={(e) => setAbout(e.target.value)}
                                placeholder="Hey there! I am using ChatVerse."
                                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '16px' }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            backgroundColor: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '24px',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px'
                        }}
                    >
                        {loading ? 'Saving...' : <>Save & Continue <Check size={20} /></>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SetupProfile;
