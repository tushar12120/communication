import OneSignal from 'react-onesignal';

let initialized = false;

export const initOneSignal = async (userId) => {
    if (initialized || !import.meta.env.VITE_ONESIGNAL_APP_ID) {
        console.log('OneSignal already initialized or no App ID');
        return;
    }

    try {
        await OneSignal.init({
            appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
            allowLocalhostAsSecureOrigin: true,
            serviceWorkerParam: { scope: '/' },
            serviceWorkerPath: 'sw.js',
            notifyButton: {
                enable: false,
            },
        });

        initialized = true;
        console.log('OneSignal initialized');

        // Set external user ID (links OneSignal user to your user)
        if (userId) {
            await OneSignal.login(userId);
            console.log('OneSignal user logged in:', userId);
        }

        // Request permission
        const permission = await OneSignal.Notifications.requestPermission();
        console.log('Notification permission:', permission);

    } catch (error) {
        console.error('OneSignal init error:', error);
    }
};

export const sendCallNotification = async (receiverId, callerName, callType) => {
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
    const apiKey = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;

    if (!appId || !apiKey) {
        console.log('OneSignal keys not configured');
        return null;
    }

    try {
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${apiKey}`
            },
            body: JSON.stringify({
                app_id: appId,
                include_aliases: {
                    external_id: [receiverId]
                },
                target_channel: "push",
                headings: { en: '📞 Incoming Call' },
                contents: { en: `${callerName} is calling you (${callType === 'video' ? 'Video' : 'Voice'})` },
                data: {
                    type: 'incoming_call',
                    callType: callType
                },
                ttl: 30,
                priority: 10,
                chrome_web_badge: '/icons/icon.svg',
                chrome_web_icon: '/icons/icon.svg'
            })
        });

        const result = await response.json();
        console.log('Push notification sent:', result);
        return result;
    } catch (error) {
        console.error('Error sending push:', error);
        return null;
    }
};

export const logoutOneSignal = async () => {
    try {
        await OneSignal.logout();
        initialized = false;
        console.log('OneSignal logged out');
    } catch (error) {
        console.error('OneSignal logout error:', error);
    }
};

export default { initOneSignal, sendCallNotification, logoutOneSignal };
