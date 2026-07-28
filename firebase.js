/**
 * Al Ahmadiya Youth Center Survey - Firebase Initialization
 * Built for Vanilla JS (ES Modules) - Production Ready
 */

// 1. استدعاء مكتبات Firebase الأساسية مباشرة من الـ CDN الرسمية
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    onValue, 
    get, 
    child 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 2. بيانات تهيئة مشروع markzshabab
const firebaseConfig = {
    apiKey: "AIzaSyAB6GT-198Ns1W8a722ACFeouK6RvUDuwc",
    authDomain: "markzshabab-4c01b.firebaseapp.com",
    databaseURL: "https://markzshabab-4c01b-default-rtdb.firebaseio.com",
    projectId: "markzshabab-4c01b",
    storageBucket: "markzshabab-4c01b.firebasestorage.app",
    messagingSenderId: "537337823216",
    appId: "1:537337823216:web:476ed6c701d604bf426735",
    measurementId: "G-ELPET4VC22"
};

// 3. تهيئة التطبيق وقاعدة البيانات Realtime Database
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/**
 * دالة لمراقبة الإحصائيات لحظياً في الواجهة العامة (Real-time Listener)
 * @param {Function} callback - الدالة التي سيتم استدعاؤها فور تحديث البيانات
 */
export function listenToLiveStats(callback) {
    const statsRef = ref(db, 'survey/submissions');
    onValue(statsRef, (snapshot) => {
        const data = snapshot.val();
        
        let stats = {
            total: 0,
            q1_satisfied: 0,
            q1_not: 0,
            q2_yes: 0,
            q2_no: 0,
            q3_new: 0,
            q3_current: 0,
            video_count: 0,
            audio_count: 0
        };

        if (data) {
            Object.values(data).forEach(sub => {
                stats.total++;
                
                // Q1
                if (sub.votes?.q1 === 'Very Satisfied') stats.q1_satisfied++;
                if (sub.votes?.q1 === 'Not Satisfied') stats.q1_not++;
                
                // Q2
                if (sub.votes?.q2 === 'Yes') stats.q2_yes++;
                if (sub.votes?.q2 === 'No') stats.q2_no++;
                
                // Q3
                if (sub.votes?.q3 === 'New Youth') stats.q3_new++;
                if (sub.votes?.q3 === 'Current Management') stats.q3_current++;
                
                // Media
                if (sub.mediaType === 'video' && sub.status === 'approved') stats.video_count++;
                if (sub.mediaType === 'audio' && sub.status === 'approved') stats.audio_count++;
            });
        }

        callback(stats);
    }, (error) => {
        console.error("Firebase Realtime Listener Error:", error);
    });
}

// تصدير الكائنات والدوال لاستخدامها عند الحاجة في باقي الملفات
export { app, db, ref, onValue, get, child };