
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { X, Camera, Plus } from 'lucide-react';

const StatusPage = ({ onClose }) => {
    const { user } = useAuth();
    const [statuses, setStatuses] = useState([]);

    // Valid for 24 hours logic handled by DB Policy, but we fetch only valid ones
    useEffect(() => {
        const fetchStatuses = async () => {
            const { data } = await supabase.from('status_stories').select('*');
            // In real app, we would join with contacts to show friends' status
            setStatuses(data || []);
        };
        fetchStatuses();
    }, []);

    return (
        <div style={{
            position: 'absolute',
            top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'var(--background-default)',
            zIndex: 100, // Cover everything
            display: 'flex',
            flexDirection: 'row'
        }}>
            {/* Left Panel - My Status & Recent Updates */}
            <div style={{
                width: '400px',
                backgroundColor: 'var(--panel-background)',
                borderRight: '1px solid rgba(134, 150, 160, 0.15)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ height: '108px', backgroundColor: 'var(--panel-header-background)', padding: '50px 20px 0', color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div onClick={onClose} style={{ cursor: 'pointer' }}><X size={24} color="#fff" /></div>
                        <h2 style={{ fontWeight: 500 }}>Status</h2>
                    </div>
                </div>

                <div style={{ padding: '20px', borderBottom: '1px solid rgba(134, 150, 160, 0.15)', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' }}>
                    <div style={{ position: 'relative' }}>
                        <img src={user?.user_metadata?.avatar_url} style={{ width: '40px', height: '40px', borderRadius: '50%' }} alt="My Status" />
                        <div style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: 'var(--primary)', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Plus size={10} color="#fff" />
                        </div>
                    </div>
                    <div>
                        <div style={{ color: 'var(--text-primary)', fontSize: '16px' }}>My Status</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Click to add status update</div>
                    </div>
                </div>

                <div style={{ padding: '20px' }}>
                    <div style={{ color: 'var(--primary)', fontWeight: 500, fontSize: '14px', marginBottom: '15px' }}>RECENT</div>
                    {/* List of friends' statuses would go here */}
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '20px' }}>
                        No recent updates
                    </div>
                </div>
            </div>

            {/* Right Panel - Status Viewer */}
            <div style={{
                flex: 1,
                backgroundColor: '#0b141a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                flexDirection: 'column'
            }}>
                <Camera size={48} style={{ marginBottom: '20px', opacity: 0.5 }} />
                Click on a contact to view their status updates
            </div>
        </div>
    );
};

export default StatusPage;
