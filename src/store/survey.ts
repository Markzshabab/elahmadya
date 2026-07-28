import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SurveyData {
  // Step 2: Sports Activities
  sportsActivities: string[];
  // Step 3: Cultural Activities
  culturalActivities: string[];
  // Step 4: Social Activities
  socialActivities: string[];
  // Step 5: Suggestions
  suggestions: string[];
  // Step 6: Question 1 - Satisfaction with current management
  question1Answer: 'satisfied' | 'not_satisfied' | null;
  // Step 7: Question 2 - Support for youth nomination
  question2Answer: 'support' | 'not_support' | null;
  // Step 8: Question 3 - Preferred management
  question3Answer: 'new_youth' | 'current_management' | null;
  // Step 9: Media
  mediaType: 'video' | 'audio' | null;
  mediaBlob: Blob | null;
  mediaUrl: string | null;
}

interface SurveyStore {
  currentStep: number;
  surveyData: SurveyData;
  isSubmitting: boolean;
  isSubmitted: boolean;
  responseId: string | null;
  
  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  
  // Data setters
  setSportsActivities: (activities: string[]) => void;
  setCulturalActivities: (activities: string[]) => void;
  setSocialActivities: (activities: string[]) => void;
  setSuggestions: (suggestions: string[]) => void;
  setQuestion1Answer: (answer: 'satisfied' | 'not_satisfied') => void;
  setQuestion2Answer: (answer: 'support' | 'not_support') => void;
  setQuestion3Answer: (answer: 'new_youth' | 'current_management') => void;
  setMediaType: (type: 'video' | 'audio' | null) => void;
  setMediaBlob: (blob: Blob | null) => void;
  setMediaUrl: (url: string | null) => void;
  
  // Submission
  setIsSubmitting: (value: boolean) => void;
  setIsSubmitted: (value: boolean) => void;
  setResponseId: (id: string | null) => void;
  
  // Reset
  resetSurvey: () => void;
}

const initialSurveyData: SurveyData = {
  sportsActivities: [],
  culturalActivities: [],
  socialActivities: [],
  suggestions: [],
  question1Answer: null,
  question2Answer: null,
  question3Answer: null,
  mediaType: null,
  mediaBlob: null,
  mediaUrl: null,
};

export const useSurveyStore = create<SurveyStore>()(
  persist(
    (set) => ({
      currentStep: 0,
      surveyData: { ...initialSurveyData },
      isSubmitting: false,
      isSubmitted: false,
      responseId: null,

      setStep: (step) => set({ currentStep: step }),
      
      nextStep: () => set((state) => ({ 
        currentStep: Math.min(state.currentStep + 1, 8) 
      })),
      
      prevStep: () => set((state) => ({ 
        currentStep: Math.max(state.currentStep - 1, 0) 
      })),

      setSportsActivities: (activities) => set((state) => ({
        surveyData: { ...state.surveyData, sportsActivities: activities }
      })),

      setCulturalActivities: (activities) => set((state) => ({
        surveyData: { ...state.surveyData, culturalActivities: activities }
      })),

      setSocialActivities: (activities) => set((state) => ({
        surveyData: { ...state.surveyData, socialActivities: activities }
      })),

      setSuggestions: (suggestions) => set((state) => ({
        surveyData: { ...state.surveyData, suggestions }
      })),

      setQuestion1Answer: (answer) => set((state) => ({
        surveyData: { ...state.surveyData, question1Answer: answer }
      })),

      setQuestion2Answer: (answer) => set((state) => ({
        surveyData: { ...state.surveyData, question2Answer: answer }
      })),

      setQuestion3Answer: (answer) => set((state) => ({
        surveyData: { ...state.surveyData, question3Answer: answer }
      })),

      setMediaType: (type) => set((state) => ({
        surveyData: { ...state.surveyData, mediaType: type }
      })),

      setMediaBlob: (blob) => set((state) => ({
        surveyData: { ...state.surveyData, mediaBlob: blob }
      })),

      setMediaUrl: (url) => set((state) => ({
        surveyData: { ...state.surveyData, mediaUrl: url }
      })),

      setIsSubmitting: (value) => set({ isSubmitting: value }),
      setIsSubmitted: (value) => set({ isSubmitted: value }),
      setResponseId: (id) => set({ responseId: id }),

      resetSurvey: () => set({
        currentStep: 0,
        surveyData: { ...initialSurveyData },
        isSubmitting: false,
        isSubmitted: false,
        responseId: null,
      }),
    }),
    {
      name: 'survey-storage',
      partialize: (state) => ({
        currentStep: state.currentStep,
        surveyData: state.surveyData,
        isSubmitted: state.isSubmitted,
      }),
    }
  )
);
