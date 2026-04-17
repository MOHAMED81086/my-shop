import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Ad {
  id: string;
  type: 'text' | 'image' | 'video' | 'product';
  content: string;
  productId?: string;
  viewsLeft: number;
  status: string;
}

export default function AdModal() {
  const { user, profile } = useAuthStore();
  const [currentAd, setCurrentAd] = useState<Ad | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [adProduct, setAdProduct] = useState<any | null>(null);

  useEffect(() => {
    // Don't show ads to VIPs (10000+ points or VIP role)
    const isVIP = profile && ((profile.points || 0) >= 10000 || profile.role === 'vip_merchant' || profile.role === 'vip_buyer' || profile.role === 'admin');
    if (isVIP) return;

    const fetchAndShowAd = async () => {
      try {
        const viewedAds = JSON.parse(sessionStorage.getItem('viewedAds') || '[]');
        
        const q = query(collection(db, 'ads'), where('status', '==', 'active'));
        const snap = await getDocs(q);
        const activeAds = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Ad[];
        
        // Filter out viewed ads and ads with no views left
        const availableAds = activeAds.filter(ad => !viewedAds.includes(ad.id) && ad.viewsLeft > 0);
        
        if (availableAds.length > 0) {
          // Pick a random ad
          const ad = availableAds[Math.floor(Math.random() * availableAds.length)];
          
          if (ad.type === 'product' && ad.productId) {
            const productSnap = await getDocs(query(collection(db, 'products'), where('__name__', '==', ad.productId)));
            if (!productSnap.empty) {
              setAdProduct({ id: productSnap.docs[0].id, ...productSnap.docs[0].data() });
            }
          }
          
          setCurrentAd(ad);
          setIsOpen(true);
          
          // Mark as viewed
          viewedAds.push(ad.id);
          sessionStorage.setItem('viewedAds', JSON.stringify(viewedAds));
          
          // Decrement views
          const newViewsLeft = ad.viewsLeft - 1;
          await updateDoc(doc(db, 'ads', ad.id), {
            viewsLeft: increment(-1),
            status: newViewsLeft <= 0 ? 'finished' : 'active'
          });
        }
      } catch (error) {
        console.error('Error fetching ad:', error);
      }
    };

    // Show ad after 5 minutes (300000 ms)
    const timer = setTimeout(() => {
      fetchAndShowAd();
    }, 300000);

    // Also listen for a custom event to show ad immediately (e.g. when clicking a product)
    const handleShowAdEvent = () => {
      fetchAndShowAd();
    };
    window.addEventListener('show-ad', handleShowAdEvent);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('show-ad', handleShowAdEvent);
    };
  }, [profile]);

  if (!isOpen || !currentAd) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden relative shadow-2xl animate-in fade-in zoom-in duration-300">
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full z-10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-1 bg-gradient-to-r from-blue-500 to-purple-500 text-center text-white text-xs font-bold tracking-wider uppercase">
          إعلان ممول
        </div>

        <div className="p-6">
          {currentAd.type === 'text' && (
            <div className="min-h-[200px] flex items-center justify-center text-center p-8">
              <p className="text-2xl font-bold leading-relaxed">{currentAd.content}</p>
            </div>
          )}

          {currentAd.type === 'image' && (
            <div className="w-full aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900">
              <img src={currentAd.content} alt="Ad" className="w-full h-full object-contain" />
            </div>
          )}

          {currentAd.type === 'video' && (
            <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
              <video src={currentAd.content} autoPlay controls className="w-full h-full object-contain"></video>
            </div>
          )}

          {currentAd.type === 'product' && adProduct && (
            <div className="flex flex-col sm:flex-row gap-6 items-center">
              <div className="w-full sm:w-1/2 aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                {adProduct.images && adProduct.images[0] ? (
                  <img src={adProduct.images[0]} alt={adProduct.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">لا توجد صورة</div>
                )}
              </div>
              <div className="w-full sm:w-1/2 space-y-4 text-center sm:text-right">
                <h3 className="text-2xl font-bold">{adProduct.title}</h3>
                <p className="text-blue-600 dark:text-blue-400 text-3xl font-bold">{adProduct.price.toLocaleString()} ج.م</p>
                <p className="text-gray-500 line-clamp-3">{adProduct.description}</p>
                <button 
                  onClick={() => {
                    setIsOpen(false);
                    // trigger product click or add to cart
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-5 h-5" /> عرض المنتج
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
