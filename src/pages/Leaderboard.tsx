import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trophy, Medal, Award, Users } from 'lucide-react';

export default function Leaderboard() {
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy('eventPoints', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTopUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-12">
        <div className="inline-block p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl mb-4">
          <Trophy className="w-12 h-12 text-yellow-600" />
        </div>
        <h1 className="text-4xl font-bold mb-2">لوحة المتصدرين (الحدث الحالي)</h1>
        <p className="text-gray-500">أكثر المستخدمين تفاعلاً وكسباً للنقاط في المتجر</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-gray-700 dark:text-gray-300">
            <Users className="w-5 h-5" />
            <span>المتصدرين</span>
          </div>
          <span className="text-sm text-gray-500">يتم التحديث لحظياً</span>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {loading ? (
            <div className="p-12 text-center text-gray-400">جاري تحميل البيانات...</div>
          ) : topUsers.length === 0 ? (
            <div className="p-12 text-center text-gray-400">لا يوجد متسابقين حالياً</div>
          ) : (
            topUsers.map((user, index) => (
              <div key={user.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                <div className="w-10 text-center font-bold text-lg">
                  {index === 0 ? <Medal className="w-8 h-8 text-yellow-500 mx-auto" /> :
                   index === 1 ? <Medal className="w-8 h-8 text-gray-400 mx-auto" /> :
                   index === 2 ? <Medal className="w-8 h-8 text-orange-400 mx-auto" /> :
                   <span className="text-gray-400">#{index + 1}</span>}
                </div>
                
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold overflow-hidden">
                  {user.photoUrl ? <img src={user.photoUrl} alt="" className="w-full h-full object-cover" /> : user.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1">
                  <h3 className="font-bold text-gray-800 dark:text-gray-200">{user.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">ID: {user.numericId || user.id.substring(0, 8)}</p>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 text-blue-600 font-bold text-lg">
                    <Award className="w-5 h-5" />
                    <span>{user.eventPoints || 0}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">نقطة حدث</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">كيف تتصدر القائمة؟</h4>
        <p className="text-sm text-blue-700 dark:text-blue-400">
          كل عملية شراء تمنحك 10 نقاط أساسية + 10 نقاط لكل 1000 ج.م من قيمة المشتريات. كما يمكنك كسب النقاط من خلال دعوة أصدقائك للمتجر!
        </p>
      </div>
    </div>
  );
}
