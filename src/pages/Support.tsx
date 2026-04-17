import toast from 'react-hot-toast';
import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { MessageSquare, Plus, Send } from 'lucide-react';

export default function Support() {
  const { user, profile } = useAuthStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachmentUrl, setReplyAttachmentUrl] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'tickets'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'tickets'), {
        userId: user.uid,
        subject,
        status: 'open',
        messages: [{
          senderId: user.uid,
          senderName: profile?.name || 'User',
          message,
          attachmentUrl: attachmentUrl || null,
          timestamp: new Date().toISOString()
        }],
        createdAt: serverTimestamp()
      });
      setSubject('');
      setMessage('');
      setAttachmentUrl('');
      toast.success('تم فتح التذكرة بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ');
    }
    setLoading(false);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeTicket) return;
    try {
      const newMessages = [...activeTicket.messages, {
        senderId: user.uid,
        senderName: profile?.name || 'User',
        message: replyMessage,
        attachmentUrl: replyAttachmentUrl || null,
        timestamp: new Date().toISOString()
      }];
      await updateDoc(doc(db, 'tickets', activeTicket.id), {
        messages: newMessages,
        status: 'in_progress'
      });
      setReplyMessage('');
      setReplyAttachmentUrl('');
    } catch (error) {
      console.error(error);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-1/3">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Plus className="w-5 h-5"/> تذكرة جديدة</h3>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <input type="text" placeholder="الموضوع" required value={subject} onChange={e => setSubject(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
            <textarea placeholder="الرسالة" required value={message} onChange={e => setMessage(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 h-24"></textarea>
            <input type="url" placeholder="رابط المرفق (صورة/ملف) - اختياري" value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" />
            <button type="submit" disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">إرسال</button>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-lg mb-4">تذاكري</h3>
          <div className="space-y-2">
            {tickets.map(ticket => (
              <button key={ticket.id} onClick={() => setActiveTicket(ticket)} className={`w-full text-right p-3 rounded-xl border transition-colors ${activeTicket?.id === ticket.id ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-750'}`}>
                <p className="font-semibold truncate">{ticket.subject}</p>
                <div className="flex justify-between items-center mt-2 text-xs">
                  <span className={`px-2 py-1 rounded-md ${ticket.status === 'open' ? 'bg-green-100 text-green-700' : ticket.status === 'closed' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'}`}>
                    {ticket.status}
                  </span>
                  <span className="text-gray-400">{new Date(ticket.createdAt?.toDate()).toLocaleDateString('ar-EG')}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full md:w-2/3">
        {activeTicket ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-xl">{activeTicket.subject}</h3>
              <p className="text-sm text-gray-500">حالة التذكرة: {activeTicket.status}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTicket.messages?.map((msg: any, idx: number) => (
                <div key={idx} className={`flex flex-col ${msg.senderId === user.uid ? 'items-start' : 'items-end'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl ${msg.senderId === user.uid ? 'bg-blue-100 text-blue-900 rounded-tr-none' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-none'}`}>
                    <p className="text-xs font-bold mb-1 opacity-70">{msg.senderName}</p>
                    <p>{msg.message}</p>
                    {msg.attachmentUrl && (
                      <a href={msg.attachmentUrl} target="_blank" rel="noreferrer" className="block mt-2 text-xs text-blue-600 hover:underline">
                        عرض المرفق
                      </a>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 mt-1">{new Date(msg.timestamp).toLocaleString('ar-EG')}</span>
                </div>
              ))}
            </div>
            {activeTicket.status !== 'closed' && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                <form onSubmit={handleReply} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input type="text" required value={replyMessage} onChange={e => setReplyMessage(e.target.value)} placeholder="اكتب ردك هنا..." className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700" />
                    <button type="submit" className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"><Send className="w-5 h-5"/></button>
                  </div>
                  <input type="url" value={replyAttachmentUrl} onChange={e => setReplyAttachmentUrl(e.target.value)} placeholder="رابط المرفق (اختياري)" className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm" />
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-[600px] flex flex-col items-center justify-center text-gray-500">
            <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
            <p>اختر تذكرة لعرض التفاصيل أو قم بإنشاء تذكرة جديدة</p>
          </div>
        )}
      </div>
    </div>
  );
}
