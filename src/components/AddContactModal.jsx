
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { X, Search, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AddContactModal = ({ onClose, onContactAdded }) => {
    const { user } = useAuth();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!phoneNumber) return;

        setLoading(true);
        setError('');
        setSearchResult(null);

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('phone', phoneNumber)
                .neq('id', user.id) // Can't add self
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (!data) {
                setError('User not found on ChatVerse.');
            } else {
                setSearchResult(data);
            }
        } catch (err) {
            console.error(err);
            setError('Error searching user.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddContact = async () => {
        if (!searchResult) return;

        try {
            const { error } = await supabase
                .from('contacts')
                .insert({
                    user_id: user.id,
                    contact_id: searchResult.id
                });

            if (error) {
                if (error.code === '23505') setError('Contact already added.'); // Unique violation
                else throw error;
            } else {
                onContactAdded();
                onClose(); // Close modal on success
            }
        } catch (err) {
            console.error(err);
            setError('Failed to add contact.');
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: 'var(--panel-background)',
                width: '400px',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 17px 50px 0 rgba(11,20,26,.19), 0 12px 15px 0 rgba(11,20,26,.24)'
            }}>
                <div style={{
                    backgroundColor: 'var(--panel-header-background)',
                    padding: '16px 20px',
                    color: 'var(--text-primary)',
                    fontSize: '19px',
                    fontWeight: 500,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>New Chat</span>
                    <X size={24} color="var(--icon)" cursor="pointer" onClick={onClose} />
                </div>

                <div style={{ padding: '20px' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--incoming-background)', borderRadius: '8px', padding: '8px 12px', marginBottom: '20px' }}>
                        <Search size={20} color="var(--icon)" style={{ marginRight: '10px' }} />
                        <input
                            type="tel"
                            placeholder="Search by phone number"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '15px' }}
                            autoFocus
                        />
                    </form>

                    {loading && <div style={{ textAlign: 'center', color: 'var(--secondary)' }}>Searching...</div>}
                    {error && <div style={{ textAlign: 'center', color: '#f15c6d', fontSize: '14px' }}>{error}</div>}

                    {searchResult && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px',
                            borderTop: '1px solid rgba(134, 150, 160, 0.15)',
                            marginTop: '10px'
                        }}>
                            <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                backgroundColor: '#00a884',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '20px',
                                fontWeight: 500,
                                marginRight: '15px'
                            }}>
                                {searchResult.full_name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: 'var(--text-primary)', fontSize: '16px' }}>{searchResult.full_name}</div>
                                <div style={{ color: 'var(--secondary)', fontSize: '13px' }}>{searchResult.about || 'Available'}</div>
                            </div>
                            <button
                                onClick={handleAddContact}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--primary)',
                                    cursor: 'pointer'
                                }}
                            >
                                <UserPlus size={24} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddContactModal;
