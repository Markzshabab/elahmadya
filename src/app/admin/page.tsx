'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// Icons
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Video,
  Mic,
  Eye,
  Download,
  Filter,
  Search,
  ArrowLeft,
  Users,
  BarChart3,
  FileVideo
} from 'lucide-react';

interface SurveyResponse {
  id: string;
  deviceFingerprint: string;
  sportsActivities: string;
  culturalActivities: string;
  socialActivities: string;
  suggestions: string;
  question1Answer: string;
  question2Answer: string;
  question3Answer: string;
  mediaType: string | null;
  mediaUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null);

  // Simple password authentication (in production, use proper auth)
  const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      fetchResponses();
    } else {
      toast.error('كلمة المرور غير صحيحة');
    }
  };

  const fetchResponses = async () => {
    try {
      const response = await fetch('/api/survey/submit?XTransformPort=3000');
      const data = await response.json();
      setResponses(data.responses || []);
    } catch (error) {
      console.error('Error fetching responses:', error);
      toast.error('حدث خطأ في جلب البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/approve/${id}?XTransformPort=3000`, {
        method: 'POST',
      });
      
      if (response.ok) {
        toast.success('تمت الموافقة على الاستجابة');
        fetchResponses();
        setSelectedResponse(null);
      }
    } catch (error) {
      toast.error('حدث خطأ');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/reject/${id}?XTransformPort=3000`, {
        method: 'POST',
      });
      
      if (response.ok) {
        toast.success('تم رفض الاستجابة');
        fetchResponses();
        setSelectedResponse(null);
      }
    } catch (error) {
      toast.error('حدث خطأ');
    }
  };

  const exportData = () => {
    const dataToExport = filteredResponses.map(r => ({
      'المعرف': r.id.slice(0, 8),
      'الأنشطة الرياضية': JSON.parse(r.sportsActivities || '[]').join(', '),
      'الأنشطة الثقافية': JSON.parse(r.culturalActivities || '[]').join(', '),
      'الأنشطة الاجتماعية': JSON.parse(r.socialActivities || '[]').join(', '),
      'المقترحات': JSON.parse(r.suggestions || '[]').join(', '),
      'الرضا عن الإدارة': r.question1Answer === 'satisfied' ? 'راضٍ' : 'غير راضٍ',
      'دعم ترشيح الشباب': r.question2Answer === 'support' ? 'نعم' : 'لا',
      'الإدارة المفضلة': r.question3Answer === 'new_youth' ? 'شباب جدد' : 'الإدارة الحالية',
      'نوع الوسائط': r.mediaType || '-',
      'الحالة': r.status,
      'تاريخ الإنشاء': new Date(r.createdAt).toLocaleDateString('ar-SA'),
    }));

    const csvContent = [
      Object.keys(dataToExport[0]).join(','),
      ...dataToExport.map(row => Object.values(row).map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `survey_responses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success('تم تصدير البيانات بنجاح');
  };

  const filteredResponses = responses.filter(response => {
    if (filter !== 'all' && response.status !== filter) return false;
    if (searchTerm && !response.id.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: responses.length,
    pending: responses.filter(r => r.status === 'pending').length,
    approved: responses.filter(r => r.status === 'approved').length,
    rejected: responses.filter(r => r.status === 'rejected').length,
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-100 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">لوحة تحكم الأدمن</h1>
              <p className="text-gray-500 mt-2">مجلس شباب قرية الأحمدي</p>
            </div>

            <div className="space-y-4">
              <Input
                type="password"
                placeholder="أدخل كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="text-center text-lg py-5"
              />
              
              <Button
                onClick={handleLogin}
                className="w-full py-5 bg-green-700 hover:bg-green-800"
              >
                دخول
              </Button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">
              للوصول إلى لوحة التحكم، أدخل كلمة المرور
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <header className="bg-gradient-to-l from-gray-800 to-gray-900 text-white py-6 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">لوحة تحكم الأدمن</h1>
              <p className="text-gray-300 text-sm">إدارة استبيان مجلس شباب قرية الأحمدي</p>
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={() => window.location.href = '/'}
            className="border-gray-500 text-white hover:bg-gray-700"
          >
            <ArrowLeft className="ml-2 w-4 h-4" />
            العودة للموقع
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-blue-200">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto text-blue-600 mb-2" />
              <p className="text-2xl font-bold text-blue-800">{stats.total}</p>
              <p className="text-sm text-gray-600">إجمالي الاستجابات</p>
            </CardContent>
          </Card>
          
          <Card className="border-yellow-200">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 mx-auto text-yellow-600 mb-2" />
              <p className="text-2xl font-bold text-yellow-800">{stats.pending}</p>
              <p className="text-sm text-gray-600">قيد الانتظار</p>
            </CardContent>
          </Card>
          
          <Card className="border-green-200">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 mb-2" />
              <p className="text-2xl font-bold text-green-800">{stats.approved}</p>
              <p className="text-sm text-gray-600">تمت الموافقة</p>
            </CardContent>
          </Card>
          
          <Card className="border-red-200">
            <CardContent className="p-4 text-center">
              <XCircle className="w-8 h-8 mx-auto text-red-600 mb-2" />
              <p className="text-2xl font-bold text-red-800">{stats.rejected}</p>
              <p className="text-sm text-gray-600">مرفوضة</p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                  className={filter === 'all' ? 'bg-gray-800' : ''}
                >
                  الكل ({stats.total})
                </Button>
                <Button
                  variant={filter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('pending')}
                  className={filter === 'pending' ? 'bg-yellow-600' : ''}
                >
                  <Clock className="ml-1 w-4 h-4" />
                  قيد الانتظار ({stats.pending})
                </Button>
                <Button
                  variant={filter === 'approved' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('approved')}
                  className={filter === 'approved' ? 'bg-green-600' : ''}
                >
                  <CheckCircle2 className="ml-1 w-4 h-4" />
                  موافق عليه ({stats.approved})
                </Button>
                <Button
                  variant={filter === 'rejected' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('rejected')}
                  className={filter === 'rejected' ? 'bg-red-600' : ''}
                >
                  <XCircle className="ml-1 w-4 h-4" />
                  مرفوض ({stats.rejected})
                </Button>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="بحث بالمعرف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-9"
                  />
                </div>
                
                <Button
                  variant="outline"
                  onClick={exportData}
                  className="shrink-0"
                >
                  <Download className="ml-2 w-4 h-4" />
                  تصدير
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Responses Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileVideo className="w-5 h-5" />
              الاستجابات ({filteredResponses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : filteredResponses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-600">المعرف</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-600">الرضا</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-600">الدعم</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-600">التفضيل</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-600">الوسائط</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-600">الحالة</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-600">التاريخ</th>
                      <th className="text-right py-3 px-3 text-sm font-medium text-gray-600">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResponses.map((response) => (
                      <tr key={response.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {response.id.slice(0, 8)}...
                          </code>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={response.question1Answer === 'satisfied' ? 'default' : 'destructive'} 
                                  className={response.question1Answer === 'satisfied' ? 'bg-green-100 text-green-800' : ''}>
                            {response.question1Answer === 'satisfied' ? 'راضٍ 😊' : 'غير راضٍ 😔'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={response.question2Answer === 'support' ? 'default' : 'destructive'}
                                  className={response.question2Answer === 'support' ? 'bg-green-100 text-green-800' : ''}>
                            {response.question2Answer === 'support' ? 'نعم 👍' : 'لا 👎'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={response.question3Answer === 'new_youth' ? 'default' : 'destructive'}
                                  className={response.question3Answer === 'new_youth' ? 'bg-blue-100 text-blue-800' : ''}>
                            {response.question3Answer === 'new_youth' ? 'شباب جدد' : 'الحالية'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          {response.mediaType ? (
                            <Badge variant="outline" className="gap-1">
                              {response.mediaType === 'video' ? (
                                <><Video className="w-3 h-3" /> فيديو</>
                              ) : (
                                <><Mic className="w-3 h-3" /> صوت</>
                              )}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <Badge 
                            variant="outline"
                            className={
                              response.status === 'approved' ? 'border-green-500 text-green-700' :
                              response.status === 'rejected' ? 'border-red-500 text-red-700' :
                              'border-yellow-500 text-yellow-700'
                            }
                          >
                            {response.status === 'approved' ? <CheckCircle2 className="w-3 h-3 ml-1 inline" /> :
                             response.status === 'rejected' ? <XCircle className="w-3 h-3 ml-1 inline" /> :
                             <Clock className="w-3 h-3 ml-1 inline" />}
                            {response.status === 'approved' ? 'موافق' :
                             response.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار'}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-sm text-gray-600">
                          {new Date(response.createdAt).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedResponse(response)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            {response.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleApprove(response.id)}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleReject(response.id)}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">لا توجد استجابات مطابقة</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Response Detail Modal */}
      {selectedResponse && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedResponse(null)}>
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>تفاصيل الاستجابة</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedResponse(null)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">المعرف</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded block mt-1 break-all">
                    {selectedResponse.id}
                  </code>
                </div>
                <div>
                  <p className="text-sm text-gray-500">التاريخ</p>
                  <p className="font-medium mt-1">
                    {new Date(selectedResponse.createdAt).toLocaleString('ar-SA')}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-gray-500 mb-2">الأنشطة الرياضية</p>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(selectedResponse.sportsActivities || '[]').map((activity: string, i: number) => (
                    <Badge key={i} variant="secondary">{activity}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">الأنشطة الثقافية</p>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(selectedResponse.culturalActivities || '[]').map((activity: string, i: number) => (
                    <Badge key={i} variant="secondary">{activity}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">الأنشطة الاجتماعية</p>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(selectedResponse.socialActivities || '[]').map((activity: string, i: number) => (
                    <Badge key={i} variant="secondary">{activity}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">المقترحات</p>
                <div className="flex flex-wrap gap-2">
                  {JSON.parse(selectedResponse.suggestions || '[]').map((activity: string, i: number) => (
                    <Badge key={i} variant="secondary">{activity}</Badge>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">الرضا عن الإدارة</p>
                  <p className="font-semibold">
                    {selectedResponse.question1Answer === 'satisfied' ? 'راضٍ 😊' : 'غير راضٍ 😔'}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">دعم الترشيح</p>
                  <p className="font-semibold">
                    {selectedResponse.question2Answer === 'support' ? 'نعم 👍' : 'لا 👎'}
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-xs text-gray-500 mb-1">الإدارة المفضلة</p>
                  <p className="font-semibold">
                    {selectedResponse.question3Answer === 'new_youth' ? 'شباب جدد 👤+' : 'الحالية 👤🔴'}
                  </p>
                </div>
              </div>

              {selectedResponse.mediaUrl && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-gray-500 mb-2">الوسائط المسجلة</p>
                    {selectedResponse.mediaType === 'video' ? (
                      <video src={selectedResponse.mediaUrl} controls className="w-full rounded-lg max-h-64" />
                    ) : (
                      <audio src={selectedResponse.mediaUrl} controls className="w-full" />
                    )}
                  </div>
                </>
              )}

              {selectedResponse.status === 'pending' && (
                <>
                  <Separator />
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(selectedResponse.id)}
                    >
                      <XCircle className="ml-2 w-4 h-4" />
                      رفض
                    </Button>
                    <Button
                      className="bg-green-700 hover:bg-green-800"
                      onClick={() => handleApprove(selectedResponse.id)}
                    >
                      <CheckCircle2 className="ml-2 w-4 h-4" />
                      موافقة
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
