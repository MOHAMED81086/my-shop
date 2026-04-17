import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { Bell, Check } from 'lucide-react';

export default function Notifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', user.id), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await markAsRead(n.id);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2"><Bell className="w-6 h-6 text-blue-600" /> الإشعارات</h2>
        {notifications.some(n => !n.read) && (
          <button onClick={markAllAsRead} className="text-sm text-blue-600 hover:underline">تحديد الكل كمقروء</button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.map(notif => (
          <div key={notif.id} className={`p-4 rounded-xl border ${notif.read ? 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800'} flex items-start justify-between gap-4`}>
            <div>
              <p className={`text-sm ${notif.read ? 'text-gray-600 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100 font-semibold'}`}>{notif.message}</p>
              <p className="text-xs text-gray-400 mt-1">{notif.createdAt ? new Date(notif.createdAt.toDate()).toLocaleString('ar-EG') : ''}</p>
            </div>
            {!notif.read && (
              <button onClick={() => markAsRead(notif.id)} className="p-1 text-blue-600 hover:bg-blue-100 rounded-full" title="تحديد كمقروء">
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Bell className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            لا توجد إشعارات
          </div>
        )}
      </div>
    </div>
  );
}
