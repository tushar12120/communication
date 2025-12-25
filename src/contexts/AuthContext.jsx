import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const userRef = useRef(null);

    // Keep userRef in sync
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // Update online status
    const updateOnlineStatus = async (isOnline, userId = null) => {
        const id = userId || userRef.current?.id;
        if (!id) return;

        try {
            await supabase
                .from('profiles')
                .update({
                    is_online: isOnline,
                    last_seen: new Date().toISOString()
                })
                .eq('id', id);
            console.log(`Online status updated: ${isOnline ? 'online' : 'offline'}`);
        } catch (err) {
            console.error('Failed to update online status:', err);
        }
    };

    useEffect(() => {
        // Get initial session
        const getSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) {
                    console.error("Session error:", error);
                    await supabase.auth.signOut();
                    setUser(null);
                } else {
                    const currentUser = session?.user ?? null;
                    setUser(currentUser);
                    // Set online immediately after getting session
                    if (currentUser) {
                        updateOnlineStatus(true, currentUser.id);
                    }
                }
            } catch (err) {
                console.error("Auth init error:", err);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        getSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            console.log("Auth state changed:", _event);
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (_event === 'SIGNED_IN' && currentUser) {
                updateOnlineStatus(true, currentUser.id);
            }

            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Online status management
    useEffect(() => {
        if (!user) return;

        // Set online immediately
        updateOnlineStatus(true, user.id);

        // Handle visibility change (tab switch)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                updateOnlineStatus(true, user.id);
            }
        };

        // Handle page close
        const handleBeforeUnload = () => {
            // Synchronous update using fetch with keepalive
            const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`;
            fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({ is_online: false, last_seen: new Date().toISOString() }),
                keepalive: true
            });
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Heartbeat every 15 seconds
        const heartbeat = setInterval(() => {
            updateOnlineStatus(true, user.id);
        }, 15000);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            clearInterval(heartbeat);
        };
    }, [user]);

    // Sign Up
    const signUp = async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        return data;
    };

    // Sign In
    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    };

    // Sign Out
    const signOut = async () => {
        if (user) {
            await updateOnlineStatus(false, user.id);
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
