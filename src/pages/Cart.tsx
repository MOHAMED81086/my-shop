import React, { useState, useEffect } from 'react';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { Trash2, Plus, Minus, ShoppingBag, Upload, Wallet, CreditCard } from 'lucide-react';
import { collection, addDoc, serverTimestamp, updateDoc, doc, getDocs, query, where, getDoc, setDoc, increment, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { checkFraud } from '../lib/fraud';

export default function Cart() {
  const { items, removeItem, updateQuantity, clearCart, totalPrice } = useCartStore();
  const { user, profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'transfer'>('wallet');
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [gateways, setGateways] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGateways = async () => {
      const snap = await getDocs(collection(db, 'gateways'));
      setGateways(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchGateways();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('حجم الصورة يجب أن يكون أقل من 2 ميجابايت');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCheckout = async () => {
    if (!user || !profile) {
      toast.error('يرجى تسجيل الدخول أولاً');
      return;
    }
    
    const total = totalPrice();

    if (paymentMethod === 'wallet' && profile.wallet_balance < total) {
      toast.error('رصيدك غير كافٍ لإتمام هذه العملية');
      return;
    }

    if (paymentMethod === 'transfer' && (!proofImage || !transactionId)) {
      toast.error('يرجى إدخال رقم التحويل ورفع إثبات الدفع');
      return;
    }

    setLoading(true);
    try {
      let deliveredItems: any[] = [];
      let isInstantDelivery = paymentMethod === 'wallet';
      
      // Fraud Check
      const merchantIds = Array.from(new Set(items.map(item => item.product.merchantId).filter(Boolean)));
      let isSuspicious = false;
      let suspicionReason = null;

      for (const mId of merchantIds) {
        const res = await checkFraud(user.uid, mId as string);
        if (res.isSuspicious) {
          isSuspicious = true;
          suspicionReason = res.reason;
          break;
        }
      }

      const batch = writeBatch(db);
      const orderId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      const orderStatus = isSuspicious ? 'pending_review' : (isInstantDelivery ? 'completed' : 'pending');

      if (isInstantDelivery && !isSuspicious) {
        for (const item of items) {
          const product = item.product;
          const quantity = item.quantity;
          let deliveredForThisProduct: any = {
            productId: product.id,
            title: product.title,
            deliveryType: product.deliveryType,
            items: []
          };

          if (product.deliveryType === 'code') {
            const codesToDeliver = product.codePool.slice(0, quantity);
            deliveredForThisProduct.items = codesToDeliver;
            batch.update(doc(db, 'products', product.id), {
              codePool: product.codePool.slice(quantity),
              stock: increment(-quantity)
            });
          } else if (product.deliveryType === 'account') {
            const accountsToDeliver = product.accountList.slice(0, quantity);
            deliveredForThisProduct.items = accountsToDeliver;
            batch.update(doc(db, 'products', product.id), {
              accountList: product.accountList.slice(quantity),
              stock: increment(-quantity)
            });
          } else if (product.deliveryType === 'file') {
            deliveredForThisProduct.items = [product.fileUrl];
            batch.update(doc(db, 'products', product.id), {
              stock: increment(-quantity)
            });
          } else if (product.deliveryType === 'link') {
            deliveredForThisProduct.items = [product.downloadLink];
            batch.update(doc(db, 'products', product.id), {
              stock: increment(-quantity)
            });
          }

          deliveredItems.push(deliveredForThisProduct);

          // Notify merchant
          batch.set(doc(collection(db, 'notifications')), {
            userId: product.merchantId,
            message: `تم بيع ${quantity} من منتجك ${product.title}.`,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      } else {
        // Update stock for pending orders
        for (const item of items) {
          batch.update(doc(db, 'products', item.product.id), {
            stock: increment(-item.quantity)
          });
          
          // Notify merchant
          batch.set(doc(collection(db, 'notifications')), {
            userId: item.product.merchantId,
            message: `تم طلب ${item.quantity} من منتجك ${item.product.title}`,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }

      // 1. Create Order
      batch.set(doc(db, 'orders', orderId), {
        userId: user.uid,
        products: items.map(item => ({
          productId: item.product.id,
          title: item.product.title,
          price: item.product.price,
          quantity: item.quantity,
          image: item.product.images?.[0] || null,
          merchantId: item.product.merchantId || null
        })),
        totalPrice: total,
        status: orderStatus,
        isSuspicious,
        suspicionReason,
        paymentMethod,
        paymentProofImage: paymentMethod === 'transfer' ? proofImage : null,
        transactionId: paymentMethod === 'transfer' ? transactionId : null,
        deliveredItems: (isInstantDelivery && !isSuspicious) ? deliveredItems : [],
        createdAt: serverTimestamp()
      });

      if (paymentMethod === 'wallet') {
        // 2. Update Buyer Balance and Points
        const earnedPoints = 10 + Math.floor(total / 1000) * 10;
        
        const userUpdate: any = {
          wallet_balance: increment(-total),
          points: increment(earnedPoints),
          eventPoints: increment(earnedPoints) // Leaderboard points
        };

        // Referral Logic: Check if this is the first purchase > 100
        if (profile.referredBy && !profile.referralPurchased && total >= 100) {
          userUpdate.referralPurchased = true;
          
          // If they already charged > 100, complete the referral
          if (profile.referralCharged) {
            userUpdate.referralCompleted = true;
            // Reward the referrer
            batch.update(doc(db, 'users', profile.referredBy), {
              points: increment(10),
              eventPoints: increment(10)
            });
            // Notify referrer
            batch.set(doc(collection(db, 'notifications')), {
              userId: profile.referredBy,
              message: `لقد حصلت على 10 نقاط مكافأة لأن ${profile.name} أتم شروط الإحالة!`,
              read: false,
              createdAt: serverTimestamp()
            });
          }
        }

        batch.update(doc(db, 'users', user.uid), userUpdate);

        // 3. Pay merchants immediately if not suspicious
        if (!isSuspicious) {
          const merchantProfits: Record<string, number> = {};
          
          // Fetch all ranks for commission calculation
          const ranksSnap = await getDocs(collection(db, 'ranks'));
          const ranks = ranksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          for (const item of items) {
            if (item.product.merchantId) {
              const merchantRef = doc(db, 'users', item.product.merchantId);
              const merchantSnap = await getDoc(merchantRef);
              const merchantData = merchantSnap.data();
              
              const merchantRank = ranks.find(r => r.id === merchantData?.role) as any || { commissionPercentage: 0 };
              const commission = (merchantRank.commissionPercentage || 0) + 2; // Base 2% + custom rank percentage
              const netProfit = (item.product.price * item.quantity) * (1 - commission / 100);
              
              merchantProfits[item.product.merchantId] = (merchantProfits[item.product.merchantId] || 0) + netProfit;
            }
          }
          
          for (const [merchantId, profit] of Object.entries(merchantProfits)) {
            // Only pay if not buying from self
            if (merchantId !== user.uid) {
              batch.update(doc(db, 'users', merchantId), {
                merchant_balance: increment(profit)
              });
              batch.set(doc(collection(db, 'wallet_transactions')), {
                userId: merchantId,
                type: 'profit',
                amount: profit,
                status: 'completed',
                referenceId: orderId,
                details: `أرباح من مبيعات سلة المشتريات`,
                createdAt: serverTimestamp()
              });
            }
            
            // 4. Increment Purchase Count (Trust System)
            if (merchantId) {
              const trustDocId = `${user.uid}_${merchantId}`;
              const trustRef = doc(db, 'buyer_merchant_trust', trustDocId);
              const trustSnap = await getDoc(trustRef);
              
              if (!trustSnap.exists()) {
                batch.set(trustRef, {
                  buyerId: user.uid,
                  merchantId,
                  currentCount: 1,
                  approvedLimit: 5,
                  updatedAt: serverTimestamp()
                });
              } else {
                batch.update(trustRef, {
                  currentCount: increment(1),
                  updatedAt: serverTimestamp()
                });
              }
            }
          }
        }

        // 5. Record Wallet Transaction
        batch.set(doc(collection(db, 'wallet_transactions')), {
          userId: user.uid,
          type: 'purchase',
          amount: -total,
          status: 'completed',
          referenceId: orderId,
          details: `شراء منتجات من السلة${isSuspicious ? ' (قيد المراجعة الأمنية)' : ''}`,
          createdAt: serverTimestamp()
        });
      }

      // Commit Batch
      await batch.commit();

      // Notify user
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        message: isSuspicious 
          ? `تم تعليق طلبك للمراجعة الأمنية`
          : (isInstantDelivery ? `تم إتمام الطلب وتسليم المنتجات بنجاح بقيمة ${total} ج.م` : `تم إرسال طلبك بنجاح بقيمة ${total} ج.م وجاري مراجعته`),
        read: false,
        createdAt: serverTimestamp()
      });

      if (isSuspicious) {
        toast.error('تم تعليق الطلب للمراجعة الأمنية: ' + suspicionReason, { duration: 5000 });
        // Notify admin
        await addDoc(collection(db, 'notifications'), {
          userId: 'admin',
          message: `تنبيه أمني: طلب سلة جديد ${orderId} يتطلب مراجعة. السبب: ${suspicionReason}`,
          read: false,
          createdAt: serverTimestamp()
        });
      } else {
        toast.success(isInstantDelivery ? 'تم الشراء والتسليم بنجاح!' : 'تم إرسال الطلب بنجاح!');
      }

      clearCart();
      navigate('/my-activity');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الشراء');
    }
    setLoading(false);
  };

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center py-20">
        <ShoppingBag className="w-24 h-24 mx-auto text-gray-300 mb-6" />
        <h2 className="text-2xl font-bold mb-2">سلة المشتريات فارغة</h2>
        <p className="text-gray-500 mb-8">تصفح المنتجات وأضف ما يعجبك إلى السلة.</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">
          تصفح المنتجات
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">سلة المشتريات</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-4">
          {items.map(item => (
            <div key={item.product.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex gap-4">
              <div className="w-24 h-24 bg-gray-100 dark:bg-gray-750 rounded-xl overflow-hidden flex-shrink-0">
                {item.product.images?.[0] ? (
                  <img src={item.product.images[0]} alt={item.product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">لا توجد صورة</div>
                )}
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg">{item.product.title}</h3>
                  <button onClick={() => removeItem(item.product.id)} className="text-red-500 hover:text-red-700 p-1">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex justify-between items-end">
                  <p className="font-bold text-blue-600">{item.product.price} ج.م</p>
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-750 p-1 rounded-lg">
                    <button 
                      onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-bold w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.product.id, Math.min(item.product.stock, item.quantity + 1))}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="md:col-span-1">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 sticky top-24">
            <h3 className="font-bold text-xl mb-6">ملخص الطلب</h3>
            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>المجموع الفرعي</span>
                <span>{totalPrice()} ج.م</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>رسوم التوصيل</span>
                <span>مجاناً</span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between font-bold text-lg">
                <span>الإجمالي</span>
                <span className="text-blue-600">{totalPrice()} ج.م</span>
              </div>
            </div>
            <button 
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'جاري التنفيذ...' : 'إتمام الشراء'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
