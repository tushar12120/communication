import OneSignal from 'react-onesignal';

let initialized = false;

export const initOneSignal = async (userId) => {
    if (initialized) {
        console.log('OneSignal already initialized');
        return;
    }

    // Check for Native SDK (Cordova/Capacitor)
    if (window.plugins && window.plugins.OneSignal) {
        try {
            console.log('Initializing Native OneSignal SDK...');
            window.plugins.OneSignal.setAppId(import.meta.env.VITE_ONESIGNAL_APP_ID);

            // Notification Received Handler
            window.plugins.OneSignal.setNotificationWillShowInForegroundHandler(function (notificationReceivedEvent) {
                console.log("Notification received:", notificationReceivedEvent);
                notificationReceivedEvent.complete(notificationReceivedEvent.getNotification());
            });

            // Notification Opened Handler
            window.plugins.OneSignal.setNotificationOpenedHandler(function (notification) {
                console.log("Notification opened:", notification);
            });

            // Login Native User
            if (userId) {
                window.plugins.OneSignal.login(userId);
            }

            window.plugins.OneSignal.promptForPushNotificationsWithUserResponse(function (accepted) {
                console.log("User accepted notifications: " + accepted);
            });

            initialized = true;
            return;
        } catch (nativeError) {
            console.error('Native OneSignal Init Error:', nativeError);
        }
    }

    // Fallback to Web SDK
    if (!import.meta.env.VITE_ONESIGNAL_APP_ID) {
        console.log('No OneSignal App ID found');
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
        console.log('OneSignal Web SDK initialized');

        // Set external user ID (links OneSignal user to your user)
        if (userId) {
            await OneSignal.login(userId);
            console.log('OneSignal user logged in:', userId);
        }

        // Request permission
        await OneSignal.Notifications.requestPermission();

    } catch (error) {
        console.error('OneSignal Web Init error:', error);
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
