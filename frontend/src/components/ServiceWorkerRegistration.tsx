'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered:', registration.scope);

            // Check for updates periodically
            setInterval(() => {
              registration.update();
            }, 60 * 60 * 1000); // Every hour
          })
          .catch((error) => {
            console.error('SW registration failed:', error);
          });
      });
    }
  }, []);

  return null;
}

/**
 * Request notification permission and subscribe to push
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create new subscription
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn('VAPID public key not configured');
        return null;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    // Send subscription to backend
    const token = localStorage.getItem('token');
    if (token) {
      await fetch('http://localhost:3001/api/wellness/reminders', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          push: {
            enabled: true,
            subscription: subscription.toJSON(),
          },
        }),
      });
    }

    return subscription;
  } catch (err) {
    console.error('Failed to subscribe to push:', err);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
    }

    // Update backend
    const token = localStorage.getItem('token');
    if (token) {
      await fetch('http://localhost:3001/api/wellness/reminders', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          push: {
            enabled: false,
            subscription: null,
          },
        }),
      });
    }

    return true;
  } catch (err) {
    console.error('Failed to unsubscribe from push:', err);
    return false;
  }
}

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default ServiceWorkerRegistration;
