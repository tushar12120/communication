import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import callSounds from '../utils/callSounds';
import {
    Phone,
    PhoneOff,
    Video,
    VideoOff,
    Mic,
    MicOff,
    X
} from 'lucide-react';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

const VideoCall = ({
    isOpen,
    onClose,
    callType, // 'audio' or 'video'
    remoteUser,
    isIncoming = false,
    incomingOffer = null
}) => {
    const { user } = useAuth();
    const [callState, setCallState] = useState('idle'); // idle, calling, ringing, connected, ended
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
    const [error, setError] = useState('');

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);
    const localStream = useRef(null);
    const signalChannel = useRef(null);

    // Initialize call
    useEffect(() => {
        if (isOpen && remoteUser) {
            initializeCall();
        }

        return () => {
            cleanup();
        };
    }, [isOpen, remoteUser]);

    const initializeCall = async () => {
        try {
            // Get local media stream
            const stream = await navigator.mediaDevices.getUserMedia({
                video: callType === 'video',
                audio: true
            });

            localStream.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Create peer connection
            peerConnection.current = new RTCPeerConnection(ICE_SERVERS);

            // Add local tracks to peer connection
            stream.getTracks().forEach(track => {
                peerConnection.current.addTrack(track, stream);
            });

            // Handle incoming tracks
            peerConnection.current.ontrack = (event) => {
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            // Handle ICE candidates
            peerConnection.current.onicecandidate = (event) => {
                if (event.candidate) {
                    sendSignal('ice-candidate', event.candidate);
                }
            };

            // Connection state changes
            peerConnection.current.onconnectionstatechange = () => {
                console.log('Connection state:', peerConnection.current.connectionState);
                if (peerConnection.current.connectionState === 'connected') {
                    setCallState('connected');
                } else if (peerConnection.current.connectionState === 'disconnected' ||
                    peerConnection.current.connectionState === 'failed') {
                    endCall();
                }
            };

            // Setup signaling channel
            setupSignaling();

            // If incoming call, handle the offer
            if (isIncoming && incomingOffer) {
                setCallState('ringing');
            } else {
                // Outgoing call - create and send offer
                setCallState('calling');

                // Play ringback tone for caller
                callSounds.playRingback();

                const offer = await peerConnection.current.createOffer();
                await peerConnection.current.setLocalDescription(offer);
                sendSignal('offer', offer);

                // Send incoming call notification to receiver
                const incomingChannel = supabase.channel(`incoming_calls_${remoteUser.id}`);
                await incomingChannel.subscribe();
                await incomingChannel.send({
                    type: 'broadcast',
                    event: 'incoming-call',
                    payload: {
                        from: user.id,
                        to: remoteUser.id,
                        callType: callType,
                        offer: offer
                    }
                });
                console.log('Sent incoming call to:', remoteUser.id);
            }

        } catch (err) {
            console.error('Call initialization error:', err);
            setError('Could not access camera/microphone');
            setCallState('ended');
        }
    };

    const setupSignaling = () => {
        const channelName = `call_${[user.id, remoteUser.id].sort().join('_')}`;

        signalChannel.current = supabase.channel(channelName);

        signalChannel.current
            .on('broadcast', { event: 'signal' }, async ({ payload }) => {
                if (payload.from === user.id) return; // Ignore own messages

                console.log('Received signal:', payload.type);

                switch (payload.type) {
                    case 'offer':
                        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.data));
                        const answer = await peerConnection.current.createAnswer();
                        await peerConnection.current.setLocalDescription(answer);
                        sendSignal('answer', answer);
                        break;

                    case 'answer':
                        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.data));
                        break;

                    case 'ice-candidate':
                        await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.data));
                        break;

                    case 'call-accepted':
                        callSounds.stop();
                        callSounds.playConnected();
                        setCallState('connected');
                        break;

                    case 'call-rejected':
                    case 'call-ended':
                        endCall();
                        break;
                }
            })
            .subscribe();
    };

    const sendSignal = async (type, data) => {
        if (!signalChannel.current) return;

        await signalChannel.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type, data, from: user.id }
        });
    };

    const acceptCall = async () => {
        setCallState('connected');
        if (incomingOffer) {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(incomingOffer));
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            sendSignal('answer', answer);
        }
        sendSignal('call-accepted', {});
    };

    const rejectCall = () => {
        sendSignal('call-rejected', {});
        endCall();
    };

    const endCall = () => {
        callSounds.stop();
        callSounds.playEnded();
        sendSignal('call-ended', {});
        cleanup();
        setCallState('ended');
        setTimeout(() => onClose(), 1000);
    };

    const cleanup = () => {
        // Stop all tracks
        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }

        // Close peer connection
        if (peerConnection.current) {
            peerConnection.current.close();
        }

        // Unsubscribe from channel
        if (signalChannel.current) {
            supabase.removeChannel(signalChannel.current);
        }
    };

    const toggleMute = () => {
        if (localStream.current) {
            const audioTrack = localStream.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStream.current) {
            const videoTrack = localStream.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#0a0a0a',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 2000
        }}>
            {/* Header */}
            <div style={{
                padding: '20px',
                textAlign: 'center',
                color: 'white'
            }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>
                    {remoteUser?.full_name || 'Unknown'}
                </h2>
                <p style={{ margin: '5px 0', color: '#aaa', fontSize: '14px' }}>
                    {callState === 'calling' && 'Calling...'}
                    {callState === 'ringing' && 'Incoming call...'}
                    {callState === 'connected' && 'Connected'}
                    {callState === 'ended' && 'Call ended'}
                </p>
                {error && <p style={{ color: '#f44336', fontSize: '14px' }}>{error}</p>}
            </div>

            {/* Video Area */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Remote Video (Full Screen) */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        backgroundColor: '#1a1a1a'
                    }}
                />

                {/* Local Video (Picture-in-Picture) */}
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                        position: 'absolute',
                        bottom: '100px',
                        right: '20px',
                        width: '150px',
                        height: '200px',
                        objectFit: 'cover',
                        borderRadius: '12px',
                        backgroundColor: '#2a2a2a',
                        border: '2px solid rgba(255,255,255,0.2)'
                    }}
                />

                {/* Avatar for audio call or video off */}
                {(callType === 'audio' || isVideoOff) && (
                    <div style={{
                        position: 'absolute',
                        width: '150px',
                        height: '150px',
                        borderRadius: '50%',
                        backgroundColor: '#00a884',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '60px',
                        fontWeight: 500
                    }}>
                        {remoteUser?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                )}
            </div>

            {/* Controls */}
            <div style={{
                padding: '30px',
                display: 'flex',
                justifyContent: 'center',
                gap: '25px'
            }}>
                {/* Ringing controls */}
                {callState === 'ringing' && (
                    <>
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
                            <Phone size={28} />
                        </button>
                    </>
                )}

                {/* Connected controls */}
                {(callState === 'calling' || callState === 'connected') && (
                    <>
                        <button
                            onClick={toggleMute}
                            style={{
                                width: '55px',
                                height: '55px',
                                borderRadius: '50%',
                                backgroundColor: isMuted ? '#f44336' : 'rgba(255,255,255,0.2)',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                        </button>

                        {callType === 'video' && (
                            <button
                                onClick={toggleVideo}
                                style={{
                                    width: '55px',
                                    height: '55px',
                                    borderRadius: '50%',
                                    backgroundColor: isVideoOff ? '#f44336' : 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                            </button>
                        )}

                        <button
                            onClick={endCall}
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
                    </>
                )}
            </div>

            {/* Close button */}
            <button
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'white'
                }}
            >
                <X size={24} />
            </button>
        </div>
    );
};

export default VideoCall;
