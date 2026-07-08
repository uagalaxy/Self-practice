import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getDatabase, ref, set, onValue, get, remove } from "firebase/database";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDoVWb4rxNm5Urf85vPiuRzXm5S2f1U_oA",
  authDomain: "ujjwal-rhythm.firebaseapp.com",
  databaseURL: "https://ujjwal-rhythm-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ujjwal-rhythm",
  storageBucket: "ujjwal-rhythm.firebasestorage.app",
  messagingSenderId: "594042991928",
  appId: "1:594042991928:web:0c2f5a95d38b18b3f5fdcd",
  measurementId: "G-XRGXZZQ5TE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const fs = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [activeTab, setActiveTab] = useState('study');
  const [studySubTab, setStudySubTab] = useState('quiz');
  const [toast, setToast] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);

  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [quizScore, setQuizScore] = useState({ correct: 0, wrong: 0 });
  const [quizFinished, setQuizFinished] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  const [timerMode, setTimerMode] = useState('Focus');
  const [timerStatus, setTimerStatus] = useState('idle');
  const [timeLeft, setTimeLeft] = useState(1500);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);
  const totalDurationRef = useRef(1500);
  const timerIntervalRef = useRef(null);

  const [routines, setRoutines] = useState([]);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineTime, setNewRoutineTime] = useState('');

  const [studyHistory, setStudyHistory] = useState({});
  const [quizHistory, setQuizHistory] = useState({ correct: 0, wrong: 0 });
  const [openDayAccordion, setOpenDayAccordion] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        loadUserData(currentUser.uid);
      } else {
        setUser(null);
        loadLocalData();
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (timerStatus === 'running' && timeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerStatus === 'running') {
      handleTimerCompletion();
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [timerStatus, timeLeft]);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadUserData = (uid) => {
    onValue(ref(db, `users/${uid}/routines`), (snapshot) => {
      if (snapshot.exists()) {
        setRoutines(snapshot.val());
      }
    });
    const savedStudy = localStorage.getItem(`study_history_${uid}`);
    const savedQuiz = localStorage.getItem(`quiz_history_${uid}`);
    
    let processedStudy = savedStudy ? JSON.parse(savedStudy) : {};
    processedStudy = cleanOldHistoryData(processedStudy);
    setStudyHistory(processedStudy);
    localStorage.setItem(`study_history_${uid}`, JSON.stringify(processedStudy));

    if (savedQuiz) setQuizHistory(JSON.parse(savedQuiz));
  };

  const loadLocalData = () => {
    const localRoutines = localStorage.getItem('local_routines');
    if (localRoutines) setRoutines(JSON.parse(localRoutines));
    
    let localStudy = localStorage.getItem('local_study_history');
    localStudy = localStudy ? JSON.parse(localStudy) : {};
    localStudy = cleanOldHistoryData(localStudy);
    setStudyHistory(localStudy);
    localStorage.setItem('local_study_history', JSON.stringify(localStudy));

    const localQuiz = localStorage.getItem('local_quiz_history');
    if (localQuiz) setQuizHistory(JSON.parse(localQuiz));
  };

  const cleanOldHistoryData = (historyObj) => {
    const cleaned = {};
    const validDates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      validDates.push(d.toISOString().split('T')[0]);
    }
    Object.keys(historyObj).forEach(dateStr => {
      if (validDates.includes(dateStr)) {
        cleaned[dateStr] = historyObj[dateStr];
      }
    });
    return cleaned;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: username });
        triggerToast("Account created successfully!");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        triggerToast("Welcome back!");
      }
    } catch (err) {
      triggerToast(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      triggerToast("Signed in with Google");
    } catch (err) {
      triggerToast(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setProfileOpen(false);
      triggerToast("Signed out");
    } catch (err) {
      triggerToast(err.message);
    }
  };

  const generateQuiz = async () => {
    if (!topic.trim()) return triggerToast("Please enter a topic");
    setIsGeneratingQuiz(true);
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          difficulty,
          numQuestions,
          userApiKey: "AIzaSyDoVWb4rxNm5Urf85vPiuRzXm5S2f1U_oA"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed generation");
      setQuizQuestions(data);
      setCurrentQuizIdx(0);
      setSelectedAnswer('');
      setQuizScore({ correct: 0, wrong: 0 });
      setQuizFinished(false);
      triggerToast("Quiz Ready!");
    } catch (err) {
      triggerToast(err.message);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleAnswerSubmit = () => {
    if (!selectedAnswer) return triggerToast("Select an option");
    const currentQ = quizQuestions[currentQuizIdx];
    const isCorrect = selectedAnswer === currentQ.correctAnswer;
    
    setQuizScore(prev => {
      const nextScore = {
        correct: prev.correct + (isCorrect ? 1 : 0),
        wrong: prev.wrong + (isCorrect ? 0 : 1)
      };
      
      const updatedQuizHistory = {
        correct: quizHistory.correct + (isCorrect ? 1 : 0),
        wrong: quizHistory.wrong + (isCorrect ? 0 : 1)
      };
      setQuizHistory(updatedQuizHistory);
      const suffix = user ? user.uid : 'local';
      localStorage.setItem(`quiz_history_${suffix}`, JSON.stringify(updatedQuizHistory));
      
      return nextScore;
    });

    if (currentQuizIdx + 1 < quizQuestions.length) {
      setCurrentQuizIdx(prev => prev + 1);
      setSelectedAnswer('');
    } else {
      setQuizFinished(true);
    }
  };

  const startTimer = () => {
    if (timerStatus === 'idle') {
      totalDurationRef.current = customMinutes * 60;
      setTimeLeft(customMinutes * 60);
    }
    setTimerStatus('running');
  };

  const pauseTimer = () => setTimerStatus('paused');
  
  const resetTimer = () => {
    setTimerStatus('idle');
    setTimeLeft(customMinutes * 60);
  };

  const handleTimerCompletion = () => {
    clearInterval(timerIntervalRef.current);
    triggerToast(`${timerMode} session finished!`);
    
    const sessionDurationMinutes = Math.round(totalDurationRef.current / 60);
    const todayStr = new Date().toISOString().split('T')[0];
    
    setStudyHistory(prev => {
      const dailySessions = prev[todayStr] || [];
      const updatedSessions = [...dailySessions, {
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: sessionDurationMinutes,
        mode: timerMode
      }];
      const nextHistory = { ...prev, [todayStr]: updatedSessions };
      const suffix = user ? user.uid : 'local';
      localStorage.setItem(`study_history_${suffix}`, JSON.stringify(nextHistory));
      return nextHistory;
    });

    setTimerStatus('idle');
    setTimeLeft(timerMode === 'Focus' ? 300 : 1500);
    setTimerMode(prev => prev === 'Focus' ? 'Break' : 'Focus');
    if (fullscreenMode) setFullscreenMode(false);
  };

  const addRoutine = async () => {
    if (!newRoutineName || !newRoutineTime) return triggerToast("Fill missing inputs");
    const updated = [...routines, { name: newRoutineName, time: newRoutineTime, active: true }];
    setRoutines(updated);
    if (user) {
      await set(ref(db, `users/${user.uid}/routines`), updated);
    } else {
      localStorage.setItem('local_routines', JSON.stringify(updated));
    }
    setNewRoutineName('');
    setNewRoutineTime('');
    triggerToast("Routine Added");
  };

  const deleteRoutine = async (idx) => {
    const updated = routines.filter((_, i) => i !== idx);
    setRoutines(updated);
    if (user) {
      await set(ref(db, `users/${user.uid}/routines`), updated);
    } else {
      localStorage.setItem('local_routines', JSON.stringify(updated));
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getDayLabel = (dateStr) => {
    const t = new Date();
    const today = t.toISOString().split('T')[0];
    t.setDate(t.getDate() - 1);
    const yesterday = t.toISOString().split('T')[0];
    
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'Long' });
  };

  const getSevenDayList = () => {
    const list = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      list.push(d.toISOString().split('T')[0]);
    }
    return list;
  };

  const getStudyMinutesForDate = (dateStr) => {
    const sessions = studyHistory[dateStr] || [];
    return sessions.reduce((sum, s) => sum + s.duration, 0);
  };

  const maxStudyMinutes = Math.max(...getSevenDayList().map(d => getStudyMinutesForDate(d)), 1);

  return (
    <div className="app-container">
      {toast && <div className="hud-toast">{toast}</div>}

      <header className="oneui-header-container">
        <h1 className="oneui-main-title">uRhythm</h1>
        <div className="profile-menu-wrapper">
          <div className="profile-circle-btn" onClick={() => setProfileOpen(!profileOpen)}>
            {user && user.photoURL ? <img src={user.photoURL} alt="profile" /> : <i className="fas fa-user"></i>}
          </div>
          <div className={`profile-dropdown-menu ${profileOpen ? 'show' : ''}`}>
            {user ? (
              <>
                <div className="profile-dropdown-item" style={{fontWeight:600}}>{user.displayName || user.email}</div>
                <div className="profile-dropdown-item" onClick={handleSignOut}><i className="fas fa-sign-out-alt"></i> Sign Out</div>
              </>
            ) : (
              <div className="profile-dropdown-item" onClick={() => { setActiveTab('auth'); setProfileOpen(false); }}><i className="fas fa-sign-in-alt"></i> Authentication</div>
            )}
          </div>
        </div>
      </header>

      {activeTab === 'auth' && !user && (
        <div className="glass-panel">
          <div className="auth-toggle-container">
            <button className={`auth-toggle-btn ${authMode === 'signin' ? 'active' : ''}`} onClick={() => setAuthMode('signin')}>Sign In</button>
            <button className={`auth-toggle-btn ${authMode === 'signup' ? 'active' : ''}`} onClick={() => setAuthMode('signup')}>Sign Up</button>
          </div>
          <form onSubmit={handleAuth}>
            {authMode === 'signup' && (
              <div className="form-group">
                <label>Username</label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
              </div>
            )}
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="primary w-full" style={{marginTop:'10px'}}>
              {authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          <div style={{textAlign:'center', margin:'16px 0', color:'var(--text-muted)'}}>or</div>
          <button className="secondary w-full" onClick={handleGoogleSignIn}>
            <i className="fab fa-google"></i> Continue with Google
          </button>
        </div>
      )}

      {activeTab === 'study' && (
        <>
          <div className="sub-tab-container">
            <button className={`sub-tab-button ${studySubTab === 'quiz' ? 'active' : ''}`} onClick={() => setStudySubTab('quiz')}>Quiz AI</button>
            <button className={`sub-tab-button ${studySubTab === 'focus' ? 'active' : ''}`} onClick={() => setStudySubTab('focus')}>Focus Timer</button>
          </div>

          {studySubTab === 'quiz' && (
            <div className="glass-panel">
              {quizQuestions.length === 0 ? (
                <>
                  <div className="form-group">
                    <label>Topic Name</label>
                    <input type="text" placeholder="e.g., Photosynthesis, JavaScript" value={topic} onChange={e => setTopic(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Difficulty</label>
                    <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Hard</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Number of Questions</label>
                    <select value={numQuestions} onChange={e => setNumQuestions(Number(e.target.value))}>
                      <option>5</option>
                      <option>10</option>
                      <option>15</option>
                    </select>
                  </div>
                  <button className="primary w-full" onClick={generateQuiz} disabled={isGeneratingQuiz}>
                    {isGeneratingQuiz ? 'Generating Questions...' : 'Generate Quiz'}
                  </button>
                </>
              ) : quizFinished ? (
                <div style={{textAlign:'center'}}>
                  <h3>Quiz Completed!</h3>
                  <p style={{fontSize:'1.2rem', fontWeight:600}}>Score: {quizScore.correct} / {quizQuestions.length}</p>
                  <button className="primary" onClick={() => setQuizQuestions([])}>Try Another Topic</button>
                </div>
              ) : (
                <div>
                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'12px'}}>
                    <span>Question {currentQuizIdx + 1} of {quizQuestions.length}</span>
                    <span>Score: {quizScore.correct}</span>
                  </div>
                  <p style={{fontWeight:600, fontSize:'1.1rem', marginBottom:'20px'}}>{quizQuestions[currentQuizIdx]?.questionText}</p>
                  <div style={{display:'flex', flexDirection:'column', gap: '10px', marginBottom:'20px'}}>
                    {quizQuestions[currentQuizIdx]?.options.map((opt, i) => (
                      <label key={i} style={{display:'flex', alignItems:'center', gap:'12px', background:'var(--button-bg-secondary)', padding:'14px', borderRadius:'14px', cursor:'pointer', color:'var(--text-color)'}}>
                        <input type="radio" name="quiz-opt" value={opt} checked={selectedAnswer === opt} onChange={() => setSelectedAnswer(opt)} style={{width:'auto'}} />
                        {opt}
                      </label>
                    ))}
                  </div>
                  <button className="primary w-full" onClick={handleAnswerSubmit}>Submit Answer</button>
                </div>
              )}
            </div>
          )}

          {studySubTab === 'focus' && (
            <div className="glass-panel" style={{textAlign:'center'}}>
              <div style={{display:'flex', justifyContent:'center', gap:'12px', marginBottom:'16px'}}>
                <button className={`secondary ${timerMode === 'Focus' ? 'primary' : ''}`} onClick={() => { setTimerMode('Focus'); setTimeLeft(customMinutes * 60); }}>Focus</button>
                <button className={`secondary ${timerMode === 'Break' ? 'primary' : ''}`} onClick={() => { setTimerMode('Break'); setTimeLeft(300); }}>Break</button>
              </div>

              <div className="timer-circle-container">
                <svg className="timer-svg">
                  <circle className="timer-circle-bg" cx="110" cy="110" r="100" />
                  <circle className="timer-circle-progress" cx="110" cy="110" r="100" style={{ strokeDasharray: 628, strokeDashoffset: 628 - (628 * timeLeft) / (timerStatus === 'idle' ? customMinutes * 60 : totalDurationRef.current) }} />
                </svg>
                <div className="timer-text-overlay">
                  <p className="timer-time-display">{formatTime(timeLeft)}</p>
                  <p className="timer-label-display">{timerMode.toUpperCase()}</p>
                </div>
              </div>

              {timerStatus === 'idle' && (
                <div className="form-group" style={{maxWidth:'160px', margin:'0 auto 16px auto'}}>
                  <label>Duration (Minutes)</label>
                  <input type="number" value={customMinutes} onChange={e => { setCustomMinutes(Number(e.target.value)); setTimeLeft(Number(e.target.value) * 60); }} min="1" max="180" />
                </div>
              )}

              <div style={{display:'flex', justifyContent:'center', gap:'14px', marginTop:'20px'}}>
                {timerStatus !== 'running' ? (
                  <button className="primary" onClick={startTimer}><i className="fas fa-play"></i> Start</button>
                ) : (
                  <button className="secondary" onClick={pauseTimer}><i className="fas fa-pause"></i> Pause</button>
                )}
                <button className="danger" onClick={resetTimer}><i className="fas fa-redo"></i> Reset</button>
                <button className="secondary" onClick={() => setFullscreenMode(true)}><i className="fas fa-expand"></i> Fullscreen</button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'routine' && (
        <div className="glass-panel">
          <h3 style={{marginTop:0, marginBottom:'16px'}}>Daily Routine Tasks</h3>
          <div style={{display:'flex', flexDirection:'column', gap:'12px', marginBottom:'20px'}}>
            <div className="form-group">
              <label>Routine Title</label>
              <input type="text" placeholder="e.g., Morning Workout" value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Time Slot</label>
              <input type="time" value={newRoutineTime} onChange={e => setNewRoutineTime(e.target.value)} />
            </div>
            <button className="primary" onClick={addRoutine}><i className="fas fa-plus"></i> Add Routine</button>
          </div>

          <div className="routine-list">
            {routines.map((item, idx) => (
              <div className="routine-item" key={idx}>
                <div className="routine-info">
                  <span className="routine-name">{item.name}</span>
                  <span className="routine-time"><i className="far fa-clock"></i> {item.time}</span>
                </div>
                <button className="danger" style={{padding:'8px 12px', borderRadius:'12px'}} onClick={() => deleteRoutine(idx)}>
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
            ))}
            {routines.length === 0 && <p style={{textAlign:'center', color:'var(--text-muted)', fontSize:'0.9rem'}}>No routines set for today.</p>}
          </div>
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="glass-panel">
          <h3 style={{marginTop:0, marginBottom:'16px'}}>Performance Metrics</h3>
          
          <div className="progress-metrics-grid">
            <div className="metric-card">
              <div className="metric-val">{quizHistory.correct}</div>
              <div className="metric-lbl">Quiz Correct</div>
            </div>
            <div className="metric-card">
              <div className="metric-val">{quizHistory.wrong}</div>
              <div className="metric-lbl">Quiz Wrong</div>
            </div>
          </div>

          <h4 style={{marginBottom:'6px'}}>Last 7 Days Study Load</h4>
          <div className="simple-chart-container">
            {getSevenDayList().reverse().map((dateStr, index) => {
              const mins = getStudyMinutesForDate(dateStr);
              const heightPct = (mins / maxStudyMinutes) * 100;
              return (
                <div className="simple-chart-bar-wrapper" key={index}>
                  <div className="simple-chart-bar" style={{ height: `${Math.max(heightPct, mins > 0 ? 8 : 2)}%` }} title={`${mins} mins`}></div>
                  <span className="simple-chart-label">
                    {getDayLabel(dateStr).substring(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>

          <h4 style={{marginTop:'24px', marginBottom:'12px'}}>7-Day Daywise Logs</h4>
          <div className="history-accordion">
            {getSevenDayList().map((dateStr, index) => {
              const daySessions = studyHistory[dateStr] || [];
              const isOpen = openDayAccordion === dateStr;
              return (
                <div className="accordion-item" key={index}>
                  <div className="accordion-header" onClick={() => setOpenDayAccordion(isOpen ? null : dateStr)}>
                    <span>{getDayLabel(dateStr)} ({getStudyMinutesForDate(dateStr)} mins)</span>
                    <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} style={{fontSize:'0.8rem', color:'var(--text-muted)'}}></i>
                  </div>
                  <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
                    {daySessions.map((session, sIdx) => (
                      <div className="history-sub-item" key={sIdx}>
                        <span>{session.timestamp} - {session.mode}</span>
                        <span style={{fontWeight:600}}>{session.duration} mins</span>
                      </div>
                    ))}
                    {daySessions.length === 0 && (
                      <div style={{color:'var(--text-muted)', fontSize:'0.85rem', textAlign:'center', padding:'4px 0'}}>No history logged.</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fullscreenMode && (
        <div id="study-fullscreen-overlay">
          <h2 style={{margin:0, letterSpacing:'1px', color:'var(--text-muted)'}}>{timerMode.toUpperCase()} SESSION</h2>
          <p className="timer-time-display">{formatTime(timeLeft)}</p>
          <div style={{display:'flex', gap:'20px'}}>
            {timerStatus !== 'running' ? (
              <button className="primary" onClick={startTimer}><i className="fas fa-play"></i> Start</button>
            ) : (
              <button className="secondary" onClick={pauseTimer}><i className="fas fa-pause"></i> Pause</button>
            )}
            <button className="danger" onClick={() => setFullscreenMode(false)}><i className="fas fa-compress"></i> Exit</button>
          </div>
        </div>
      )}

      <div className="tab-bar-container">
        <button className={`tab-button ${activeTab === 'study' ? 'active' : ''}`} onClick={() => setActiveTab('study')}>
          <i className="fas fa-graduation-cap"></i> Study
        </button>
        <button className={`tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>
          <i className="fas fa-calendar-alt"></i> Routine
        </button>
        <button className={`tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
          <i className="fas fa-chart-line"></i> Progress
        </button>
      </div>

      <footer>
        <p>&copy; 2026 uRhythm | Made by <a href="https://ujjwalravi.vercel.app" target="_blank" rel="noopener noreferrer">Ujjwal Ravi</a></p>
      </footer>
    </div>
  );
}
