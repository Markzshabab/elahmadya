'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useSurveyStore } from '@/store/survey';
import { 
  generateFingerprint, 
  getStoredFingerprint, 
  storeFingerprint, 
  hasVoted, 
  setHasVoted 
} from '@/lib/fingerprint';

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
  Heart
} from 'lucide-react';

// Constants
const WORKER_URL = 'https://markzshabab.studusa05.workers.dev';
const FIREBASE_URL = 'https://markzshabab-4c01b-default-rtdb.firebaseio.com';
const R2_PUBLIC_URL = 'https://pub-3fb0b86037554ed0b842bc258e8a3051.r2.dev';

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

// Main Page Component
export default function SurveyPage() {
  const [activeTab, setActiveTab] = useState<'survey' | 'gallery' | 'stats'>('survey');
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const initFingerprint = async () => {
      let fp = getStoredFingerprint();
      if (!fp) {
        fp = await generateFingerprint();
        storeFingerprint(fp);
      }
      setFingerprint(fp);
      setIsLoading(false);
    };
    initFingerprint();
  }, []);

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
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-green-100 shadow-lg z-50">
        <div className="flex justify-around py-2 max-w-lg mx-auto">
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
  );
}

// Survey Content Component
function SurveyContent({ fingerprint }: { fingerprint: string | null }) {
  const { currentStep, isSubmitted, resetSurvey } = useSurveyStore();

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
              <span className="text-sm font-medium text-green-700">
                {currentStep} / 8
              </span>
            </div>
            <Progress value={(currentStep / 8) * 100} className="h-2" />
          </div>
        </div>
      )}
      {renderStep()}
    </div>
  );
}

