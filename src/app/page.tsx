'use client';

import React, { useState, useEffect, useRef, useCallback, ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useSurveyStore } from '@/store/survey';

// Icons
import { 
  Home, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Share2,
  Trophy,
  Users,
  BarChart3,
  Video,
  Mic,
  SkipForward,
  Send,
  PartyPopper,
  MessageCircle,
  Facebook,
  Camera,
  FileVideo,
  CircleCheck,
  CircleX,
  ThumbsUp,
  ThumbsDown,
  UserPlus,
  UserCheck,
  Sparkles,
  Star,
  Heart,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

// Constants
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://markzshabab.studusa05.workers.dev';
const FIREBASE_URL = process.env.NEXT_PUBLIC_FIREBASE_URL || 'https://markzshabab-4c01b-default-rtdb.firebaseio.com';
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-3fb0b86037554ed0b842bc258e8a3051.r2.dev';

// Survey Options
const sportsOptions = [
  { id: 'local_matches', label: 'تشجيع ونشاط مباريات الراية المحلية', icon: '⚽' },
  { id: 'team_formation', label: 'تكوين الفريق الرياضي ونشاط القرية', icon: '🏃' },
  { id: 'tournaments', label: 'تنظيم الدورات والمسابقات الرياضية', icon: '🏆' },
];

const culturalOptions = [
  { id: 'awareness_sessions', label: 'تنفيذ الوعي النقاش والفعاليات', icon: '🎤' },
  { id: 'social_culture', label: 'تنمية التثقيف والوعي الاجتماعي', icon: '📚' },
  { id: 'creative_activities', label: 'رحلات وأفلام والوظائف الإبداعية', icon: '🎬' },
];

const socialOptions = [
  { id: 'community_work', label: 'عمل وتنظيم العامل الشغوف', icon: '🤝' },
  { id: 'community_engagement', label: 'مساهمة جذب أفراد المجتمع وتفاعلهم', icon: '👥' },
  { id: 'youth_awareness', label: 'نشر الوعي الشباب والمساهمة على القرية', icon: '🌟' },
];

const suggestionsOptions = [
  { id: 'continuous_planning', label: 'التخطيط المستمر للتطوير والفعاليات', icon: '📋' },
  { id: 'facility_management', label: 'إدارة وتنظيم مرافق القرية', icon: '🏛️' },
  { id: 'playground_maintenance', label: 'صيانة وتطوير الملاعب بشكل دوري', icon: '🔧' },
];

// Simple fingerprint generation
function generateSimpleFingerprint(): string {
  try {
    const data = [
      navigator.userAgent,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.language || '',
      navigator.platform || '',
    ].join('|');
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'fp_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
  } catch (e) {
    return 'fp_fallback_' + Date.now().toString(36);
  }
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Survey Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">حدث خطأ ما!</h2>
              <p className="text-gray-600 mb-4">عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.</p>
              <Button 
                onClick={() => window.location.reload()}
                className="bg-green-700 hover:bg-green-800"
              >
                <RefreshCw className="ml-2 w-4 h-4" />
                إعادة تحميل الصفحة
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

// Main Page Component
export default function SurveyPage() {
  const [activeTab, setActiveTab] = useState<'survey' | 'gallery' | 'stats'>('survey');
  const [fingerprint] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      let fp = localStorage.getItem('device_fingerprint') || '';
      if (!fp) {
        fp = generateSimpleFingerprint();
        localStorage.setItem('device_fingerprint', fp);
      }
      return fp;
    } catch (e) {
      return 'fp_guest_' + Date.now();
    }
  });
  const [isLoading] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-green-800 font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col pb-20">
        {/* Header */}
        <header className="bg-gradient-to-l from-green-800 via-green-700 to-green-900 text-white py-6 px-4 shadow-lg">
          <div className="max-w-lg mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Trophy className="w-10 h-10 text-yellow-400" />
              <h1 className="text-2xl md:text-3xl font-bold">مجلس شباب قرية الأحمدي</h1>
            </div>
            <p className="text-green-100 text-sm md:text-base">استبيان شباب قرية الأحمدي (2019-2024)</p>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-green-100 shadow-sm">
          <div className="max-w-lg mx-auto">
            <div className="flex">
              <button
                onClick={() => setActiveTab('survey')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-all ${
                  activeTab === 'survey'
                    ? 'text-green-700 border-b-2 border-green-600 bg-green-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Home className="w-5 h-5 mx-auto mb-1" />
                الاستبيان
              </button>
              <button
                onClick={() => setActiveTab('gallery')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-all ${
                  activeTab === 'gallery'
                    ? 'text-green-700 border-b-2 border-green-600 bg-green-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Video className="w-5 h-5 mx-auto mb-1" />
                المعرض
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex-1 py-3 px-4 text-sm font-medium transition-all ${
                  activeTab === 'stats'
                    ? 'text-green-700 border-b-2 border-green-600 bg-green-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <BarChart3 className="w-5 h-5 mx-auto mb-1" />
                الإحصائيات
              </button>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1">
          {activeTab === 'survey' && (
            <SurveyContent fingerprint={fingerprint} />
          )}
          {activeTab === 'gallery' && <GalleryContent />}
          {activeTab === 'stats' && <StatsContent />}
        </main>

        {/* Bottom Navigation (Mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-green-100 shadow-lg z-50 safe-area-bottom">
          <div className="flex justify-around py-2 max-w-lg mx-auto pb-safe">
            <button
              onClick={() => setActiveTab('survey')}
              className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                activeTab === 'survey' ? 'text-green-700 bg-green-50' : 'text-gray-400'
              }`}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs mt-1">الرئيسية</span>
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                activeTab === 'gallery' ? 'text-green-700 bg-green-50' : 'text-gray-400'
              }`}
            >
              <Video className="w-6 h-6" />
              <span className="text-xs mt-1">المعرض</span>
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                activeTab === 'stats' ? 'text-green-700 bg-green-50' : 'text-gray-400'
              }`}
            >
              <BarChart3 className="w-6 h-6" />
              <span className="text-xs mt-1">الإحصائيات</span>
            </button>
          </div>
        </nav>
      </div>
    </ErrorBoundary>
  );
}

// Survey Content Component
function SurveyContent({ fingerprint }: { fingerprint: string }) {
  const { currentStep, isSubmitted, resetSurvey, setCurrentStep } = useSurveyStore();

  if (isSubmitted) {
    return <ThankYouPage onReset={resetSurvey} />;
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <HomePage fingerprint={fingerprint} />;
      case 1:
        return <SportsStep />;
      case 2:
        return <CulturalStep />;
      case 3:
        return <SocialStep />;
      case 4:
        return <SuggestionsStep />;
      case 5:
        return <Question1Step />;
      case 6:
        return <Question2Step />;
      case 7:
        return <Question3Step />;
      case 8:
        return <MediaRecordingStep fingerprint={fingerprint} />;
      default:
        return <HomePage fingerprint={fingerprint} />;
    }
  };

  return (
    <div className="animate-fade-in">
      {currentStep > 0 && currentStep < 9 && (
        <div className="bg-white px-4 py-3 sticky top-[49px] z-30 border-b border-green-100">
          <div className="max-w-lg mx-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">التقدم</span>
              <span className="text-sm font-medium text-green-700">{currentStep}/8</span>
            </div>
            <Progress value={(currentStep / 8) * 100} className="h-2" />
          </div>
        </div>
      )}
      {renderStep()}
    </div>
  );
}

// Home Page Component
function HomePage({ fingerprint }: { fingerprint: string }) {
  const { setCurrentStep } = useSurveyStore();
  
  const handleStart = () => {
    try {
      setCurrentStep(1);
    } catch (e) {
      console.error('Navigation error:', e);
      toast.error('حدث خطأ، يرجى المحاولة مرة أخرى');
    }
  };

  const shareOnWhatsApp = () => {
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    const text = 'شارك في استبيان مجلس شباب قرية الأحمدي! 🏆\n' + url;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Card className="shadow-xl border-0 overflow-hidden">
        <div className="bg-gradient-to-br from-green-600 via-green-700 to-green-900 p-8 text-center text-white">
          <div className="w-24 h-24 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <Trophy className="w-14 h-14 text-yellow-300" />
          </div>
          <h2 className="text-2xl font-bold mb-2">مجلس شباب قرية الأحمدي</h2>
          <p className="text-green-100 text-sm">استبيان شباب قرية الأحمدي (2019-2024)</p>
          <p className="text-green-200 text-xs mt-2">الدورة وتقييم الإدارة</p>
        </div>
        
        <CardContent className="p-6 space-y-4">
          <Button 
            onClick={handleStart}
            className="w-full py-6 text-lg bg-green-700 hover:bg-green-800 rounded-xl font-bold"
          >
            ✨ ابدأ الاستبيان الآن
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full py-4 text-gray-500 rounded-xl"
            disabled
          >
            <PieChartIcon className="ml-2 w-5 h-5" />
            عرض تقدم الاستبيان الحالي
          </Button>
          
          <Separator />
          
          <Button 
            onClick={shareOnWhatsApp}
            variant="default"
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
          >
            <MessageCircle className="ml-2 w-5 h-5" />
            شارك الاستبيان مع أصدقائك
          </Button>
          
          <div className="text-center space-y-2 pt-4">
            <p className="text-sm text-gray-600">هذا الاستبيان غير رسمي وضعه الشباب</p>
            <p className="text-sm font-semibold text-green-700">تصويت مفتوح التصويت باسم</p>
            
            <Button 
              variant="ghost" 
              size="sm"
              className="text-blue-600 hover:text-blue-700"
            >
              <Facebook className="ml-1 w-4 h-4" />
              صفحة التصديقة الرسمية على فيسبوك
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PieChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  );
}

// Sports Step Component
function SportsStep() {
  const { setCurrentStep, setSportsActivities, sportsActivities } = useSurveyStore();
  const [selected, setSelected] = useState<string[]>(Array.isArray(sportsActivities) ? sportsActivities : []);

  const toggleOption = (id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setSportsActivities(selected);
    setCurrentStep(2);
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl text-gray-800 flex items-center justify-center gap-2">
            ⚽ الأنشطة الرياضية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sportsOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => toggleOption(option.id)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selected.includes(option.id)
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <Label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={selected.includes(option.id)} readOnly />
                <span className="text-base">{option.label}</span>
                {selected.includes(option.id) && <CheckCircle2 className="w-5 h-5 text-green-600 mr-auto" />}
              </Label>
            </div>
          ))}
          
          <Button onClick={handleNext} className="w-full py-5 mt-6 bg-green-700 hover:bg-green-800 rounded-xl text-lg">
            التالي
          </Button>
          
          <ShareButton />
        </CardContent>
      </Card>
    </div>
  );
}

// Cultural Step Component
function CulturalStep() {
  const { setCurrentStep, setCulturalActivities, culturalActivities } = useSurveyStore();
  const [selected, setSelected] = useState<string[]>(Array.isArray(culturalActivities) ? culturalActivities : []);

  const toggleOption = (id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setCulturalActivities(selected);
    setCurrentStep(3);
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl text-gray-800 flex items-center justify-center gap-2">
            📚 الأنشطة الثقافية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {culturalOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => toggleOption(option.id)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selected.includes(option.id)
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <Label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={selected.includes(option.id)} readOnly />
                <span className="text-base">{option.label}</span>
                {selected.includes(option.id) && <CheckCircle2 className="w-5 h-5 text-green-600 mr-auto" />}
              </Label>
            </div>
          ))}
          
          <Button onClick={handleNext} className="w-full py-5 mt-6 bg-green-700 hover:bg-green-800 rounded-xl text-lg">
            التالي
          </Button>
          
          <ShareButton />
        </CardContent>
      </Card>
    </div>
  );
}

// Social Step Component
function SocialStep() {
  const { setCurrentStep, setSocialActivities, socialActivities } = useSurveyStore();
  const [selected, setSelected] = useState<string[]>(Array.isArray(socialActivities) ? socialActivities : []);

  const toggleOption = (id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setSocialActivities(selected);
    setCurrentStep(4);
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl text-gray-800 flex items-center justify-center gap-2">
            👥 الأنشطة الاجتماعية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {socialOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => toggleOption(option.id)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selected.includes(option.id)
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <Label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={selected.includes(option.id)} readOnly />
                <span className="text-base">{option.label}</span>
                {selected.includes(option.id) && <CheckCircle2 className="w-5 h-5 text-green-600 mr-auto" />}
              </Label>
            </div>
          ))}
          
          <Button onClick={handleNext} className="w-full py-5 mt-6 bg-green-700 hover:bg-green-800 rounded-xl text-lg">
            التالي
          </Button>
          
          <ShareButton />
        </CardContent>
      </Card>
    </div>
  );
}

// Suggestions Step Component
function SuggestionsStep() {
  const { setCurrentStep, setSuggestions, suggestions } = useSurveyStore();
  const [selected, setSelected] = useState<string[]>(Array.isArray(suggestions) ? suggestions : []);

  const toggleOption = (id: string) => {
    setSelected(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleNext = () => {
    setSuggestions(selected);
    setCurrentStep(5);
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl text-gray-800 flex items-center justify-center gap-2">
            📋 مقترحات الجدارة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {suggestionsOptions.map((option) => (
            <div
              key={option.id}
              onClick={() => toggleOption(option.id)}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selected.includes(option.id)
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <Label className="flex items-center gap-3 cursor-pointer">
                <Checkbox checked={selected.includes(option.id)} readOnly />
                <span className="text-base">{option.label}</span>
                {selected.includes(option.id) && <CheckCircle2 className="w-5 h-5 text-green-600 mr-auto" />}
              </Label>
            </div>
          ))}
          
          <div className="flex gap-3 mt-6">
            <Button onClick={() => setCurrentStep(4)} variant="outline" className="flex-1 py-5 rounded-xl">
              رجوع للخلف
            </Button>
            <Button onClick={handleNext} className="flex-1 py-5 bg-green-700 hover:bg-green-800 rounded-xl">
              التالي
            </Button>
          </div>
          
          <ShareButton />
        </CardContent>
      </Card>
    </div>
  );
}

// Question 1 Step Component
function Question1Step() {
  const { setCurrentStep, setQuestion1Answer } = useSurveyStore();

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl text-green-800">السؤال الأول</CardTitle>
          <p className="text-gray-600 text-sm mt-2">
            هل راضيك عن أداء الإدارة الحالية لمجلس شباب قرية الأحمدي خلال سنوات سابقة؟
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => { setQuestion1Answer('satisfied'); setCurrentStep(6); }}
            variant="outline"
            className="w-full py-6 text-lg border-2 border-green-500 text-green-700 hover:bg-green-50 rounded-xl"
          >
            راضي جداً 😊
          </Button>
          
          <Button
            onClick={() => { setQuestion1Answer('not_satisfied'); setCurrentStep(6); }}
            variant="outline"
            className="w-full py-6 text-lg border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
          >
            غير راضي 😔
          </Button>
          
          <ShareButton />
        </CardContent>
      </Card>
    </div>
  );
}

// Question 2 Step Component
function Question2Step() {
  const { setCurrentStep, setQuestion2Answer } = useSurveyStore();

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl text-green-800">السؤال الثاني</CardTitle>
          <p className="text-gray-600 text-sm mt-2">
            هل تويد ترشيح الشباب لإدارة مجلس شباب قرية الأحمدي خلال الفترة القادمة؟
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => { setQuestion2Answer('support'); setCurrentStep(7); }}
            variant="outline"
            className="w-full py-6 text-lg border-2 border-green-500 text-green-700 hover:bg-green-50 rounded-xl"
          >
            نعم، أويد 👍
          </Button>
          
          <Button
            onClick={() => { setQuestion2Answer('not_support'); setCurrentStep(7); }}
            variant="outline"
            className="w-full py-6 text-lg border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
          >
            لا، أويد 👎
          </Button>
          
          <ShareButton />
        </CardContent>
      </Card>
    </div>
  );
}

// Question 3 Step Component
function Question3Step() {
  const { setCurrentStep, setQuestion3Answer } = useSurveyStore();

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl text-green-800">السؤال الثالث</CardTitle>
          <p className="text-blue-700 font-semibold text-base mt-2 bg-blue-50 p-3 rounded-lg">
            من تفضلير إدارة مجلس شباب قرية الأحمدي في الفترة القادمة؟
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => { setQuestion3Answer('new_youth'); setCurrentStep(8); }}
            variant="outline"
            className="w-full py-6 text-lg border-2 border-blue-500 text-blue-700 hover:bg-blue-50 rounded-xl"
          >
            شباب جدد 👤+
          </Button>
          
          <Button
            onClick={() => { setQuestion3Answer('current_management'); setCurrentStep(8); }}
            variant="outline"
            className="w-full py-6 text-lg border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-xl"
          >
            إدارة الحالية 👤🔴
          </Button>
          
          <ShareButton />
        </CardContent>
      </Card>
    </div>
  );
}

// Media Recording Step Component
function MediaRecordingStep({ fingerprint }: { fingerprint: string }) {
  const { setCurrentStep, submitSurvey, mediaType, setMediaType, mediaUrl, setMediaUrl } = useSurveyStore();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_TIME = mediaType === 'video' ? 30 : 15;

  const startRecording = async () => {
    try {
      let stream: MediaStream;
      
      if (mediaType === 'video') {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      streamRef.current = stream;
      
      if (mediaType === 'video' && videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setMediaPreviewUrl(url);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };
      
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      setTimeLeft(MAX_TIME);
      
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('لم نتمكن من الوصول للكاميرا/الميكروفون');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const uploadMedia = async (): Promise<string | null> => {
    if (!recordedBlob || !fingerprint) return null;
    
    try {
      const formData = new FormData();
      formData.append('file', recordedBlob, `recording.webm`);
      formData.append('type', mediaType || 'audio');
      formData.append('fingerprint', fingerprint);
      
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      return data.url || null;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleSubmit = async (skipMedia = false) => {
    try {
      let finalMediaUrl = mediaUrl;
      
      if (!skipMedia && recordedBlob) {
        toast.loading('جاري رفع الوسائط...');
        finalMediaUrl = await uploadMedia();
        toast.dismiss();
      }
      
      setMediaUrl(finalMediaUrl);
      
      const surveyData = {
        deviceFingerprint: fingerprint,
        sportsActivities: JSON.stringify(useSurveyStore.getState().sportsActivities),
        culturalActivities: JSON.stringify(useSurveyStore.getState().culturalActivities),
        socialActivities: JSON.stringify(useSurveyStore.getState().socialActivities),
        suggestions: JSON.stringify(useSurveyStore.getState().suggestions),
        question1Answer: useSurveyStore.getState().question1Answer,
        question2Answer: useSurveyStore.getState().question2Answer,
        question3Answer: useSurveyStore.getState().question3Answer,
        mediaType: skipMedia ? null : mediaType,
        mediaUrl: finalMediaUrl,
      };
      
      const response = await fetch('/api/survey/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(surveyData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        submitSurvey();
        toast.success('تم إرسال الاستبيان بنجاح! 🎉');
      } else {
        toast.error(result.error || 'حدث خطأ');
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('حدث خطأ في الإرسال');
    }
  };

  const retakeRecording = () => {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setRecordedBlob(null);
    setMediaPreviewUrl(null);
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Card className="shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl text-green-800">هل تريد فيديو عن عدم رأيك برأيسكم شخصياً؟</CardTitle>
          <p className="text-gray-600 text-sm mt-2">
            ضعنا تسجيل فيديو أو حدث 30 ثانية فقط (التسجيل)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!mediaType ? (
            <>
              <Button
                onClick={() => setMediaType('video')}
                variant="default"
                className="w-full py-6 text-lg bg-green-700 hover:bg-green-800 rounded-xl"
              >
                <Camera className="ml-2 w-6 h-6" />
                تسجيل فيديو
              </Button>
              
              <Button
                onClick={() => setMediaType('audio')}
                variant="default"
                className="w-full py-6 text-lg bg-green-700 hover:bg-green-800 rounded-xl"
              >
                <Mic className="ml-2 w-6 h-6" />
                تسجيل صوت
              </Button>
              
              <Button
                onClick={() => handleSubmit(true)}
                variant="outline"
                className="w-full py-5 text-gray-600 rounded-xl"
              >
                تخطي وإرسال الاستبيان فقط
              </Button>
            </>
          ) : (
            <>
              {isRecording ? (
                <div className="text-center space-y-4">
                  {mediaType === 'video' && (
                    <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-lg" />
                  )}
                  
                  <div className="text-4xl font-bold text-red-500 animate-pulse">
                    {timeLeft}s
                  </div>
                  
                  <Button onClick={stopRecording} variant="destructive" size="lg" className="rounded-full w-20 h-20">
                    ■
                  </Button>
                </div>
              ) : recordedBlob ? (
                <div className="space-y-4">
                  {mediaType === 'video' ? (
                    <video src={mediaPreviewUrl!} controls className="w-full rounded-lg" />
                  ) : (
                    <audio src={mediaPreviewUrl!} controls className="w-full" />
                  )}
                  
                  <div className="flex gap-3">
                    <Button onClick={retakeRecording} variant="outline" className="flex-1">
                      إعادة التسجيل
                    </Button>
                    <Button onClick={() => handleSubmit()} className="flex-1 bg-green-700">
                      <Send className="ml-2" /> إرسال
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-32 h-32 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                    {mediaType === 'video' ? <Video className="w-16 h-16 text-gray-400" /> : <Mic className="w-16 h-16 text-gray-400" />}
                  </div>
                  
                  <Button onClick={startRecording} className="bg-red-500 hover:bg-red-600 rounded-full w-20 h-20">
                    ●
                  </Button>
                  
                  <p className="text-sm text-gray-500">
                    الحد الأقصى: {MAX_TIME} ثانية
                  </p>
                </div>
              )}
              
              <Button
                onClick={() => { setMediaType(null); retakeRecording(); }}
                variant="ghost"
                className="w-full text-gray-500"
              >
                تغيير نوع التسجيل
              </Button>
            </>
          )}
          
          <ShareButton />
        </CardContent>
      </Card>
    </div>
  );
}

// Thank You Page Component
function ThankYouPage({ onReset }: { onReset: () => void }) {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Card className="shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-green-500 to-green-700 p-8 text-center text-white">
          <PartyPopper className="w-20 h-20 mx-auto mb-4 text-yellow-300" />
          <h2 className="text-3xl font-bold mb-2">شكراً لك! 🎉</h2>
          <p className="text-green-100">تم إرسال استبيانك بنجاح</p>
        </div>
        
        <CardContent className="p-6 text-center space-y-4">
          <p className="text-gray-600">
            مشاركتك مهمة جداً لتطوير مجلس شباب قرية الأحمدي
          </p>
          
          <div className="flex gap-3">
            <Button onClick={shareOnWhatsApp} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
              <MessageCircle className="ml-2" /> شارك الأصدقاء
            </Button>
            <Button onClick={onReset} variant="outline" className="flex-1">
              استبيان جديد
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function shareOnWhatsApp() {
  const url = typeof window !== 'undefined' ? window.location.origin : '';
  const text = 'شارك في استبيان مجلس شباب قرية الأحمدي! 🏆\n' + url;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

// Gallery Content Component
function GalleryContent() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/gallery')
      .then(res => res.json())
      .then(data => {
        setItems(data.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto text-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">جاري تحميل المعرض...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-center text-green-800 mb-6">🎬 المعرض</h2>
      
      {items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map(item => (
            <Card key={item.id} className="overflow-hidden">
              {item.mediaType === 'video' ? (
                <video src={item.mediaUrl} controls className="w-full" />
              ) : (
                <audio src={item.mediaUrl} controls className="w-full p-4" />
              )}
              <CardContent className="p-3">
                <Badge variant="outline">{item.mediaType === 'video' ? 'فيديو' : 'صوت'}</Badge>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(item.createdAt).toLocaleDateString('ar-SA')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center p-8">
          <Video className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">لا توجد تسجيلات معتمدة بعد</p>
          <p className="text-sm text-gray-400 mt-2">سيظهر هنا التسجيلات بعد موافقة الأدمن</p>
        </Card>
      )}
    </div>
  );
}

// Stats Content Component
function StatsContent() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto text-center">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">جاري تحميل الإحصائيات...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto text-center">
        <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">لم تتوفر الإحصائيات بعد</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-center text-green-800">📊 الإحصائيات</h2>
      
      <Card className="bg-gradient-to-br from-green-50 to-white">
        <CardContent className="p-6 text-center">
          <p className="text-5xl font-bold text-green-700">{stats.totalResponses}</p>
          <p className="text-gray-600 mt-2">إجمالي المشاركين</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">😊 الرضا عن الإدارة</CardTitle></CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <span className="text-green-600 font-semibold">راضٍ: {stats.question1?.satisfied || 0}</span>
            <span className="text-red-500 font-semibold">غير راضٍ: {stats.question1?.not_satisfied || 0}</span>
          </div>
          <Progress value={stats.question1?.satisfiedPercentage || 0} className="mt-3 h-3" />
          <p className="text-center text-sm text-gray-500 mt-1">{stats.question1?.satisfiedPercentage || 0}% راضون</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">👍 دعم ترشيح الشباب</CardTitle></CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <span className="text-green-600 font-semibold">نعم: {stats.question2?.support || 0}</span>
            <span className="text-red-500 font-semibold">لا: {stats.question2?.not_support || 0}</span>
          </div>
          <Progress value={stats.question2?.supportPercentage || 0} className="mt-3 h-3" />
          <p className="text-center text-sm text-gray-500 mt-1">{stats.question2?.supportPercentage || 0}% يدعمون</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">👤+ الإدارة المفضلة</CardTitle></CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <span className="text-blue-600 font-semibold">شباب جدد: {stats.question3?.new_youth || 0}</span>
            <span className="text-red-500 font-semibold">الحالية: {stats.question3?.current_management || 0}</span>
          </div>
          <Progress value={stats.question3?.newYouthPercentage || 0} className="mt-3 h-3" />
          <p className="text-center text-sm text-gray-500 mt-1">{stats.question3?.newYouthPercentage || 0}% يفضلون شباب جدد</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Share Button Component
function ShareButton() {
  return (
    <div className="pt-4 border-t">
      <Button 
        onClick={() => {
          const url = typeof window !== 'undefined' ? window.location.origin : '';
          const text = 'شارك في استبيان مجلس شباب قرية الأحمدي! 🏆\n' + url;
          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        }}
        variant="default"
        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
      >
        <MessageCircle className="ml-2 w-5 h-5" />
        شارك الاستبيان مع أصدقائك
      </Button>
      
      <div className="text-center space-y-2 mt-4">
        <p className="text-sm text-gray-600">هذا الاستبيان غير رسمي وضعه الشباب</p>
        <p className="text-sm font-semibold text-green-700">تصويت مفتوح التصويت باسم</p>
        
        <Button 
          variant="ghost" 
          size="sm"
          className="text-blue-600 hover:text-blue-700"
        >
          <Facebook className="ml-1 w-4 h-4" />
          صفحة التصديقة الرسمية على فيسبوك
        </Button>
      </div>
    </div>
  );
}
