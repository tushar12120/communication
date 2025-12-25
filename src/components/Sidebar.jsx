import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { LogOut, Search, MessageSquarePlus, MoreVertical, CircleDashed, User } from 'lucide-react';
import AddContactModal from './AddContactModal';
import StatusPage from '../pages/StatusPage';
import ProfilePage from '../pages/ProfilePage';

// Default Avatar Component
const Avatar = ({ src, name, size = 45 }) => {
  const [imgError, setImgError] = useState(false);
  const initials = name ? name.charAt(0).toUpperCase() : 'U';

  if (!src || imgError) {
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: '#00a884',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: size * 0.4,
        fontWeight: 500,
        flexShrink: 0
      }}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setImgError(true)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0
      }}
    />
  );
};

const Sidebar = ({ onSelectUser, selectedUser, isMobile = false }) => {
  const { user, signOut } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profile, setProfile] = useState(null);

  // Fetch current user's profile
  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setProfile(data));
    }
  }, [user]);

  const fetchChats = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch saved contacts with online status
      const { data: contactsData } = await supabase
        .from('contacts')
        .select('contact_id, profiles:contact_id(id, full_name, avatar_url, about, phone, is_online, last_seen)')
        .eq('user_id', user.id);

      const savedContacts = contactsData?.map(item => item.profiles).filter(Boolean) || [];
      const savedIds = new Set(savedContacts.map(c => c.id));

      // Fetch users who have messaged me
      const { data: messagesData } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const senderIds = [...new Set(messagesData?.map(m => m.sender_id) || [])];
      const newSenderIds = senderIds.filter(id => !savedIds.has(id));

      let allChats = [...savedContacts];

      if (newSenderIds.length > 0) {
        const { data: newSenders } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, about, phone, is_online, last_seen')
          .in('id', newSenderIds);

        if (newSenders) {
          allChats = [...allChats, ...newSenders];
        }
      }

      // Deduplicate
      const uniqueChats = Array.from(new Map(allChats.map(item => [item.id, item])).values());

      // Fetch unread counts
      const { data: unreadData } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      const unreadCounts = {};
      unreadData?.forEach(msg => {
        unreadCounts[msg.sender_id] = (unreadCounts[msg.sender_id] || 0) + 1;
      });

      const chatsWithCounts = uniqueChats.map(chat => ({
        ...chat,
        unread_count: unreadCounts[chat.id] || 0
      }));

      setContacts(chatsWithCounts);
    } catch (error) {
      console.error("Error fetching chats:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();

    // Listen for new messages
    const channel = supabase
      .channel('sidebar_messages')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => fetchChats()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  // Clear unread when selecting user
  useEffect(() => {
    if (selectedUser) {
      setContacts(prev => prev.map(c =>
        c.id === selectedUser.id ? { ...c, unread_count: 0 } : c
      ));
    }
  }, [selectedUser]);


  if (showProfile) {
    return <ProfilePage onClose={() => { setShowProfile(false); fetchChats(); }} />;
  }

  if (showStatus) {
    return <StatusPage onClose={() => setShowStatus(false)} />;
  }

  return (
    <aside style={{
      width: isMobile ? '100%' : '380px',
      borderRight: isMobile ? 'none' : '1px solid rgba(134, 150, 160, 0.15)',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--panel-background)',
      height: '100vh'
    }}>
      {showAddContact && (
        <AddContactModal
          onClose={() => setShowAddContact(false)}
          onContactAdded={() => {
            fetchChats();
            setShowAddContact(false);
          }}
        />
      )}

      {/* Header */}
      <div style={{
        height: '60px',
        backgroundColor: 'var(--panel-header-background)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
          <Avatar
            src={profile?.avatar_url}
            name={profile?.full_name || user?.email}
            size={40}
          />
        </div>

        <div style={{ display: 'flex', gap: '22px', color: 'var(--icon)' }}>
          <CircleDashed
            size={22}
            style={{ cursor: 'pointer', opacity: 0.85 }}
            onClick={() => setShowStatus(true)}
            title="Status"
          />
          <MessageSquarePlus
            size={22}
            onClick={() => setShowAddContact(true)}
            style={{ cursor: 'pointer', opacity: 0.85 }}
            title="New Chat"
          />
          <MoreVertical size={22} style={{ opacity: 0.85 }} />
          <LogOut
            size={22}
            onClick={signOut}
            style={{ cursor: 'pointer', opacity: 0.85 }}
            title="Logout"
          />
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        padding: '8px 12px',
        backgroundColor: 'var(--panel-background)'
      }}>
        <div style={{
          backgroundColor: 'var(--search-input-background)',
          borderRadius: '8px',
          padding: '7px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Search size={18} color="var(--icon)" />
          <input
            type="text"
            placeholder="Search or start new chat"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              width: '100%',
              outline: 'none',
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      {/* Chat List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--secondary)' }}>
            Loading chats...
          </div>
        ) : contacts.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'var(--secondary)',
            lineHeight: 1.6
          }}>
            <MessageSquarePlus size={48} style={{ marginBottom: '15px', opacity: 0.5 }} />
            <p>No chats yet.</p>
            <p style={{ fontSize: '13px' }}>
              Click <strong>+</strong> to start a new chat!
            </p>
          </div>
        ) : (
          contacts.map(c => (
            <div
              key={c.id}
              onClick={() => onSelectUser(c)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 15px',
                cursor: 'pointer',
                backgroundColor: selectedUser?.id === c.id ? 'var(--background-default-hover)' : 'transparent',
                borderBottom: '1px solid rgba(134, 150, 160, 0.08)',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => {
                if (selectedUser?.id !== c.id) e.currentTarget.style.backgroundColor = 'var(--background-default-hover)';
              }}
              onMouseLeave={(e) => {
                if (selectedUser?.id !== c.id) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Avatar src={c.avatar_url} name={c.full_name} size={49} />

              <div style={{ flex: 1, marginLeft: '15px', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    color: 'var(--text-primary)',
                    fontSize: '16px',
                    fontWeight: c.unread_count > 0 ? 500 : 400
                  }}>
                    {c.full_name || 'Unknown'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                  <span style={{
                    color: 'var(--secondary)',
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '200px'
                  }}>
                    {c.about || 'Available'}
                  </span>
                  {c.unread_count > 0 && (
                    <span style={{
                      backgroundColor: '#00a884',
                      color: 'white',
                      borderRadius: '50%',
                      minWidth: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '0 5px',
                      marginLeft: '10px'
                    }}>
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
