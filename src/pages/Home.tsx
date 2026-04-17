import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, doc, updateDoc, addDoc, serverTimestamp, getDocs, where, setDoc, increment, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useCartStore } from '../store/useCartStore';
import { checkFraud } from '../lib/fraud';
import { ShoppingCart, Star, Search, Plus, Filter, ArrowUpDown, Layers, Check, X, Trophy, Activity, Clock } from 'lucide-react';

import toast from 'react-hot-toast';

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const { user, profile } = useAuthStore();
  const { addItem } = useCartStore();
  const [buying, setBuying] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_low' | 'price_high' | 'rating'>('newest');
  const [showFilters, setShowFilters] = useState(false);
  
  const [compareList, setCompareList] = useState<any[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const [reviews, setReviews] = useState<Record<string, any[]>>({});
  const [reviewingProduct, setReviewingProduct] = useState<any | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribeProducts = onSnapshot(q, async (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);

      // Fetch reviews for all products
      const reviewsObj: Record<string, any[]> = {};
      for (const p of prods) {
        const rSnap = await getDocs(query(collection(db, 'reviews'), where('productId', '==', p.id)));
        reviewsObj[p.id] = rSnap.docs.map(d => d.data());
      }
      setReviews(reviewsObj);
    });

    const unsubscribeAds = onSnapshot(query(collection(db, 'ads'), where('isActive', '==', true)), (snapshot) => {
      setAds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeEvents = onSnapshot(query(collection(db, 'admin_events'), where('active', '==', true), orderBy('createdAt', 'desc')), (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubscribeProducts(); unsubscribeAds(); unsubscribeEvents(); };
  }, []);

  const handlePurchase = async (product: any) => {
    if (!user || !profile) {
      toast.error('يرجى تسجيل الدخول أولاً');
      return;
    }
    
    window.dispatchEvent(new Event('show-ad'));
    // Wholesale Price Logic - Only for files and links
    let finalPrice = product.price;
    if ((product.deliveryType === 'file' || product.deliveryType === 'link') && product.wholesalePrice && product.wholesaleMinQty && 1 >= product.wholesaleMinQty) {
      finalPrice = product.wholesalePrice;
    }

    if (profile.wallet_balance < finalPrice) {
      toast.error('رصيدك غير كافٍ لإتمام هذه العملية');
      return;
    }
    if (product.stock <= 0) {
      toast.error('هذا المنتج غير متوفر حالياً');
      return;
    }
    
    // Optimistic UI Update
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: p.stock - 1 } : p));
    toast.success('تم الشراء بنجاح! جاري معالجة الطلب...', { duration: 3000 });
    
    setBuying(product.id);
    try {
      // Fraud Check
      const fraudResult = await checkFraud(user.uid, product.merchantId);
      const isSuspicious = fraudResult.isSuspicious;

      // Create order ID
      const orderId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
      const orderStatus = isSuspicious ? 'pending_review' : 'completed';

      const batch = writeBatch(db);
      let deliveredItems: any[] = [];

      // Handle instant delivery if not suspicious
      if (!isSuspicious) {
        let deliveredForThisProduct: any = {
          productId: product.id,
          title: product.title,
          deliveryType: product.deliveryType,
          items: []
        };

        if (product.deliveryType === 'code') {
          // Double Code Logic: Deliver 2 codes if isDoubleCode is true
          const countToDeliver = product.isDoubleCode ? 2 : 1;
          const codesToDeliver = product.codePool.slice(0, countToDeliver);
          deliveredForThisProduct.items = codesToDeliver;
          
          // Usage Count Note
          if (product.usageCount > 1) {
            deliveredForThisProduct.usageNote = `هذا الكود يعمل لعدد ${product.usageCount} مرات استخدام`;
          }

          batch.update(doc(db, 'products', product.id), {
            codePool: product.codePool.slice(countToDeliver),
            stock: increment(-1),
            salesCount: increment(1)
          });
        } else if (product.deliveryType === 'account') {
          const countToDeliver = product.isDoubleCode ? 2 : 1; // Reuse isDoubleCode for accounts too
          const accountsToDeliver = product.accountList.slice(0, countToDeliver);
          deliveredForThisProduct.items = accountsToDeliver;
          batch.update(doc(db, 'products', product.id), {
            accountList: product.accountList.slice(countToDeliver),
            stock: increment(-1),
            salesCount: increment(1)
          });
        } else if (product.deliveryType === 'file') {
          deliveredForThisProduct.items = [product.fileUrl];
          batch.update(doc(db, 'products', product.id), {
            // File products don't lose stock
            salesCount: increment(1)
          });
        } else if (product.deliveryType === 'link') {
          deliveredForThisProduct.items = [product.downloadLink];
          batch.update(doc(db, 'products', product.id), {
            // Link products don't lose stock
            salesCount: increment(1)
          });
        }
        deliveredItems.push(deliveredForThisProduct);
      } else {
        // Just update stock if suspicious
        batch.update(doc(db, 'products', product.id), {
          stock: increment(-1),
          salesCount: increment(1)
        });
      }

      // 1. Create Order
      batch.set(doc(db, 'orders', orderId), {
        userId: user.uid,
        products: [{
          productId: product.id,
          title: product.title,
          price: finalPrice,
          quantity: 1,
          image: product.images?.[0] || null,
          merchantId: product.merchantId || null
        }],
        totalPrice: finalPrice,
        status: orderStatus,
        isSuspicious,
        suspicionReason: fraudResult.reason,
        deliveredItems: !isSuspicious ? deliveredItems : [],
        createdAt: serverTimestamp()
      });

      // 2. Update Buyer Balance and Points
      batch.update(doc(db, 'users', user.uid), {
        wallet_balance: increment(-finalPrice),
        points: increment(Math.floor(finalPrice))
      });

      // 3. Update Merchant Balance (if not suspicious and not buying from self)
      if (!isSuspicious && product.merchantId && product.merchantId !== user.uid) {
        batch.update(doc(db, 'users', product.merchantId), {
          merchant_balance: increment(finalPrice)
        });
      }

      // 4. Record Wallet Transaction
      batch.set(doc(collection(db, 'wallet_transactions')), {
        userId: user.uid,
        type: 'purchase',
        amount: -product.price,
        status: 'completed',
        referenceId: orderId,
        details: `شراء منتج: ${product.title}${isSuspicious ? ' (قيد المراجعة الأمنية)' : ''}`,
        createdAt: serverTimestamp()
      });

      // 6. Increment Purchase Count (Trust System)
      if (product.merchantId) {
        const trustDocId = `${user.uid}_${product.merchantId}`;
        const trustRef = doc(db, 'buyer_merchant_trust', trustDocId);
        const trustSnap = await getDoc(trustRef);
        
        if (!trustSnap.exists()) {
          batch.set(trustRef, {
            buyerId: user.uid,
            merchantId: product.merchantId,
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

      // Commit Batch
      await batch.commit();

      if (isSuspicious) {
        toast.error('تم تعليق الطلب للمراجعة الأمنية: ' + fraudResult.reason, { duration: 5000 });
      } else {
        toast.success('تم الشراء بنجاح!');
      }

      // Notify user
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        message: isSuspicious 
          ? `تم تعليق طلبك ${product.title} للمراجعة الأمنية` 
          : `تم شراء المنتج ${product.title} بنجاح`,
        read: false,
        createdAt: serverTimestamp()
      });

      // Notify merchant
      await addDoc(collection(db, 'notifications'), {
        userId: product.merchantId,
        message: isSuspicious
          ? `طلب جديد ${product.title} قيد المراجعة الأمنية`
          : `تم بيع منتجك ${product.title} وتم إضافة الرصيد لمحفظتك`,
        read: false,
        createdAt: serverTimestamp()
      });

      // Notify admin if suspicious
      if (isSuspicious) {
        await addDoc(collection(db, 'notifications'), {
          userId: 'admin',
          message: `تنبيه أمني: طلب جديد ${orderId} يتطلب مراجعة فورية. السبب: ${fraudResult.reason}`,
          read: false,
          createdAt: serverTimestamp()
        });
      }

    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء الشراء. يرجى المحاولة مرة أخرى.');
      // Revert optimistic UI update
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: p.stock + 1 } : p));
    }
    setBuying(null);
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reviewingProduct) return;

    try {
      // Check if user bought the product
      const ordersSnap = await getDocs(query(collection(db, 'orders'), where('userId', '==', user.uid)));
      const hasBought = ordersSnap.docs.some(d => {
        const order = d.data();
        return order.products.some((p: any) => p.productId === reviewingProduct.id);
      });

      if (!hasBought) {
        toast.error('يجب شراء المنتج أولاً لتتمكن من تقييمه');
        return;
      }

      await addDoc(collection(db, 'reviews'), {
        userId: user.uid,
        productId: reviewingProduct.id,
        rating,
        comment,
        createdAt: serverTimestamp()
      });

      // Update product rating average
      const productReviews = [...(reviews[reviewingProduct.id] || []), { rating }];
      const avg = productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length;
      
      await updateDoc(doc(db, 'products', reviewingProduct.id), {
        ratingAverage: avg
      });

      toast.success('تم إضافة التقييم بنجاح');
      setReviewingProduct(null);
      setComment('');
      setRating(5);
      
      // Refresh reviews
      const rSnap = await getDocs(query(collection(db, 'reviews'), where('productId', '==', reviewingProduct.id)));
      setReviews(prev => ({...prev, [reviewingProduct.id]: rSnap.docs.map(d => d.data())}));
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ');
    }
  };

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category || 'general')))];

  const filteredProducts = products
    .filter(p => 
      p.isActive !== false && 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selectedCategory === 'all' || (p.category || 'general') === selectedCategory) &&
      (!minPrice || p.price >= Number(minPrice)) &&
      (!maxPrice || p.price <= Number(maxPrice))
    )
    .sort((a, b) => {
      if (sortBy === 'newest') return b.createdAt?.toMillis() - a.createdAt?.toMillis();
      if (sortBy === 'price_low') return a.price - b.price;
      if (sortBy === 'price_high') return b.price - a.price;
      if (sortBy === 'rating') return (b.ratingAverage || 0) - (a.ratingAverage || 0);
      return 0;
    });

  const toggleCompare = (product: any) => {
    if (compareList.find(p => p.id === product.id)) {
      setCompareList(prev => prev.filter(p => p.id !== product.id));
    } else {
      if (compareList.length >= 3) {
        toast.error('يمكنك مقارنة 3 منتجات كحد أقصى');
        return;
      }
      setCompareList(prev => [...prev, product]);
    }
  };

  return (
    <div>
      <div className="mb-8 bg-blue-600 text-white rounded-2xl p-8 text-center sm:text-right flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-4xl font-bold mb-4">مرحباً بك في متجري</h1>
          <p className="text-lg opacity-90">اكتشف أفضل المنتجات بأسعار تنافسية مع نظام دفع آمن ومحفظة متكاملة.</p>
        </div>
        <div className="flex flex-col gap-4 w-full md:w-96">
          <div className="relative text-gray-900">
            <input 
              type="text" 
              placeholder="ابحث عن منتج..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border-none focus:ring-4 focus:ring-blue-300 outline-none shadow-lg"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-xl transition-colors"
          >
            <Filter className="w-4 h-4" /> {showFilters ? 'إخفاء الفلاتر' : 'فلاتر متقدمة'}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-8 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4">
          <div>
            <label className="block text-sm font-medium mb-2">نطاق السعر</label>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="من" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
              <input type="number" placeholder="إلى" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">ترتيب حسب</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700">
              <option value="newest">الأحدث</option>
              <option value="price_low">السعر: من الأقل للأعلى</option>
              <option value="price_high">السعر: من الأعلى للأقل</option>
              <option value="rating">الأعلى تقييماً</option>
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => { setMinPrice(''); setMaxPrice(''); setSortBy('newest'); }}
              className="w-full py-2 text-gray-500 hover:text-red-500 transition-colors"
            >
              إعادة تعيين الفلاتر
            </button>
          </div>
        </div>
      )}

      {compareList.length > 0 && (
        <div className="mb-8 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Layers className="w-6 h-6 text-blue-600" />
            <span className="font-bold">مقارنة المنتجات ({compareList.length}/3)</span>
            <div className="flex gap-2">
              {compareList.map(p => (
                <div key={p.id} className="bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-xs flex items-center gap-2 border border-blue-200">
                  {p.title}
                  <button onClick={() => toggleCompare(p)}><X className="w-3 h-3 text-red-500" /></button>
                </div>
              ))}
            </div>
          </div>
          <button 
            onClick={() => setShowCompare(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            قارن الآن
          </button>
        </div>
      )}

      {ads.length > 0 && (
        <div className="mb-8 overflow-x-auto flex gap-4 pb-4 snap-x">
          {ads.map(ad => (
            <a key={ad.id} href={ad.linkUrl || '#'} target={ad.linkUrl ? "_blank" : "_self"} rel="noreferrer" className="flex-none w-full sm:w-[600px] h-48 sm:h-64 rounded-2xl overflow-hidden shadow-md snap-center relative group">
              <img src={ad.imageUrl} alt="Advertisement" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
            </a>
          ))}
        </div>
      )}

      {events?.filter(e => {
        const now = new Date();
        const end = new Date(e.endDate);
        return now < end;
      })?.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold">المسابقات والجوائز</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {events?.filter(e => {
              const now = new Date();
              const end = new Date(e.endDate);
              return now < end;
            })?.map(evt => (
              <div key={evt.id} className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">{evt.name}</h3>
                    <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-medium">
                      <Clock className="w-3 h-3" />
                      ينتهي: {new Date(evt.endDate).toLocaleDateString('ar-EG')}
                    </div>
                  </div>
                  <p className="text-blue-100 text-sm mb-6 line-clamp-2">{evt.description || 'مسابقة كبرى بمناسبة حلول الشهر الفضيل'}</p>
                  
                  {evt.prizeDescription && (
                    <div className="mb-6 p-3 bg-white/10 rounded-xl border border-white/20 flex items-center gap-3">
                      <div className="p-2 bg-yellow-400 rounded-lg text-blue-900">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-blue-200 font-bold">الجائزة الكبرى</div>
                        <div className="font-bold">{evt.prizeDescription}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 flex-1">
                      <div className="text-[10px] text-blue-200 mb-1">المركز الأول</div>
                      <div className="font-bold">{evt.rewards?.[1]} ج.م</div>
                    </div>
                    <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 flex-1">
                      <div className="text-[10px] text-blue-200 mb-1">المركز الثاني</div>
                      <div className="font-bold">{evt.rewards?.[2]} ج.م</div>
                    </div>
                  </div>
                </div>
                {/* Decoration */}
                <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
                <Trophy className="absolute bottom-0 right-0 -mr-8 -mb-8 w-40 h-40 text-white/5 rotate-12" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">أحدث المنتجات</h2>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {category === 'all' ? 'الكل' : category === 'general' ? 'عام' : category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <div key={product.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden card-hover flex flex-col">
            <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative">
              {product.images && product.images[0] ? (
                <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">لا توجد صورة</div>
              )}
              {product.stock <= 0 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg">
                  نفذت الكمية
                </div>
              )}
            </div>
            <div className="p-4 flex flex-col flex-1">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-lg truncate flex-1">{product.title}</h3>
                <span className="text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md mr-2">
                  {product.category === 'general' || !product.category ? 'عام' : product.category}
                </span>
              </div>
              <div className="flex items-center gap-1 text-yellow-500 mb-2 text-sm">
                <Star className="w-4 h-4 fill-current" />
                <span>{product.ratingAverage?.toFixed(1) || 'جديد'}</span>
              </div>
              <div className="mt-auto pt-4 flex items-center justify-between">
                <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{product.price.toLocaleString('en-US')} ج.م</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      addItem(product);
                      window.dispatchEvent(new Event('show-ad'));
                    }}
                    disabled={product.stock <= 0}
                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-green-100 dark:hover:bg-green-900 text-green-600 dark:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-modern"
                    title="أضف للسلة"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handlePurchase(product)}
                    disabled={product.stock <= 0 || buying === product.id}
                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-modern"
                    title="شراء الآن"
                  >
                    {buying === product.id ? <span className="animate-pulse">...</span> : <ShoppingCart className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={() => toggleCompare(product)}
                    className={`p-2 rounded-full transition-colors btn-modern ${compareList.find(p => p.id === product.id) ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900'}`}
                    title="مقارنة المنتج"
                  >
                    <Layers className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setReviewingProduct(product)}
                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900 text-yellow-600 dark:text-yellow-400 transition-colors btn-modern"
                    title="إضافة تقييم"
                  >
                    <Star className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {filteredProducts.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            لا توجد منتجات مطابقة لبحثك.
          </div>
        )}
      </div>

      {/* Comparison Modal */}
      {showCompare && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-4xl overflow-x-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-2xl">مقارنة المنتجات</h3>
              <button onClick={() => setShowCompare(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <div className="grid grid-cols-4 gap-4 min-w-[600px]">
              <div className="space-y-8 pt-40">
                <div className="font-bold text-gray-500 border-b pb-2">السعر</div>
                <div className="font-bold text-gray-500 border-b pb-2">القسم</div>
                <div className="font-bold text-gray-500 border-b pb-2">التقييم</div>
                <div className="font-bold text-gray-500 border-b pb-2">المخزون</div>
                <div className="font-bold text-gray-500 border-b pb-2">نوع التسليم</div>
              </div>
              {compareList.map(p => (
                <div key={p.id} className="text-center space-y-8">
                  <div className="h-40 flex flex-col items-center">
                    <img src={p.images?.[0]} alt={p.title} className="w-24 h-24 object-cover rounded-lg mb-2" />
                    <h4 className="font-bold text-sm line-clamp-2">{p.title}</h4>
                  </div>
                  <div className="font-bold text-blue-600 border-b pb-2">{p.price} ج.م</div>
                  <div className="text-sm border-b pb-2">{p.category || 'عام'}</div>
                  <div className="text-sm border-b pb-2 flex justify-center items-center gap-1"><Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /> {p.ratingAverage?.toFixed(1) || '0'}</div>
                  <div className="text-sm border-b pb-2">{p.stock}</div>
                  <div className="text-sm border-b pb-2">{p.deliveryType}</div>
                  <button onClick={() => handlePurchase(p)} className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-xs">شراء الآن</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-bold text-xl mb-4">تقييم: {reviewingProduct.title}</h3>
            <form onSubmit={submitReview} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">التقييم (من 5)</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(num => (
                    <button type="button" key={num} onClick={() => setRating(num)} className={`p-2 rounded-full ${rating >= num ? 'text-yellow-500' : 'text-gray-300'}`}>
                      <Star className="w-8 h-8 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">تعليقك</label>
                <textarea required value={comment} onChange={e => setComment(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 h-24"></textarea>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">إرسال التقييم</button>
                <button type="button" onClick={() => setReviewingProduct(null)} className="py-2 px-4 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300">إلغاء</button>
              </div>
            </form>
            
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 max-h-40 overflow-y-auto">
              <h4 className="font-bold mb-2">التقييمات السابقة</h4>
              {reviews[reviewingProduct.id]?.map((r: any, idx: number) => (
                <div key={idx} className="mb-2 p-2 bg-gray-50 dark:bg-gray-750 rounded-lg text-sm">
                  <div className="flex items-center gap-1 text-yellow-500 mb-1">
                    <Star className="w-3 h-3 fill-current" /> {r.rating}
                  </div>
                  <p>{r.comment}</p>
                </div>
              ))}
              {(!reviews[reviewingProduct.id] || reviews[reviewingProduct.id]?.length === 0) && <p className="text-sm text-gray-500">لا توجد تقييمات بعد</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
