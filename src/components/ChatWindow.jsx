import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { Paperclip, Smile, Mic, Send, MoreVertical, Search, Phone, Video, Check, CheckCheck, MessageSquare, X, Trash2, Image, Download } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import VideoCall from './VideoCall';

// Avatar Component
const Avatar = ({ src, name, size = 40 }) => {
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
            style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
    );
};

const ChatWindow = ({ selectedUser }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [otherTyping, setOtherTyping] = useState(false);
    const [showCall, setShowCall] = useState(false);
    const [callType, setCallType] = useState('video');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);

    // Mark messages as read
    const markAsRead = async () => {
        if (!user || !selectedUser) return;
        await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('sender_id', selectedUser.id)
            .eq('receiver_id', user.id)
            .eq('is_read', false);
    };

    useEffect(() => {
        if (!selectedUser || !user) return;

        setMessages([]);
        markAsRead();

        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: true });

            if (error) console.error('Error fetching messages:', error);
            else setMessages(data || []);
        };

        fetchMessages();

        const channel = supabase
            .channel(`chat_${selectedUser.id}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newMsg = payload.new;
                        if (
                            (newMsg.sender_id === user.id && newMsg.receiver_id === selectedUser.id) ||
                            (newMsg.sender_id === selectedUser.id && newMsg.receiver_id === user.id)
                        ) {
                            setMessages(prev => [...prev, newMsg]);
                            if (newMsg.sender_id === selectedUser.id) markAsRead();
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const updated = payload.new;
                        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
                    } else if (payload.eventType === 'DELETE') {
                        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        // Typing indicator channel
        const typingChannel = supabase.channel(`typing_${selectedUser.id}_${user.id}`);

        typingChannel
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                if (payload.userId === selectedUser.id) {
                    setOtherTyping(true);
                    setTimeout(() => setOtherTyping(false), 3000);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(typingChannel);
        };
    }, [selectedUser, user]);

    // Broadcast typing status
    const broadcastTyping = async () => {
        if (!selectedUser || !user) return;
        const typingChannel = supabase.channel(`typing_${user.id}_${selectedUser.id}`);
        await typingChannel.subscribe();
        typingChannel.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId: user.id }
        });
    };

    const handleInputChange = (e) => {
        setNewMessage(e.target.value);

        // Debounced typing broadcast
        if (!isTyping) {
            setIsTyping(true);
            broadcastTyping();
        }

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setIsTyping(false);
        }, 2000);
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if (!newMessage.trim() || !user || !selectedUser) return;

        try {
            await supabase.from('messages').insert({
                content: newMessage,
                sender_id: user.id,
                receiver_id: selectedUser.id
            });
            setNewMessage('');
            setShowEmojiPicker(false);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    const handleEmojiClick = (emojiData) => {
        setNewMessage(prev => prev + emojiData.emoji);
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('chat-images')
            .upload(fileName, file);

        if (uploadError) {
            console.error('Upload error:', uploadError);
            setUploading(false);
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('chat-images')
            .getPublicUrl(fileName);

        await supabase.from('messages').insert({
            content: '📷 Image',
            media_url: publicUrl,
            sender_id: user.id,
            receiver_id: selectedUser.id
        });

        setUploading(false);
    };

    const handleDeleteMessage = async (msgId) => {
        if (window.confirm('Delete this message?')) {
            await supabase.from('messages').delete().eq('id', msgId);
        }
    };

    const handleCall = (type) => {
        setCallType(type);
        setShowCall(true);
    };

    // Voice Recording Functions
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await sendVoiceMessage(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Timer for recording duration
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingTimerRef.current);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            audioChunksRef.current = [];
            setIsRecording(false);
            clearInterval(recordingTimerRef.current);
            setRecordingTime(0);
        }
    };

    const sendVoiceMessage = async (audioBlob) => {
        if (!audioBlob || audioBlob.size === 0) {
            console.log('No audio to send');
            return;
        }

        console.log('Sending voice message, size:', audioBlob.size);
        setUploading(true);
        const fileName = `voice_${user.id}_${Date.now()}.webm`;

        try {
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('chat-images')
                .upload(fileName, audioBlob, {
                    contentType: 'audio/webm'
                });

            if (uploadError) {
                console.error('Voice upload error:', uploadError);
                alert('Failed to upload voice message: ' + uploadError.message);
                setUploading(false);
                return;
            }

            console.log('Upload successful:', uploadData);

            const { data: { publicUrl } } = supabase.storage
                .from('chat-images')
                .getPublicUrl(fileName);

            console.log('Public URL:', publicUrl);

            const { error: insertError } = await supabase.from('messages').insert({
                content: '🎤 Voice message',
                media_url: publicUrl,
                sender_id: user.id,
                receiver_id: selectedUser.id
            });

            if (insertError) {
                console.error('Message insert error:', insertError);
            } else {
                console.log('Voice message sent successfully');
            }
        } catch (err) {
            console.error('Voice send error:', err);
        } finally {
            setUploading(false);
            setRecordingTime(0);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Empty State
    if (!selectedUser) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#222e35',
                color: '#8696a0',
                textAlign: 'center',
                padding: '40px'
            }}>
                <div style={{
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '30px'
                }}>
                    <MessageSquare size={80} color="#00a884" />
                </div>
                <h1 style={{ fontWeight: 300, fontSize: '32px', color: '#e9edef', marginBottom: '15px' }}>
                    ChatVerse
                </h1>
                <p style={{ fontSize: '14px', maxWidth: '400px', lineHeight: 1.6 }}>
                    Send and receive messages instantly. Select a chat from the sidebar or start a new conversation.
                </p>
            </div>
        );
    }

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#0b141a',
            height: '100vh'
        }}>
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
                <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{ position: 'relative' }}>
                        <Avatar src={selectedUser.avatar_url} name={selectedUser.full_name} size={40} />
                        {selectedUser.is_online && (
                            <div style={{
                                position: 'absolute',
                                bottom: '2px',
                                right: '2px',
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: '#00a884',
                                border: '2px solid var(--panel-header-background)'
                            }} />
                        )}
                    </div>
                    <div style={{ marginLeft: '15px' }}>
                        <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 500 }}>
                            {selectedUser.full_name || 'Unknown'}
                        </div>
                        <div style={{ color: otherTyping ? '#00a884' : (selectedUser.is_online ? '#00a884' : 'var(--secondary)'), fontSize: '12px' }}>
                            {otherTyping
                                ? 'typing...'
                                : selectedUser.is_online
                                    ? 'online'
                                    : selectedUser.last_seen
                                        ? `last seen ${new Date(selectedUser.last_seen).toLocaleString()}`
                                        : 'offline'}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '22px', color: 'var(--icon)' }}>
                    <Video size={22} style={{ cursor: 'pointer', opacity: 0.85 }} onClick={() => handleCall('video')} />
                    <Phone size={22} style={{ cursor: 'pointer', opacity: 0.85 }} onClick={() => handleCall('audio')} />
                    <Search size={22} style={{ opacity: 0.85 }} />
                    <MoreVertical size={22} style={{ opacity: 0.85 }} />
                </div>
            </div>

            {/* Messages Area */}
            <div style={{
                flex: 1,
                padding: '20px 60px',
                overflowY: 'auto',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23182229\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                backgroundColor: '#0b141a'
            }}>
                {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#8696a0', paddingTop: '50px' }}>
                        <p>No messages yet. Say hello! 👋</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.sender_id === user.id;
                        return (
                            <div
                                key={msg.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: isMe ? 'flex-end' : 'flex-start',
                                    marginBottom: '4px'
                                }}
                            >
                                <div
                                    style={{
                                        maxWidth: '65%',
                                        padding: '8px 10px',
                                        borderRadius: '8px',
                                        backgroundColor: isMe ? '#005c4b' : '#202c33',
                                        color: '#e9edef',
                                        fontSize: '14.5px',
                                        lineHeight: '20px',
                                        boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
                                        position: 'relative',
                                        cursor: isMe ? 'context-menu' : 'default'
                                    }}
                                    onDoubleClick={() => isMe && handleDeleteMessage(msg.id)}
                                    title={isMe ? "Double-click to delete" : ""}
                                >
                                    {msg.media_url && (
                                        msg.content === '🎤 Voice message' ? (
                                            /* Voice Message Player */
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                minWidth: '200px'
                                            }}>
                                                <audio
                                                    controls
                                                    src={msg.media_url}
                                                    style={{
                                                        height: '36px',
                                                        width: '100%',
                                                        maxWidth: '250px'
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            /* Image with Download */
                                            <div style={{ position: 'relative' }}>
                                                <img
                                                    src={msg.media_url}
                                                    alt="Shared"
                                                    style={{
                                                        maxWidth: '100%',
                                                        borderRadius: '6px',
                                                        marginBottom: '5px',
                                                        maxHeight: '300px',
                                                        objectFit: 'contain',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => window.open(msg.media_url, '_blank')}
                                                />
                                                <a
                                                    href={msg.media_url}
                                                    download
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        position: 'absolute',
                                                        top: '8px',
                                                        right: '8px',
                                                        backgroundColor: 'rgba(0,0,0,0.6)',
                                                        borderRadius: '50%',
                                                        padding: '6px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        textDecoration: 'none'
                                                    }}
                                                    title="Download"
                                                >
                                                    <Download size={16} />
                                                </a>
                                            </div>
                                        )
                                    )}
                                    {msg.content !== '📷 Image' && msg.content !== '🎤 Voice message' && msg.content}
                                    <span style={{
                                        fontSize: '11px',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginLeft: '10px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        float: 'right',
                                        marginTop: '3px'
                                    }}>
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {isMe && (
                                            msg.is_read
                                                ? <CheckCheck size={16} color="#53bdeb" />
                                                : <CheckCheck size={16} color="rgba(255,255,255,0.5)" />
                                        )}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '75px', left: '20px', zIndex: 100 }}>
                    <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        theme="dark"
                        width={350}
                        height={400}
                    />
                </div>
            )}

            {/* Input Area */}
            <div style={{
                height: '62px',
                backgroundColor: 'var(--panel-header-background)',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                {isRecording ? (
                    /* Recording UI */
                    <>
                        <button
                            onClick={cancelRecording}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#f44336',
                                cursor: 'pointer',
                                padding: '8px'
                            }}
                        >
                            <X size={24} />
                        </button>

                        <div style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: '#2a3942',
                            borderRadius: '8px',
                            padding: '10px 14px'
                        }}>
                            <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                backgroundColor: '#f44336',
                                animation: 'pulse 1s infinite'
                            }} />
                            <span style={{ color: '#e9edef', fontSize: '15px' }}>
                                Recording... {formatTime(recordingTime)}
                            </span>
                        </div>

                        <button
                            onClick={stopRecording}
                            style={{
                                width: '45px',
                                height: '45px',
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
                            <Send size={20} />
                        </button>
                    </>
                ) : (
                    /* Normal Input UI */
                    <>
                        <div style={{ display: 'flex', gap: '18px', color: 'var(--icon)' }}>
                            <Smile
                                size={24}
                                style={{ cursor: 'pointer', opacity: 0.85, color: showEmojiPicker ? '#00a884' : 'var(--icon)' }}
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            />
                            <Paperclip
                                size={24}
                                style={{ cursor: 'pointer', opacity: uploading ? 0.5 : 0.85 }}
                                onClick={() => fileInputRef.current?.click()}
                            />
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleImageUpload}
                                style={{ display: 'none' }}
                            />
                        </div>

                        <form onSubmit={handleSendMessage} style={{ flex: 1 }}>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={handleInputChange}
                                placeholder="Type a message"
                                style={{
                                    width: '100%',
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    border: 'none',
                                    backgroundColor: '#2a3942',
                                    color: '#e9edef',
                                    fontSize: '15px',
                                    outline: 'none'
                                }}
                            />
                        </form>

                        <div style={{ color: 'var(--icon)' }}>
                            {newMessage.trim() ? (
                                <Send size={24} onClick={handleSendMessage} style={{ cursor: 'pointer', color: '#00a884' }} />
                            ) : (
                                <Mic
                                    size={24}
                                    style={{ cursor: 'pointer', opacity: 0.85 }}
                                    onClick={startRecording}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Video Call */}
            <VideoCall
                isOpen={showCall}
                onClose={() => setShowCall(false)}
                callType={callType}
                remoteUser={selectedUser}
            />
        </div>
    );
};

export default ChatWindow;
