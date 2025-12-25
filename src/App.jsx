import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import VideoCall from './components/VideoCall';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './services/supabase';
import { Phone, Video, PhoneOff, X } from 'lucide-react';

function App() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState(null);

  // Incoming call state
  const [incomingCall, setIncomingCall] = useState(null);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;

    const callChannel = supabase.channel(`incoming_calls_${user.id}`);

    callChannel
      .on('broadcast', { event: 'incoming-call' }, async ({ payload }) => {
        console.log('Incoming call received:', payload);
        if (payload.to === user.id && !incomingCall) {
          // Fetch caller info
          const { data: caller } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.from)
            .single();

          setIncomingCall({
            caller,
            callType: payload.callType,
            offer: payload.offer
          });
          setIncomingOffer(payload.offer);
          setShowIncomingCall(true);

          // Play ringtone (optional)
          // const audio = new Audio('/ringtone.mp3');
          // audio.play();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(callChannel);
    };
  }, [user, incomingCall]);

  const acceptCall = () => {
    setCallAccepted(true);
    setShowIncomingCall(false);
  };

  const rejectCall = async () => {
    // Send rejection signal
    const rejectChannel = supabase.channel(`incoming_calls_${incomingCall?.caller?.id}`);
    await rejectChannel.subscribe();
    rejectChannel.send({
      type: 'broadcast',
      event: 'call-rejected',
      payload: { from: user.id }
    });

    setShowIncomingCall(false);
    setIncomingCall(null);
    setIncomingOffer(null);
  };

  const closeCall = () => {
    setCallAccepted(false);
    setIncomingCall(null);
    setIncomingOffer(null);
  };

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100vh',
      maxWidth: '1600px',
      margin: '0 auto',
      backgroundColor: 'var(--background-default)',
      position: 'relative',
      overflow: 'hidden',
      top: '0'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        width: '100%',
        height: '127px',
        backgroundColor: 'var(--primary)',
        zIndex: -1,
        display: 'none'
      }}></div>

      <Sidebar onSelectUser={setSelectedUser} selectedUser={selectedUser} />
      <ChatWindow selectedUser={selectedUser} />

      {/* Incoming Call Modal */}
      {showIncomingCall && incomingCall && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '20px',
            padding: '40px',
            textAlign: 'center',
            color: 'white',
            minWidth: '300px'
          }}>
            {/* Caller Avatar */}
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              backgroundColor: '#00a884',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '40px',
              fontWeight: 500,
              margin: '0 auto 20px'
            }}>
              {incomingCall.caller?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>

            <h2 style={{ margin: '0 0 8px', fontSize: '22px' }}>
              {incomingCall.caller?.full_name || 'Unknown'}
            </h2>
            <p style={{ color: '#aaa', margin: '0 0 30px' }}>
              Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call...
            </p>

            {/* Call Actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '30px' }}>
              <button
                onClick={rejectCall}
                style={{
                  width: '65px',
                  height: '65px',
                  borderRadius: '50%',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <PhoneOff size={28} />
              </button>
              <button
                onClick={acceptCall}
                style={{
                  width: '65px',
                  height: '65px',
                  borderRadius: '50%',
                  backgroundColor: '#00a884',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {incomingCall.callType === 'video' ? <Video size={28} /> : <Phone size={28} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Screen (when accepted) */}
      {callAccepted && incomingCall && (
        <VideoCall
          isOpen={true}
          onClose={closeCall}
          callType={incomingCall.callType}
          remoteUser={incomingCall.caller}
          isIncoming={true}
          incomingOffer={incomingOffer}
        />
      )}
    </div>
  );
}

export default App;
