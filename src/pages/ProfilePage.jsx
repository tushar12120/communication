import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { ArrowLeft, Camera, Check, User, Phone, Info } from 'lucide-react';

const ProfilePage = ({ onClose }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({
        full_name: '',
        phone: '',
        about: '',
        avatar_url: ''
    });
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (data) {
            setProfile({
                full_name: data.full_name || '',
                phone: data.phone || '',
                about: data.about || '',
                avatar_url: data.avatar_url || ''
            });
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: profile.full_name,
                about: profile.about,
                updated_at: new Date()
            })
            .eq('id', user.id);

        if (error) {
            setMessage('Error saving profile');
        } else {
            setMessage('Profile updated!');
            setTimeout(() => onClose(), 1000);
        }
        setSaving(false);
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            setMessage('Failed to upload image');
            return;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        // Update profile
        await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
        setMessage('Avatar updated!');
    };

    if (loading) {
        return (
            <div style={{
                width: '380px',
                height: '100vh',
                backgroundColor: 'var(--panel-background)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--secondary)'
            }}>
                Loading...
            </div>
        );
    }

    return (
        <div style={{
            width: '380px',
            height: '100vh',
            backgroundColor: 'var(--panel-background)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{
                height: '108px',
                backgroundColor: 'var(--panel-header-background)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                    <ArrowLeft
                        size={24}
                        color="var(--text-primary)"
                        style={{ cursor: 'pointer' }}
                        onClick={onClose}
                    />
                    <span style={{ color: 'var(--text-primary)', fontSize: '19px', fontWeight: 500 }}>
                        Profile
                    </span>
                </div>
            </div>

            {/* Avatar Section */}
            <div style={{
                padding: '28px',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <div style={{ position: 'relative' }}>
                    {profile.avatar_url ? (
                        <img
                            src={profile.avatar_url}
                            alt="Avatar"
                            style={{ width: '200px', height: '200px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{
                            width: '200px',
                            height: '200px',
                            borderRadius: '50%',
                            backgroundColor: '#00a884',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '80px'
                        }}>
                            {profile.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                    )}
                    <label style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '10px',
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: '#00a884',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                    }}>
                        <Camera size={24} color="white" />
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>
            </div>

            {/* Form Fields */}
            <div style={{ flex: 1, padding: '0 20px', overflowY: 'auto' }}>
                {/* Name */}
                <div style={{
                    backgroundColor: 'var(--panel-header-background)',
                    padding: '14px 20px',
                    marginBottom: '12px',
                    borderRadius: '8px'
                }}>
                    <div style={{
                        color: '#00a884',
                        fontSize: '14px',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <User size={18} />
                        Name
                    </div>
                    <input
                        type="text"
                        value={profile.full_name}
                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                        style={{
                            width: '100%',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '16px',
                            outline: 'none'
                        }}
                    />
                </div>

                {/* About */}
                <div style={{
                    backgroundColor: 'var(--panel-header-background)',
                    padding: '14px 20px',
                    marginBottom: '12px',
                    borderRadius: '8px'
                }}>
                    <div style={{
                        color: '#00a884',
                        fontSize: '14px',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <Info size={18} />
                        About
                    </div>
                    <input
                        type="text"
                        value={profile.about}
                        onChange={(e) => setProfile({ ...profile, about: e.target.value })}
                        style={{
                            width: '100%',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '16px',
                            outline: 'none'
                        }}
                    />
                </div>

                {/* Phone (Read-only) */}
                <div style={{
                    backgroundColor: 'var(--panel-header-background)',
                    padding: '14px 20px',
                    borderRadius: '8px',
                    opacity: 0.7
                }}>
                    <div style={{
                        color: '#00a884',
                        fontSize: '14px',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <Phone size={18} />
                        Phone
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '16px' }}>
                        {profile.phone}
                    </div>
                </div>

                {message && (
                    <div style={{
                        marginTop: '20px',
                        padding: '10px',
                        borderRadius: '8px',
                        backgroundColor: message.includes('Error') ? '#ffebee' : '#e8f5e9',
                        color: message.includes('Error') ? '#c62828' : '#2e7d32',
                        textAlign: 'center'
                    }}>
                        {message}
                    </div>
                )}
            </div>

            {/* Save Button */}
            <div style={{ padding: '20px' }}>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        width: '100%',
                        padding: '14px',
                        backgroundColor: '#00a884',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 500,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                    }}
                >
                    <Check size={20} />
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
};

export default ProfilePage;
