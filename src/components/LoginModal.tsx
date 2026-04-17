import React, { useState } from 'react';
import { loginWithUsername, signUpWithUsername, signInWithGoogle } from '../lib/firebase';
import { X, User, Lock, Loader2, UserPlus, LogIn, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import fallbackConfig from '../../firebase-applet-config.json';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setLoading(true);
    try {
      await loginWithUsername(username, password);
      toast.success('تم تسجيل الدخول بنجاح');
      onClose();
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        setSetupRequired(true);
      } else {
        toast.error(error.message || 'حدث خطأ أثناء تسجيل الدخول');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !name) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }

    if (password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    try {
      await signUpWithUsername(username, password, name);
      toast.success('تم إنشاء الحساب بنجاح');
      onClose();
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        setSetupRequired(true);
      } else {
        toast.error(error.message || 'حدث خطأ أثناء إنشاء الحساب');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success('تم تسجيل الدخول عبر جوجل بنجاح');
      onClose();
    } catch (error: any) {
      toast.error('لم نتمكن من إتمام الدخول عبر جوجل');
    } finally {
      setLoading(false);
    }
  };

  if (setupRequired) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-lg w-full text-center relative shadow-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in">
          <button onClick={() => setSetupRequired(false)} className="absolute top-4 right-4 p-2 text-gray-500 hover:bg-gray-100 rounded-full dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">النظام محمي ومغلق</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
            لقد تم برمجة نظام تسجيل الدخول ليعمل بشكل كامل ودائم، ولكن <b>خوادم قاعدة البيانات (Firebase)</b> الخاصة بك لا تسمح حالياً بإنشاء أي حسابات جديدة بكلمة مرور.
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-right mb-6">
            <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2 font-mono text-sm">خطوات التفعيل (لمرة واحدة فقط):</h3>
            <ol className="list-decimal list-inside text-sm text-blue-800 dark:text-blue-300 space-y-2">
              <li>اضغط على الزر بالأسفل لفتح إعدادات Firebase الخاصة بك.</li>
              <li>من القائمة اختر <b>Email/Password</b>.</li>
              <li>قم بتفعيل الزر (Enable) واضغط حفظ (Save).</li>
              <li>ارجع إلى هنا وحاول تسجيل الدخول وسيعمل النظام دائماً.</li>
            </ol>
          </div>

          <a 
            href={`https://console.firebase.google.com/project/${fallbackConfig.projectId}/authentication/providers`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#FFCA28] hover:bg-[#FFD54F] text-black rounded-xl font-bold transition-all shadow-lg shadow-yellow-500/20 mb-3"
          >
            فتح إعدادات Firebase وتفعيل النظام
            <ExternalLink className="w-5 h-5" />
          </a>
          
          <button onClick={() => setSetupRequired(false)} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            لقد قمت بالتفعيل، رجوع للتسجيل
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {mode === 'login' ? 'مرحباً بعودتك' : 'إنشاء حساب جديد'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {mode === 'login' ? 'سجل دخولك للوصول إلى متجرك' : 'انضم إلينا وابدأ البيع والشراء'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-1 flex bg-gray-100 dark:bg-gray-900 m-6 rounded-xl">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              mode === 'login' 
                ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <LogIn className="w-4 h-4" />
            تسجيل الدخول
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              mode === 'signup' 
                ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            إنشاء حساب
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-3 mb-6">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900 font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              متابعة باستخدام جوجل
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">أو عن طريق اسم المستخدم</span>
            </div>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
            {mode === 'signup' && (
              <div className="animate-in slide-in-from-top-2 duration-200">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الاسم الكامل</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pr-10 pl-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                  placeholder="أدخل اسمك الكامل"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم المستخدم</label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pr-10 pl-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                placeholder="أدخل اسم المستخدم"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pr-10 pl-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                placeholder="أدخل كلمة المرور"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/30 mt-6"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري المعالجة...
              </>
            ) : (
              mode === 'login' ? 'دخول' : 'إنشاء الحساب'
            )}
          </button>
          
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {mode === 'login' ? 'ليس لديك حساب؟ إنشاء حساب جديد' : 'لديك حساب بالفعل؟ سجل دخولك'}
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>
  );
}
