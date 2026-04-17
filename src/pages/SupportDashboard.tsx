import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { MessageSquare, Send, Trash2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupportDashboard() {
  const { user, profile } = useAuthStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachmentUrl, setReplyAttachmentUrl] = useState('');

  const [unreadCount, setUnreadCount] = useState(0);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const isBaseSupport = ['support', 'admin'].includes(profile?.role || '');
    
    const verifyAccess = async () => {
      if (isBaseSupport) {
        setHasAccess(true);
        return;
      }
      if (!profile?.role) {
        setHasAccess(false);
        return;
      }
      const { getDoc } = await import('firebase/firestore');
      const rankSnap = await getDoc(doc(db, 'ranks', profile.role));
      setHasAccess(rankSnap.exists() && rankSnap.data()?.canSupport === true);
    };

    verifyAccess();
  }, [profile]);

  useEffect(() => {
    if (hasAccess) {
      const unsubTickets = onSnapshot(query(collection(db, 'tickets'), orderBy('createdAt', 'desc')), snap => {
        setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsubTickets();
    }
  }, [hasAccess]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !replyMessage) return;
    
    try {
      const newMessages = [...activeTicket.messages, {
        senderId: user?.uid,
        senderName: profile?.name || 'Support',
        message: replyMessage,
        attachmentUrl: replyAttachmentUrl || null,
        timestamp: new Date().toISOString()
      }];
      
      await updateDoc(doc(db, 'tickets', activeTicket.id), {
        messages: newMessages,
        status: 'in_progress'
      });
      
      await addDoc(collection(db, 'notifications'), {
        userId: activeTicket.userId,
        message: `تم الرد على تذكرتك: ${activeTicket.subject}`,
        read: false,
        createdAt: serverTimestamp()
      });
      
      setReplyMessage('');
      setReplyAttachmentUrl('');
      toast.success('تم إرسال الرد');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء إرسال الرد');
    }
  };

  const closeTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), { status: 'closed' });
      toast.success('تم إغلاق التذكرة');
    } catch (error) {
      console.error(error);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    try {
      await deleteDoc(doc(db, 'tickets', ticketId));
      setActiveTicket(null);
      toast.success('تم حذف التذكرة');
    } catch (error) {
      console.error(error);
    }
  };

  if (hasAccess === null) return <div className="p-8 text-center text-blue-500">جاري التحقق من الصلاحيات...</div>;
  if (!hasAccess) {
    return <div className="p-8 text-center text-red-500">غير مصرح لك بالدخول</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <MessageSquare className="w-8 h-8 text-blue-600" />
        لوحة الدعم الفني
      </h2>
      
      <div className="flex flex-col md:flex-row gap-6 h-[700px]">
        <div className="w-full md:w-1/3 flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-xl font-bold mb-4">التذاكر</h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {tickets?.map(ticket => (
              <button 
                key={ticket.id} 
                onClick={() => setActiveTicket(ticket)}
                className={`w-full text-right p-4 rounded-xl border transition-colors ${activeTicket?.id === ticket.id ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-750'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold truncate">{ticket.subject}</h4>
                  <span className={`px-2 py-1 rounded-md text-xs whitespace-nowrap ${ticket.status === 'open' ? 'bg-green-100 text-green-700' : ticket.status === 'closed' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-700'}`}>
                    {ticket.status === 'open' ? 'مفتوحة' : ticket.status === 'closed' ? 'مغلقة' : 'قيد المعالجة'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">User ID: {ticket.userId}</p>
              </button>
            ))}
            {tickets.length === 0 && <p className="text-gray-500 text-center mt-8">لا توجد تذاكر</p>}
          </div>
        </div>
        
        <div className="w-full md:w-2/3 flex flex-col bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
          {activeTicket ? (
            <>
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">{activeTicket.subject}</h3>
                  <p className="text-sm text-gray-500">User ID: {activeTicket.userId}</p>
                </div>
                <div className="flex gap-2">
                  {activeTicket.status !== 'closed' && (
                    <button onClick={() => closeTicket(activeTicket.id)} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> إغلاق
                    </button>
                  )}
                  <button onClick={() => deleteTicket(activeTicket.id)} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 flex items-center gap-1">
                    <Trash2 className="w-4 h-4" /> حذف
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {activeTicket.messages?.map((msg: any, idx: number) => (
                  <div key={idx} className={`flex flex-col ${msg.senderId === activeTicket.userId ? 'items-start' : 'items-end'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-4 ${msg.senderId === activeTicket.userId ? 'bg-gray-100 dark:bg-gray-700 rounded-tr-none' : 'bg-blue-600 text-white rounded-tl-none'}`}>
                      <p className="text-sm font-bold mb-1 opacity-70">{msg.senderName}</p>
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                      {msg.attachmentUrl && (
                        <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mt-2 text-sm underline opacity-80 hover:opacity-100">
                          عرض المرفق
                        </a>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 mt-1">{new Date(msg.timestamp).toLocaleString('ar-EG')}</span>
                  </div>
                ))}
              </div>
              {activeTicket.status !== 'closed' && (
                <form onSubmit={handleReply} className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                  <div className="flex flex-col gap-2">
                    <textarea 
                      value={replyMessage}
                      onChange={e => setReplyMessage(e.target.value)}
                      placeholder="اكتب ردك هنا..."
                      className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 resize-none h-24"
                      required
                    />
                    <div className="flex gap-2">
                      <input 
                        type="url" 
                        value={replyAttachmentUrl}
                        onChange={e => setReplyAttachmentUrl(e.target.value)}
                        placeholder="رابط مرفق (اختياري)"
                        className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                      />
                      <button type="submit" className="px-6 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
                        <Send className="w-4 h-4" /> إرسال
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-4">
              <MessageSquare className="w-16 h-16 opacity-20" />
              <p>اختر تذكرة لعرض التفاصيل</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
