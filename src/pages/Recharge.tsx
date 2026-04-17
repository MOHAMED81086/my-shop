import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { collection, getDocs, addDoc, serverTimestamp, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CreditCard, Upload, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Recharge() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [gateways, setGateways] = useState<any[]>([]);
  const [shippingMethods, setShippingMethods] = useState<any[]>([]);
  const [selectedGatewayId, setSelectedGatewayId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<any>({ rechargeEnabled: true });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchGateways = async () => {
      const gSnap = await getDocs(collection(db, 'gateways'));
      const activeGateways = gSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((g: any) => g.isActive);
      
      const mSnap = await getDocs(collection(db, 'shipping_methods'));
      const activeMethods = mSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((m: any) => m.isActive);
      
      setGateways(activeGateways);
      setShippingMethods(activeMethods);
      
      if (activeGateways.length > 0) {
        setSelectedGatewayId(activeGateways[0].id);
      }
    };
    fetchGateways();

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), snap => {
      if (snap.exists()) setGlobalSettings(snap.data());
    });

    return () => unsubSettings();
  }, []);

  const selectedGateway = gateways.find(g => g.id === selectedGatewayId);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!globalSettings.rechargeEnabled) {
      toast.error('نظام الشحن متوقف حالياً من قبل الإدارة.');
      return;
    }
    if (!selectedGateway) {
      toast.error('الرجاء اختيار وسيلة دفع');
      return;
    }

    const numAmount = Number(amount);
    if (numAmount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'recharge_requests'), {
        userId: user.uid,
        amount: numAmount,
        transactionId,
        gatewayId: selectedGateway.id,
        paymentProofImage: proofUrl || 'https://via.placeholder.com/150',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Update gateway usage
      await updateDoc(doc(db, 'gateways', selectedGateway.id), {
        usedWeekly: selectedGateway.usedWeekly + numAmount,
        usedMonthly: selectedGateway.usedMonthly + numAmount
      });

      // Notify admin
      await addDoc(collection(db, 'notifications'), {
        userId: 'admin',
        message: `طلب شحن جديد بقيمة ${numAmount} ج.م من ${profile.name}`,
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success('تم إرسال طلب الشحن بنجاح. سيتم مراجعته قريباً.');
      navigate('/wallet');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'حدث خطأ أثناء إرسال الطلب');
    }
    setLoading(false);
  };

  if (!globalSettings.rechargeEnabled) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="bg-red-50 text-red-700 p-8 rounded-2xl flex flex-col items-center">
          <AlertCircle className="w-16 h-16 mb-4" />
          <h2 className="text-2xl font-bold mb-2">نظام الشحن متوقف</h2>
          <p>نعتذر، تم إيقاف نظام الشحن مؤقتاً من قبل الإدارة. يرجى المحاولة لاحقاً.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">شحن الرصيد</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Info Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              بيانات الحساب
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">اسم المستخدم (Username)</label>
                <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl font-medium text-gray-800 dark:text-gray-200">
                  {profile?.name}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">معرف الحساب (User ID)</label>
                <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl font-mono text-sm text-gray-800 dark:text-gray-200 flex justify-between items-center">
                  <span>{user?.uid}</span>
                  <button onClick={() => handleCopy(user?.uid || '')} className="text-blue-600 hover:text-blue-700">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recharge Form */}
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Payment Method Selection */}
              <div>
                <label className="block text-sm font-bold mb-2">اختر وسيلة الدفع</label>
                <div className="grid grid-cols-2 gap-3">
                  {gateways.map(gw => {
                    const method = shippingMethods.find(m => m.id === gw.methodId);
                    return (
                      <button
                        key={gw.id}
                        type="button"
                        onClick={() => setSelectedGatewayId(gw.id)}
                        className={`p-4 rounded-xl border-2 text-center transition-all ${selectedGatewayId === gw.id ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}
                      >
                        <span className="block font-bold">{method?.name || 'وسيلة دفع'}</span>
                        <span className="text-xs opacity-70 font-mono">{gw.phone}</span>
                      </button>
                    );
                  })}
                  {gateways.length === 0 && (
                    <div className="col-span-2 p-4 text-center text-red-600 bg-red-50 rounded-xl">
                      لا توجد بوابات دفع متاحة حالياً
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Gateway Details */}
              {selectedGateway && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">يرجى تحويل المبلغ إلى الرقم التالي:</p>
                  <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                    <span className="font-mono text-xl font-bold tracking-wider">{selectedGateway.phone}</span>
                    <button type="button" onClick={() => handleCopy(selectedGateway.phone)} className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm font-medium">
                      {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'تم النسخ' : 'نسخ'}
                    </button>
                  </div>
                </div>
              )}

              {/* Recharge Details */}
              <div className="space-y-4">
                {globalSettings.rechargeFee > 0 && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl text-sm text-orange-800 dark:text-orange-200">
                    <p>يتم خصم {globalSettings.rechargeFee}% كرسوم خدمة عند شحن الرصيد.</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold mb-1">المبلغ المحول (ج.م)</label>
                  <input 
                    type="number" 
                    required 
                    min="10"
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="مثال: 500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">رقم العملية (Transaction ID)</label>
                  <input 
                    type="text" 
                    required 
                    value={transactionId} 
                    onChange={e => setTransactionId(e.target.value)} 
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    placeholder="رقم التحويل أو رقم الموبايل المحول منه"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">صورة إثبات الدفع (اختياري)</label>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const MAX_WIDTH = 600;
                              const MAX_HEIGHT = 600;
                              let width = img.width;
                              let height = img.height;

                              if (width > height) {
                                if (width > MAX_WIDTH) {
                                  height *= MAX_WIDTH / width;
                                  width = MAX_WIDTH;
                                }
                              } else {
                                if (height > MAX_HEIGHT) {
                                  width *= MAX_HEIGHT / height;
                                  height = MAX_HEIGHT;
                                }
                              }
                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx?.drawImage(img, 0, 0, width, height);
                              const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                              setProofUrl(dataUrl);
                            };
                            img.src = ev.target?.result as string;
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="flex-1 p-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  {proofUrl && (
                    <div className="mt-2">
                      <img src={proofUrl} alt="Proof" className="h-32 object-contain rounded-lg border border-gray-200" />
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">سيتم ضغط الصورة تلقائياً لتسريع الرفع.</p>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading || !selectedGateway}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'جاري الإرسال...' : 'إرسال طلب الشحن'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