// Step 0: Home Page
function HomePage({ fingerprint }: { fingerprint: string | null }) {
  const { setStep } = useSurveyStore();
  // Initialize hasVotedBefore during state initialization to avoid setState in effect
  const [hasVotedBefore] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('has_voted') === 'true';
    }
    return false;
  });

  const handleStartSurvey = () => {
    if (hasVotedBefore) {
      toast.error('لقد قمت بالتصويت مسبقاً');
      return;
    }
    setStep(1);
  };

  const shareOnWhatsApp = () => {
    const url = window.location.href;
    const text = 'شارك في استبيان مجلس شباب قرية الأحمدي 🗳️✨';
    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
  };

  return (
    <div className="px-4 py-6 animate-slide-up">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Hero Card */}
        <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-600 via-green-700 to-green-900 text-white">
          <CardContent className="p-8 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Trophy className="w-14 h-14 text-yellow-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              مجلس شباب قرية الأحمدي
            </h2>
            <p className="text-green-100 text-lg mb-2">
              استبيان شباب قرية الأحمدي (2019-2024)
            </p>
            <p className="text-green-200 text-base">
              الدورة وتقييم الإدارة
            </p>
            
            <div className="mt-8 space-y-4">
              <Button
                onClick={handleStartSurvey}
                size="lg"
                disabled={hasVotedBefore}
                className="w-full bg-white text-green-800 hover:bg-green-50 font-bold text-lg py-6 rounded-2xl shadow-lg transform hover:scale-[1.02] transition-all"
              >
                {hasVotedBefore ? (
                  <>
                    <CircleCheck className="ml-2 w-6 h-6" />
                    تم التصويت مسبقاً
                  </>
                ) : (
                  <>
                    <Sparkles className="ml-2 w-6 h-6" />
                    ابدأ الاستبيان الآن
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                onClick={shareOnWhatsApp}
                className="w-full border-2 border-white/30 text-white hover:bg-white/10 font-semibold py-5 rounded-2xl"
              >
                <MessageCircle className="ml-2 w-5 h-5" />
                شارك الاستبيان مع أصدقائك
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid grid-cols-1 gap-4">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="p-4 flex items-start gap-3">
              <InfoIcon className="text-green-600 mt-1 shrink-0" />
              <p className="text-green-800 text-sm">
                هذا الاستبيان غير رسمي وضعه الشباب لجمع آراء أهل القرية
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="p-4 flex items-start gap-3">
              <Users className="text-blue-600 mt-1 shrink-0 w-5 h-5" />
              <p className="text-blue-800 text-sm">
                تصويت مفتوح - التصويت باسمك الشخصي
              </p>
            </CardContent>
          </Card>
          
          <Card className="border-purple-200 bg-purple-50/50">
            <CardContent className="p-4 flex items-start gap-3">
              <Facebook className="text-purple-600 mt-1 shrink-0 w-5 h-5" />
              <p className="text-purple-800 text-sm">
                تابعنا على فيسبوك للتصديق والتحديثات
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Stats Preview */}
        <StatsPreview />
      </div>
    </div>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// Stats Preview Component
function StatsPreview() {
  const [totalVotes, setTotalVotes] = useState(0);

  useEffect(() => {
    fetch(`${FIREBASE_URL}/responses.json`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          setTotalVotes(Object.keys(data).length);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <Card className="border-green-200 overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-l from-green-50 to-white">
        <CardTitle className="text-lg text-green-800 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          إحصائيات الاستبيان
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-green-100 rounded-xl">
            <p className="text-2xl font-bold text-green-800">{totalVotes}</p>
            <p className="text-xs text-green-600">إجمالي المصوتين</p>
          </div>
          <div className="text-center p-3 bg-blue-100 rounded-xl">
            <p className="text-2xl font-bold text-blue-800">{Math.round(totalVotes * 0.7)}</p>
            <p className="text-xs text-blue-600">نشط اليوم</p>
          </div>
          <div className="text-center p-3 bg-purple-100 rounded-xl">
            <p className="text-2xl font-bold text-purple-800">9</p>
            <p className="text-xs text-purple-600">أسئلة</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Checkbox Step Component (Generic)
interface CheckboxStepProps {
  title: string;
  emoji: string;
  options: { id: string; label: string; icon: string }[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  onNext: () => void;
  onPrev?: () => void;
  stepNumber: number;
  totalSteps: number;
}

function CheckboxStep({
  title,
  emoji,
  options,
  selectedValues,
  onSelectionChange,
  onNext,
  onPrev,
  stepNumber,
  totalSteps,
}: CheckboxStepProps) {
  const toggleOption = (optionId: string) => {
    if (selectedValues.includes(optionId)) {
      onSelectionChange(selectedValues.filter(id => id !== optionId));
    } else {
      onSelectionChange([...selectedValues, optionId]);
    }
  };

  return (
    <div className="px-4 py-6 animate-slide-up">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <span className="text-5xl mb-3 block">{emoji}</span>
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <p className="text-gray-500 mt-2">اختر جميع الخيارات المناسبة</p>
        </div>

        <div className="space-y-3">
          {options.map((option) => (
            <Card
              key={option.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                selectedValues.includes(option.id)
                  ? 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-200'
                  : 'border-gray-200 hover:border-green-300'
              }`}
              onClick={() => toggleOption(option.id)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <Checkbox
                  checked={selectedValues.includes(option.id)}
                  onChange={() => toggleOption(option.id)}
                  className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                />
                <span className="text-2xl">{option.icon}</span>
                <Label className="flex-1 cursor-pointer text-right font-medium text-gray-700">
                  {option.label}
                </Label>
                {selectedValues.includes(option.id) && (
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          {onPrev && (
            <Button
              variant="outline"
              onClick={onPrev}
              className="flex-1 py-5 rounded-xl border-2"
            >
              <ChevronRight className="ml-2 w-5 h-5" />
              رجوع
            </Button>
          )}
          <Button
            onClick={onNext}
            className="flex-1 py-5 rounded-xl bg-green-700 hover:bg-green-800"
          >
            التالي
            <ChevronLeft className="mr-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Step 2: Sports Activities
function SportsStep() {
  const { sportsActivities, setSportsActivities, nextStep, prevStep } = useSurveyStore();

  return (
    <CheckboxStep
      title="الأنشطة الرياضية"
      emoji="⚽"
      options={sportsOptions}
      selectedValues={sportsActivities}
      onSelectionChange={setSportsActivities}
      onNext={nextStep}
      onPrev={() => prevStep()}
      stepNumber={2}
      totalSteps={8}
    />
  );
}

// Step 3: Cultural Activities
function CulturalStep() {
  const { culturalActivities, setCulturalActivities, nextStep, prevStep } = useSurveyStore();

  return (
    <CheckboxStep
      title="الأنشطة الثقافية"
      emoji="📚"
      options={culturalOptions}
      selectedValues={culturalActivities}
      onSelectionChange={setCulturalActivities}
      onNext={nextStep}
      onPrev={() => prevStep()}
      stepNumber={3}
      totalSteps={8}
    />
  );
}

// Step 4: Social Activities
function SocialStep() {
  const { socialActivities, setSocialActivities, nextStep, prevStep } = useSurveyStore();

  return (
    <CheckboxStep
      title="الأنشطة الاجتماعية"
      emoji="👥"
      options={socialOptions}
      selectedValues={socialActivities}
      onSelectionChange={setSocialActivities}
      onNext={nextStep}
      onPrev={() => prevStep()}
      stepNumber={4}
      totalSteps={8}
    />
  );
}

// Step 5: Suggestions
function SuggestionsStep() {
  const { suggestions, setSuggestions, nextStep, prevStep } = useSurveyStore();

  return (
    <CheckboxStep
      title="مقترحات الجدارة"
      emoji="📋"
      options={suggestionsOptions}
      selectedValues={suggestions}
      onSelectionChange={setSuggestions}
      onNext={nextStep}
      onPrev={() => prevStep()}
      stepNumber={5}
      totalSteps={8}
    />
  );
}

// Choice Step Component (Generic)
interface ChoiceStepProps {
  title: string;
  question: string;
  options: {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
  };
  selectedValue: string | null;
  onSelect: (value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  stepNumber: number;
  totalSteps: number;
}

function ChoiceStep({
  title,
  question,
  options,
  selectedValue,
  onSelect,
  onNext,
  onPrev,
  stepNumber,
  totalSteps,
}: ChoiceStepProps & { options: typeof options extends infer T ? T[] : never }) {
  // This will be used with specific options arrays
  const allOptions = Array.isArray(options) ? options : [];
  
  return (
    <div className="px-4 py-6 animate-slide-up">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="mb-3 text-sm py-1 px-3">
            السؤال {stepNumber - 4} من 3
          </Badge>
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        </div>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-6">
            <p className="text-lg text-gray-700 text-center leading-relaxed">
              {question}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {allOptions.map((option: any) => (
            <Card
              key={option.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg overflow-hidden ${
                selectedValue === option.id
                  ? `${option.borderColor} ${option.bgColor} shadow-lg scale-[1.02]`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onSelect(option.id)}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${option.color} flex items-center justify-center text-white`}>
                  {option.icon}
                </div>
                <span className="flex-1 font-semibold text-gray-800 text-lg">
                  {option.label}
                </span>
                {selectedValue === option.id && (
                  <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onPrev}
            className="flex-1 py-5 rounded-xl border-2"
          >
            <ChevronRight className="ml-2 w-5 h-5" />
            رجوع
          </Button>
          <Button
            onClick={onNext}
            disabled={!selectedValue}
            className="flex-1 py-5 rounded-xl bg-green-700 hover:bg-green-800 disabled:opacity-50"
          >
            التالي
            <ChevronLeft className="mr-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Step 6: Question 1 - Satisfaction
function Question1Step() {
  const { question1Answer, setQuestion1Answer, nextStep, prevStep } = useSurveyStore();

  const options = [
    {
      id: 'satisfied',
      label: 'راضٍ جداً 😊',
      icon: <CircleCheck className="w-6 h-6" />,
      color: 'bg-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500',
    },
    {
      id: 'not_satisfied',
      label: 'غير راضٍ 😔',
      icon: <CircleX className="w-6 h-6" />,
      color: 'bg-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500',
    },
  ];

  return (
    <div className="px-4 py-6 animate-slide-up">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="mb-3 text-sm py-1 px-3">
            السؤال الأول من 3
          </Badge>
          <h2 className="text-2xl font-bold text-gray-800">السؤال الأول</h2>
        </div>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-6">
            <p className="text-lg text-gray-700 text-center leading-relaxed">
              هل أنت راضٍ عن أداء الإدارة الحالية لمجلس شباب قرية الأحمدي خلال السنوات السابقة؟
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {options.map((option) => (
            <Card
              key={option.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg overflow-hidden ${
                question1Answer === option.id
                  ? `${option.borderColor} ${option.bgColor} shadow-lg scale-[1.02]`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setQuestion1Answer(option.id as any)}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${option.color} flex items-center justify-center text-white`}>
                  {option.icon}
                </div>
                <span className="flex-1 font-semibold text-gray-800 text-lg">
                  {option.label}
                </span>
                {question1Answer === option.id && (
                  <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => prevStep()}
            className="flex-1 py-5 rounded-xl border-2"
          >
            <ChevronRight className="ml-2 w-5 h-5" />
            رجوع
          </Button>
          <Button
            onClick={() => nextStep()}
            disabled={!question1Answer}
            className="flex-1 py-5 rounded-xl bg-green-700 hover:bg-green-800 disabled:opacity-50"
          >
            التالي
            <ChevronLeft className="mr-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Step 7: Question 2 - Support Nomination
function Question2Step() {
  const { question2Answer, setQuestion2Answer, nextStep, prevStep } = useSurveyStore();

  const options = [
    {
      id: 'support',
      label: 'نعم، أويد 👍',
      icon: <ThumbsUp className="w-6 h-6" />,
      color: 'bg-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500',
    },
    {
      id: 'not_support',
      label: 'لا، لا أويد 👎',
      icon: <ThumbsDown className="w-6 h-6" />,
      color: 'bg-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500',
    },
  ];

  return (
    <div className="px-4 py-6 animate-slide-up">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="mb-3 text-sm py-1 px-3">
            السؤال الثاني من 3
          </Badge>
          <h2 className="text-2xl font-bold text-gray-800">السؤال الثاني</h2>
        </div>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-6">
            <p className="text-lg text-gray-700 text-center leading-relaxed">
              هل تويد ترشيح الشباب لإدارة مجلس شباب قرية الأحمدي خلال الفترة القادمة؟
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {options.map((option) => (
            <Card
              key={option.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg overflow-hidden ${
                question2Answer === option.id
                  ? `${option.borderColor} ${option.bgColor} shadow-lg scale-[1.02]`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setQuestion2Answer(option.id as any)}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${option.color} flex items-center justify-center text-white`}>
                  {option.icon}
                </div>
                <span className="flex-1 font-semibold text-gray-800 text-lg">
                  {option.label}
                </span>
                {question2Answer === option.id && (
                  <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => prevStep()}
            className="flex-1 py-5 rounded-xl border-2"
          >
            <ChevronRight className="ml-2 w-5 h-5" />
            رجوع
          </Button>
          <Button
            onClick={() => nextStep()}
            disabled={!question2Answer}
            className="flex-1 py-5 rounded-xl bg-green-700 hover:green-800 disabled:opacity-50"
          >
            التالي
            <ChevronLeft className="mr-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Step 8: Question 3 - Preferred Management
function Question3Step() {
  const { question3Answer, setQuestion3Answer, nextStep, prevStep } = useSurveyStore();

  const options = [
    {
      id: 'new_youth',
      label: 'شباب جدد 👤+',
      icon: <UserPlus className="w-6 h-6" />,
      color: 'bg-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-500',
    },
    {
      id: 'current_management',
      label: 'الإدارة الحالية 👤🔴',
      icon: <UserCheck className="w-6 h-6" />,
      color: 'bg-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500',
    },
  ];

  return (
    <div className="px-4 py-6 animate-slide-up">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <Badge variant="outline" className="mb-3 text-sm py-1 px-3">
            السؤال الثالث من 3
          </Badge>
          <h2 className="text-2xl font-bold text-gray-800">السؤال الثالث</h2>
        </div>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-6">
            <p className="text-lg text-gray-700 text-center leading-relaxed">
              من تفضل لإدارة مجلس شباب قرية الأحمدي في الفترة القادمة؟
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {options.map((option) => (
            <Card
              key={option.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg overflow-hidden ${
                question3Answer === option.id
                  ? `${option.borderColor} ${option.bgColor} shadow-lg scale-[1.02]`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setQuestion3Answer(option.id as any)}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${option.color} flex items-center justify-center text-white`}>
                  {option.icon}
                </div>
                <span className="flex-1 font-semibold text-gray-800 text-lg">
                  {option.label}
                </span>
                {question3Answer === option.id && (
                  <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => prevStep()}
            className="flex-1 py-5 rounded-xl border-2"
          >
            <ChevronRight className="ml-2 w-5 h-5" />
            رجوع
          </Button>
          <Button
            onClick={() => nextStep()}
            disabled={!question3Answer}
            className="flex-1 py-5 rounded-xl bg-green-700 hover:bg-green-800 disabled:opacity-50"
          >
            التالي
            <ChevronLeft className="mr-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Step 9: Media Recording
function MediaRecordingStep({ fingerprint }: { fingerprint: string | null }) {
  const { 
    mediaType, 
    setMediaType, 
    mediaBlob, 
    setMediaBlob, 
    surveyData,
    setIsSubmitting,
    setIsSubmitted,
    setResponseId,
    nextStep,
    prevStep
  } = useSurveyStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const maxTime = mediaType === 'audio' ? 15 : 30;

  const startCamera = async () => {
    try {
      const constraints = mediaType === 'video'
        ? { video: { facingMode: 'user' }, audio: true }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current && mediaType === 'video') {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }
      
      setCameraReady(true);
    } catch (err) {
      console.error('Error accessing media devices:', err);
      toast.error('لم نتمكن من الوصول إلى الكاميرا أو الميكروفون');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    
    const options = mediaType === 'video'
      ? { mimeType: 'video/webm;codecs=vp9,opus' }
      : { mimeType: 'audio/webm;codecs=opus' };

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaType === 'video' ? 'video/webm' : 'audio/webm' });
        setMediaBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setShowPreview(true);
        stopCamera();
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setTimeLeft(maxTime);

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      toast.error('حدث خطأ أثناء بدء التسجيل');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const retakeRecording = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedUrl(null);
    setMediaBlob(null);
    setShowPreview(false);
    setTimeLeft(maxTime);
    startCamera();
  };

  const submitSurvey = async (withMedia: boolean = false) => {
    if (!fingerprint) {
      toast.error('خطأ في التعرف على الجهاز');
      return;
    }

    setIsSubmitting(true);

    try {
      let mediaUrl = null;

      // Upload media if exists
      if (withMedia && mediaBlob) {
        const formData = new FormData();
        formData.append('file', mediaBlob, `recording.${mediaType === 'video' ? 'webm' : 'webm'}`);
        formData.append('type', mediaType!);
        formData.append('fingerprint', fingerprint);

        const uploadResponse = await fetch('/api/media/upload?XTransformPort=3000', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          mediaUrl = uploadData.url;
        }
      }

      // Submit survey data
      const surveyPayload = {
        deviceFingerprint: fingerprint,
        sportsActivities: JSON.stringify(surveyData.sportsActivities),
        culturalActivities: JSON.stringify(surveyData.culturalActivities),
        socialActivities: JSON.stringify(surveyData.socialActivities),
        suggestions: JSON.stringify(surveyData.suggestions),
        question1Answer: surveyData.question1Answer,
        question2Answer: surveyData.question2Answer,
        question3Answer: surveyData.question3Answer,
        mediaType: withMedia ? mediaType : null,
        mediaUrl: mediaUrl,
        status: 'pending',
      };

      const response = await fetch('/api/survey/submit?XTransformPort=3000', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(surveyPayload),
      });

      if (response.ok) {
        const data = await response.json();
        setHasVoted();
        setResponseId(data.id);
        setIsSubmitted(true);
        toast.success('تم إرسال الاستبيان بنجاح! شكراً لك 🎉');
      } else {
        throw new Error('Failed to submit survey');
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('حدث خطأ أثناء إرسال الاستبيان، يرجى المحاولة مرة أخرى');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectMediaType = (type: 'video' | 'audio' | null) => {
    setMediaType(type);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
      setMediaBlob(null);
      setShowPreview(false);
    }
    stopCamera();
    if (type) {
      setTimeout(() => startCamera(), 100);
    }
  };

  const shareOnWhatsApp = () => {
    const url = window.location.href;
    const text = 'شارك في استبيان مجلس شباب قرية الأحمدي 🗳️✨';
    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
  };

  return (
    <div className="px-4 py-6 animate-slide-up">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <span className="text-5xl mb-3 block">🎙️</span>
          <h2 className="text-2xl font-bold text-gray-800">تسجيل الوسائط</h2>
          <p className="text-gray-500 mt-2">اختياري - شارك رأيك بصوتك أو صورتك</p>
        </div>

        {!mediaType ? (
          /* Media Type Selection */
          <div className="space-y-4">
            <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
              <CardContent className="p-6 text-center">
                <p className="text-lg text-gray-700 mb-2">
                  هل تريد تسجيل فيديو أو صوت عن رأيك الشخصي؟
                </p>
                <p className="text-sm text-gray-500">
                  يمكنك تسجيل فيديو (30 ثانية) أو صوت (15 ثانية)
                </p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:shadow-lg border-green-300 bg-green-50"
              onClick={() => selectMediaType('video')}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center text-white">
                  <Video className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">تسجيل فيديو 📹</p>
                  <p className="text-sm text-gray-500">مدة أقصى 30 ثانية</p>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:shadow-lg border-green-300 bg-green-50"
              onClick={() => selectMediaType('audio')}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center text-white">
                  <Mic className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">تسجيل صوت 🎤</p>
                  <p className="text-sm text-gray-500">مدة أقصى 15 ثانية</p>
                </div>
              </CardContent>
            </Card>

            <Separator />

            <Button
              variant="outline"
              onClick={() => submitSurvey(false)}
              className="w-full py-6 rounded-xl border-2 border-gray-300 text-gray-600"
            >
              <SkipForward className="ml-2 w-5 h-5" />
              تخطي وإرسال الاستبيان فقط
            </Button>
          </div>
        ) : showPreview ? (
          /* Preview Mode */
          <div className="space-y-4">
            <Card className="overflow-hidden border-green-300">
              <CardContent className="p-4">
                {mediaType === 'video' && recordedUrl ? (
                  <video 
                    src={recordedUrl} 
                    controls 
                    className="w-full rounded-lg max-h-80 object-contain bg-black"
                  />
                ) : recordedUrl ? (
                  <audio src={recordedUrl} controls className="w-full" />
                ) : null}
                
                <div className="mt-4 flex gap-3">
                  <Button
                    variant="outline"
                    onClick={retakeRecording}
                    className="flex-1 py-4 rounded-xl"
                  >
                    <Camera className="ml-2 w-5 h-5" />
                    إعادة التسجيل
                  </Button>
                  <Button
                    onClick={() => submitSurvey(true)}
                    disabled={!mediaBlob}
                    className="flex-1 py-4 rounded-xl bg-green-700 hover:bg-green-800"
                  >
                    <Send className="ml-2 w-5 h-5" />
                    إرسال مع التسجيل
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Recording Mode */
          <div className="space-y-4">
            <Card className="overflow-hidden border-green-300">
              <CardContent className="p-4">
                {/* Video Preview or Audio Indicator */}
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                  {mediaType === 'video' ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center">
                      <Mic className={`w-20 h-20 mx-auto ${isRecording ? 'text-red-500 recording-pulse' : 'text-gray-400'}`} />
                      <p className="text-white mt-2">الميكروفون نشط</p>
                    </div>
                  )}

                  {/* Recording Timer Overlay */}
                  {isRecording && (
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      <span className="font-mono font-bold">{timeLeft}s</span>
                    </div>
                  )}
                </div>

                {/* Timer Progress */}
                <div className="mt-4">
                  <Progress value={((maxTime - timeLeft) / maxTime) * 100} className="h-2" />
                  <p className="text-center text-sm text-gray-500 mt-2">
                    الوقت المتبقي: {timeLeft} ثانية
                  </p>
                </div>

                {/* Controls */}
                <div className="mt-6 flex justify-center gap-4">
                  {!isRecording ? (
                    <Button
                      onClick={startRecording}
                      disabled={!cameraReady}
                      size="lg"
                      className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 rounded-full h-16 w-16"
                    >
                      <div className="w-6 h-6 bg-white rounded-full"></div>
                    </Button>
                  ) : (
                    <Button
                      onClick={stopRecording}
                      size="lg"
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700 text-white px-8 py-6 rounded-full h-16 w-16 recording-pulse"
                    >
                      <div className="w-6 h-6 bg-white rounded-sm"></div>
                    </Button>
                  )}
                </div>

                <p className="text-center text-sm text-gray-500 mt-4">
                  {isRecording ? 'اضغط لإيقاف التسجيل' : 'اضغط لبدء التسجيل'}
                </p>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  stopCamera();
                  setMediaType(null);
                }}
                className="flex-1 py-4 rounded-xl"
              >
                <ChevronRight className="ml-2 w-5 h-5" />
                رجوع
              </Button>
              <Button
                variant="outline"
                onClick={() => submitSurvey(false)}
                className="flex-1 py-4 rounded-xl"
              >
                <SkipForward className="ml-2 w-5 h-5" />
                تخطي
              </Button>
            </div>
          </div>
        )}

        {/* Share Section */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <p className="text-green-800 mb-3">شارك الاستبيان مع أصدقائك!</p>
            <Button
              variant="outline"
              onClick={shareOnWhatsApp}
              className="bg-green-600 text-white hover:bg-green-700 border-0"
            >
              <MessageCircle className="ml-2 w-5 h-5" />
              مشاركة عبر واتساب
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Thank You Page
function ThankYouPage({ onReset }: { onReset: () => void }) {
  const shareOnWhatsApp = () => {
    const url = window.location.href;
    const text = 'شاركت في استبيان مجلس شباب قرية الأحمدي! شارك أنت أيضاً 🗳️✨';
    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
  };

  return (
    <div className="px-4 py-8 animate-scale-in">
      <div className="max-w-lg mx-auto text-center space-y-6">
        <div className="w-28 h-28 mx-auto bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-xl">
          <PartyPopper className="w-14 h-14 text-white" />
        </div>

        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">
            شكراً لك! 🎉
          </h2>
          <p className="text-lg text-gray-600">
            تم إرسال استبيانك بنجاح
          </p>
          <p className="text-gray-500 mt-2">
            مشاركتك تهمنا وتصوتك يصنع الفرق
          </p>
        </div>

        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            </div>
            <p className="text-green-800 font-medium">
              أصبحت جزءاً من تغيير إيجابي في قريتك
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Button
            onClick={shareOnWhatsApp}
            className="w-full py-5 rounded-xl bg-green-700 hover:bg-green-800"
          >
            <Share2 className="ml-2 w-5 h-5" />
            شارك مع أصدقائك على واتساب
          </Button>
          
          <Button
            variant="outline"
            onClick={onReset}
            className="w-full py-5 rounded-xl border-2"
          >
            <Home className="ml-2 w-5 h-5" />
            العودة للصفحة الرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
}

// Gallery Content Component
function GalleryContent() {
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'video' | 'audio'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchApprovedMedia();
  }, []);

  const fetchApprovedMedia = async () => {
    try {
      const response = await fetch('/api/gallery?XTransformPort=3000');
      if (response.ok) {
        const data = await response.json();
        setMediaItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching gallery:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = filter === 'all' 
    ? mediaItems 
    : mediaItems.filter(item => item.mediaType === filter);

  return (
    <div className="px-4 py-6 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
            <FileVideo className="w-7 h-7 text-green-600" />
            معرض الآراء والتسجيلات
          </h2>
          <p className="text-gray-500 mt-2">آراء وتسجيلات أهل القرية المعتمدة</p>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 justify-center">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'bg-green-700' : ''}
          >
            الكل ({mediaItems.length})
          </Button>
          <Button
            variant={filter === 'video' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('video')}
            className={filter === 'video' ? 'bg-green-700' : ''}
          >
            <Video className="ml-1 w-4 h-4" />
            فيديو ({mediaItems.filter(i => i.mediaType === 'video').length})
          </Button>
          <Button
            variant={filter === 'audio' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('audio')}
            className={filter === 'audio' ? 'bg-green-700' : ''}
          >
            <Mic className="ml-1 w-4 h-4" />
            صوت ({mediaItems.filter(i => i.mediaType === 'audio').length})
          </Button>
        </div>

        {/* Gallery Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="aspect-video bg-gray-200 rounded-lg"></div>
                  <div className="mt-3 h-4 bg-gray-200 rounded w-3/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredItems.map((item, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-3">
                  {item.mediaType === 'video' ? (
                    <video 
                      src={item.mediaUrl} 
                      controls 
                      className="w-full rounded-lg aspect-video object-cover bg-black"
                      preload="metadata"
                    />
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                      <audio src={item.mediaUrl} controls className="w-full px-4" preload="metadata" />
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {item.mediaType === 'video' ? 'فيديو' : 'صوت'}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-2 border-gray-300">
            <CardContent className="p-8 text-center">
              <Video className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">لا توجد تسجيلات معروضة حالياً</p>
              <p className="text-sm text-gray-400 mt-2">
                سيظهر هنا التسجيلات بعد موافقة الإدارة
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Stats Content Component
function StatsContent() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats?XTransformPort=3000');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full animate-pulse mx-auto mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-48 mx-auto animate-pulse"></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const q1Satisfied = stats?.question1?.satisfied || 0;
  const q1NotSatisfied = stats?.question1?.not_satisfied || 0;
  const q1Total = q1Satisfied + q1NotSatisfied;
  
  const q2Support = stats?.question2?.support || 0;
  const q2NotSupport = stats?.question2?.not_support || 0;
  const q2Total = q2Support + q2NotSupport;
  
  const q3NewYouth = stats?.question3?.new_youth || 0;
  const q3Current = stats?.question3?.current_management || 0;
  const q3Total = q3NewYouth + q3Current;

  return (
    <div className="px-4 py-6 animate-fade-in">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-green-600 mb-3" />
          <h2 className="text-2xl font-bold text-gray-800">إحصائيات الاستبيان</h2>
          <p className="text-gray-500 mt-2">نتائج حية ومحدثة</p>
        </div>

        {/* Total Votes */}
        <Card className="border-green-200 bg-gradient-to-r from-green-600 to-green-700 text-white overflow-hidden">
          <CardContent className="p-6 text-center">
            <p className="text-green-100 text-sm">إجمالي عدد المصوتين</p>
            <p className="text-5xl font-bold mt-2">{stats?.totalResponses || 0}</p>
            <p className="text-green-200 text-sm mt-2">مشاركة حتى الآن</p>
          </CardContent>
        </Card>

        {/* Question 1 Stats */}
        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
              <span>❓</span>
              السؤال الأول: الرضا عن الإدارة الحالية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-700 font-medium">راضٍ جداً 😊</span>
                  <span className="text-gray-600">
                    {q1Total > 0 ? Math.round((q1Satisfied / q1Total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${q1Total > 0 ? (q1Satisfied / q1Total) * 100 : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{q1Satisfied} تصويت</p>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-600 font-medium">غير راضٍ 😔</span>
                  <span className="text-gray-600">
                    {q1Total > 0 ? Math.round((q1NotSatisfied / q1Total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full transition-all duration-500"
                    style={{ width: `${q1Total > 0 ? (q1NotSatisfied / q1Total) * 100 : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{q1NotSatisfied} تصويت</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question 2 Stats */}
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
              <span>❓</span>
              السؤال الثاني: دعم ترشيح الشباب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-700 font-medium">نعم، أويد 👍</span>
                  <span className="text-gray-600">
                    {q2Total > 0 ? Math.round((q2Support / q2Total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${q2Total > 0 ? (q2Support / q2Total) * 100 : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{q2Support} تصويت</p>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-600 font-medium">لا، لا أويد 👎</span>
                  <span className="text-gray-600">
                    {q2Total > 0 ? Math.round((q2NotSupport / q2Total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full transition-all duration-500"
                    style={{ width: `${q2Total > 0 ? (q2NotSupport / q2Total) * 100 : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{q2NotSupport} تصويت</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question 3 Stats */}
        <Card className="border-purple-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
              <span>❓</span>
              السؤال الثالث: الإدارة المفضلة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-blue-600 font-medium">شباب جدد 👤+</span>
                  <span className="text-gray-600">
                    {q3Total > 0 ? Math.round((q3NewYouth / q3Total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${q3Total > 0 ? (q3NewYouth / q3Total) * 100 : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{q3NewYouth} تصويت</p>
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-600 font-medium">الإدارة الحالية 👤🔴</span>
                  <span className="text-gray-600">
                    {q3Total > 0 ? Math.round((q3Current / q3Total) * 100) : 0}%
                  </span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full transition-all duration-500"
                    style={{ width: `${q3Total > 0 ? (q3Current / q3Total) * 100 : 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{q3Current} تصويت</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Stats */}
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
              <Heart className="w-5 h-5 text-orange-500" />
              الأنشطة الأكثر طلباً
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.topActivities?.slice(0, 5).map((activity: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                  <span className="text-sm text-gray-700 truncate flex-1 ml-2">
                    {activity.label}
                  </span>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                    {activity.count}
                  </Badge>
                </div>
              )) || (
                <p className="text-gray-500 text-center py-4">لا توجد بيانات كافية</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
