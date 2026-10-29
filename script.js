/**
 * ============================================================================
 * MediCare - Smart Medicine Reminder System
 * B.Tech Mini Project | Client-side Healthcare Application
 * 
 * Features:
 *  - Persistent LocalStorage CRUD operations
 *  - Time-driven background reminder loop
 *  - Interactive alarm modal with Snooze and Taken controls
 *  - Synthesized Web Audio API medical chime (no external audio assets required)
 *  - Browser Notification API integration
 *  - Adherence dashboard with compliance ring & dosage breakdown
 *  - Real-time search, multi-filter, and dual view (Cards / Table)
 *  - Secure DOM manipulation (strictly avoiding unsafe innerHTML for user data)
 * ============================================================================
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. STORAGE KEYS & CONSTANTS
     ========================================================================== */
  const STORAGE_KEY_MEDS = 'medicare_medicines_v2';
  const STORAGE_KEY_THEME = 'medicare_theme';
  const STORAGE_KEY_SOUND = 'medicare_sound_enabled';
  const STORAGE_KEY_VIEW_MODE = 'medicare_view_mode';
  const STORAGE_KEY_USERS = 'medicare_users_db';
  const STORAGE_KEY_CURRENT_USER = 'medicare_current_user';

  // Medicine types configuration with representative FontAwesome icons
  const MED_TYPE_CONFIG = {
    tablet: { label: 'Tablet', icon: 'fa-solid fa-tablets', color: '#0284c7' },
    capsule: { label: 'Capsule', icon: 'fa-solid fa-capsules', color: '#0d9488' },
    syrup: { label: 'Syrup / Liquid', icon: 'fa-solid fa-prescription-bottle-medical', color: '#8b5cf6' },
    injection: { label: 'Injection', icon: 'fa-solid fa-syringe', color: '#ef4444' },
    drops: { label: 'Drops', icon: 'fa-solid fa-eye-dropper', color: '#06b6d4' },
    inhaler: { label: 'Inhaler', icon: 'fa-solid fa-wind', color: '#f59e0b' },
    ointment: { label: 'Ointment', icon: 'fa-solid fa-pump-medical', color: '#10b981' },
    other: { label: 'Other', icon: 'fa-solid fa-box-tissue', color: '#64748b' }
  };

  /* ==========================================================================
     2. APPLICATION STATE
     ========================================================================== */
  const AppState = {
    currentUser: null,
    medicines: [],
    currentView: 'auth',
    todayFilter: 'all',
    searchQuery: '',
    filterStatus: 'all',
    filterType: 'all',
    filterDate: '',
    sortBy: 'time-asc',
    viewMode: 'cards', // 'cards' | 'table'
    theme: 'light',
    soundEnabled: true,
    activeAlarmMedicine: null,
    alertedMedicinesThisMinute: new Set(),
    audioCtx: null,
    alarmAudioTimer: null,
    medicinePendingDeletionId: null,
    confirmActionType: 'delete' // 'delete' | 'reset'
  };

  /* ==========================================================================
     3. DOM ELEMENT REFERENCES
     ========================================================================== */
  const DOM = {
    // Nav & Controls
    navLinks: document.querySelectorAll('.nav-link'),
    viewSections: document.querySelectorAll('.view-section'),
    mobileToggle: document.getElementById('mobile-toggle'),
    navMenu: document.getElementById('nav-menu'),
    brandLogo: document.getElementById('brand-logo'),
    liveClockText: document.getElementById('live-clock-text'),
    btnToggleTheme: document.getElementById('btn-toggle-theme'),
    themeIcon: document.getElementById('theme-icon'),
    btnToggleSound: document.getElementById('btn-toggle-sound'),
    soundIcon: document.getElementById('sound-icon'),
    btnTestSound: document.getElementById('btn-test-sound'),
    btnToggleNotif: document.getElementById('btn-toggle-notif'),
    notifIcon: document.getElementById('notif-icon'),
    navMedCount: document.getElementById('nav-med-count'),
    userNavChip: document.getElementById('user-nav-chip'),
    userNavName: document.getElementById('user-nav-name'),
    btnNavLogout: document.getElementById('btn-nav-logout'),

    // Auth View Elements
    viewAuth: document.getElementById('view-auth'),
    tabLogin: document.getElementById('tab-login'),
    tabRegister: document.getElementById('tab-register'),
    formLogin: document.getElementById('form-login'),
    formRegister: document.getElementById('form-register'),
    authAlert: document.getElementById('auth-alert'),
    authAlertText: document.getElementById('auth-alert-text'),
    authSuccessAlert: document.getElementById('auth-success-alert'),
    authSuccessText: document.getElementById('auth-success-text'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    btnLoginSubmit: document.getElementById('btn-login-submit'),
    btnToggleLoginPwd: document.getElementById('btn-toggle-login-pwd'),
    iconLoginPwd: document.getElementById('icon-login-pwd'),
    linkGotoRegister: document.getElementById('link-goto-register'),
    errLoginUsername: document.getElementById('err-login-username'),
    errLoginPassword: document.getElementById('err-login-password'),

    regFullname: document.getElementById('reg-fullname'),
    regUsername: document.getElementById('reg-username'),
    regEmail: document.getElementById('reg-email'),
    regPassword: document.getElementById('reg-password'),
    regConfirmPassword: document.getElementById('reg-confirm-password'),
    btnRegisterSubmit: document.getElementById('btn-register-submit'),
    btnToggleRegPwd: document.getElementById('btn-toggle-reg-pwd'),
    iconRegPwd: document.getElementById('icon-reg-pwd'),
    btnToggleRegConfirmPwd: document.getElementById('btn-toggle-reg-confirm-pwd'),
    iconRegConfirmPwd: document.getElementById('icon-reg-confirm-pwd'),
    linkGotoLogin: document.getElementById('link-goto-login'),
    errRegFullname: document.getElementById('err-reg-fullname'),
    errRegUsername: document.getElementById('err-reg-username'),
    errRegEmail: document.getElementById('err-reg-email'),
    errRegPassword: document.getElementById('err-reg-password'),
    errRegConfirmPassword: document.getElementById('err-reg-confirm-password'),
    btnQuickDemo: document.getElementById('btn-quick-demo'),

    // Home View
    heroBtnAdd: document.getElementById('hero-btn-add'),
    heroBtnList: document.getElementById('hero-btn-list'),
    heroBtnTestSound: document.getElementById('hero-btn-test-sound'),
    heroBtnDemo: document.getElementById('hero-btn-demo'),
    nextDoseBanner: document.getElementById('next-dose-banner'),
    nextDoseName: document.getElementById('next-dose-name'),
    nextDoseMeta: document.getElementById('next-dose-meta'),
    timerHours: document.getElementById('timer-hours'),
    timerMinutes: document.getElementById('timer-minutes'),
    timerSeconds: document.getElementById('timer-seconds'),
    todayMedicinesGrid: document.getElementById('today-medicines-grid'),
    todayEmptyState: document.getElementById('today-empty-state'),
    todayDateText: document.getElementById('today-date-text'),
    homeFilterBtns: document.querySelectorAll('.filter-today-btn'),
    emptyAddBtn: document.getElementById('empty-add-btn'),

    // Dashboard View
    dashUsername: document.getElementById('dash-username'),
    dashBtnLogout: document.getElementById('dash-btn-logout'),
    dashBtnTestSound: document.getElementById('dash-btn-test-sound'),
    statTotal: document.getElementById('stat-total'),
    statToday: document.getElementById('stat-today'),
    statUpcoming: document.getElementById('stat-upcoming'),
    statCompleted: document.getElementById('stat-completed'),
    statMissed: document.getElementById('stat-missed'),
    adherencePercentage: document.getElementById('adherence-percentage'),
    adherenceCircle: document.getElementById('adherence-circle'),
    adherenceStatusTag: document.getElementById('adherence-status-tag'),
    adherenceHeading: document.getElementById('adherence-heading'),
    adherenceDesc: document.getElementById('adherence-desc'),
    adhTakenCount: document.getElementById('adh-taken-count'),
    adhPendingCount: document.getElementById('adh-pending-count'),
    adhMissedCount: document.getElementById('adh-missed-count'),
    typesBreakdownList: document.getElementById('types-breakdown-list'),
    btnExportData: document.getElementById('btn-export-data'),
    btnResetData: document.getElementById('btn-reset-data'),

    // Add / Edit View
    medForm: document.getElementById('med-form'),
    editMedId: document.getElementById('edit-med-id'),
    formTitle: document.getElementById('form-title'),
    formSubtitle: document.getElementById('form-subtitle'),
    btnSaveText: document.getElementById('btn-save-text'),
    btnCancelEdit: document.getElementById('btn-cancel-edit'),
    medName: document.getElementById('med-name'),
    medDosage: document.getElementById('med-dosage'),
    medType: document.getElementById('med-type'),
    medDate: document.getElementById('med-date'),
    medTime: document.getElementById('med-time'),
    medFrequency: document.getElementById('med-frequency'),
    medInstructions: document.getElementById('med-instructions'),
    medNotes: document.getElementById('med-notes'),
    errName: document.getElementById('err-name'),
    errDosage: document.getElementById('err-dosage'),
    errDate: document.getElementById('err-date'),
    errTime: document.getElementById('err-time'),

    // My Medicines View
    btnAddFromList: document.getElementById('btn-add-from-list'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    filterStatus: document.getElementById('filter-status'),
    filterType: document.getElementById('filter-type'),
    filterDate: document.getElementById('filter-date'),
    btnClearDate: document.getElementById('btn-clear-date'),
    sortBy: document.getElementById('sort-by'),
    btnViewCards: document.getElementById('btn-view-cards'),
    btnViewTable: document.getElementById('btn-view-table'),
    allMedicinesGrid: document.getElementById('all-medicines-grid'),
    medicinesTableWrapper: document.getElementById('medicines-table-wrapper'),
    medicinesTableBody: document.getElementById('medicines-table-body'),
    allEmptyState: document.getElementById('all-empty-state'),
    filteredCountText: document.getElementById('filtered-count-text'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    btnEmptyAddAction: document.getElementById('btn-empty-add-action'),
    aboutBtnTestSound: document.getElementById('about-btn-test-sound'),

    // Alarm Modal
    reminderModal: document.getElementById('reminder-modal'),
    alarmTimeDisplay: document.getElementById('alarm-time-display'),
    alarmMedName: document.getElementById('alarm-med-name'),
    alarmMedDosage: document.getElementById('alarm-med-dosage'),
    alarmTypeIcon: document.getElementById('alarm-type-icon'),
    alarmInstructions: document.getElementById('alarm-instructions'),
    alarmFrequency: document.getElementById('alarm-frequency'),
    alarmNotes: document.getElementById('alarm-notes'),
    alarmNotesContainer: document.getElementById('alarm-notes-container'),
    btnAlarmTake: document.getElementById('btn-alarm-take'),
    btnAlarmSnooze: document.getElementById('btn-alarm-snooze'),
    btnAlarmDismiss: document.getElementById('btn-alarm-dismiss'),

    // Delete Modal
    deleteModal: document.getElementById('delete-modal'),
    deleteModalTitle: document.getElementById('delete-modal-title'),
    deleteModalMsg: document.getElementById('delete-modal-msg'),
    btnCancelDelete: document.getElementById('btn-cancel-delete'),
    btnConfirmDelete: document.getElementById('btn-confirm-delete'),

    // Toast Container
    toastContainer: document.getElementById('toast-container')
  };

  /* ==========================================================================
     4. UTILITIES & DATE/TIME HELPERS
     ========================================================================== */

  /**
   * Returns current local ISO date string "YYYY-MM-DD"
   */
  function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Returns current time string "HH:MM" in 24-hr format
   */
  function getLocalTimeString(d = new Date()) {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Formats "HH:MM" 24h into 12h AM/PM string
   */
  function format12Hour(timeStr) {
    if (!timeStr) return '--:--';
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // hour '0' should be '12'
    return `${h}:${m} ${ampm}`;
  }

  /**
   * Formats date string "YYYY-MM-DD" into readable format "Thu, Oct 26, 2026"
   */
  function formatReadableDate(dateStr) {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-');
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Generates a safe unique ID
   */
  function generateId() {
    return 'med_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  }

  /**
   * Safe DOM node text population
   */
  function setSafeText(elem, text) {
    if (elem) {
      elem.textContent = text ?? '';
    }
  }

  /**
   * Non-intrusive Toast Notifications
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconWrapper = document.createElement('span');
    iconWrapper.className = 'toast-icon';
    const icon = document.createElement('i');
    
    if (type === 'success') {
      icon.className = 'fa-solid fa-circle-check';
    } else if (type === 'warning') {
      icon.className = 'fa-solid fa-triangle-exclamation';
    } else if (type === 'danger') {
      icon.className = 'fa-solid fa-circle-xmark';
    } else {
      icon.className = 'fa-solid fa-circle-info';
    }
    iconWrapper.appendChild(icon);

    const msgSpan = document.createElement('span');
    msgSpan.className = 'toast-message';
    msgSpan.textContent = message;

    toast.appendChild(iconWrapper);
    toast.appendChild(msgSpan);

    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(60px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3500);
  }

  /* ==========================================================================
     5. SYNTHESIZED WEB AUDIO CHIME ALARM (LOUD & CRISP MEDICAL ALERT)
     ========================================================================== */
  let masterGainNode = null;
  let compressorNode = null;
  let activeAudioNodes = [];
  let isTestingSound = false;
  let testSoundTimeout = null;

  /**
   * Lazily initializes or returns the shared AudioContext instance
   */
  function getAudioContext() {
    if (!AppState.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        try {
          AppState.audioCtx = new AudioContextClass();
        } catch (err) {
          console.warn('AudioContext creation error:', err);
        }
      }
    }
    if (AppState.audioCtx && AppState.audioCtx.state === 'suspended') {
      AppState.audioCtx.resume().catch(() => {});
    }
    return AppState.audioCtx;
  }

  /**
   * Initializes or resumes the AudioContext on first user interaction
   * to satisfy strict browser autoplay policies
   */
  function initOrResumeAudioContext() {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      return ctx.resume().catch(err => {
        console.warn('AudioContext resume rejected:', err);
      });
    }
    return Promise.resolve();
  }

  /**
   * Sets up one-time capture listeners on common user gestures
   * to immediately unlock the Web Audio API context
   */
  function setupAudioAutoplayUnlock() {
    const unlockEvents = ['click', 'touchstart', 'touchend', 'keydown', 'pointerdown'];
    const handleFirstGesture = () => {
      initOrResumeAudioContext().then(() => {
        if (AppState.audioCtx && AppState.audioCtx.state === 'running') {
          unlockEvents.forEach(evt => {
            document.removeEventListener(evt, handleFirstGesture, true);
          });
        }
      }).catch(() => {});
    };

    unlockEvents.forEach(evt => {
      document.addEventListener(evt, handleFirstGesture, { capture: true, passive: true });
    });
  }

  /**
   * Creates or returns the master audio processing chain:
   * Master Gain -> DynamicsCompressor -> Destination.
   * The dynamics compressor prevents clipping and maximizes perceptual loudness
   * on small laptop speakers.
   */
  function getAudioChain(ctx) {
    if (!compressorNode || compressorNode.context !== ctx) {
      try {
        compressorNode = ctx.createDynamicsCompressor();
        compressorNode.threshold.setValueAtTime(-14, ctx.currentTime);
        compressorNode.knee.setValueAtTime(8, ctx.currentTime);
        compressorNode.ratio.setValueAtTime(6, ctx.currentTime);
        compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
        compressorNode.release.setValueAtTime(0.08, ctx.currentTime);

        masterGainNode = ctx.createGain();
        masterGainNode.gain.setValueAtTime(0.9, ctx.currentTime);

        masterGainNode.connect(compressorNode);
        compressorNode.connect(ctx.destination);
      } catch (err) {
        console.warn('Audio chain creation fallback:', err);
        return ctx.destination;
      }
    }
    return masterGainNode;
  }

  /**
   * Synthesizes a loud, crisp medical alert note tailored for laptop speakers.
   * Uses dual oscillators:
   * - Osc 1: Fundamental Sine wave for body and warmth
   * - Osc 2: Triangle wave for harmonic overtone (presence & clarity on small speakers)
   */
  function playMedicalTone(freq, startTime, duration = 0.13, isFinalTone = false) {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = startTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const noteGain = ctx.createGain();

      // Main fundamental tone (e.g. C6, E6, G6)
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);

      // Acoustic overtone for punchy transmission through laptop speakers
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(isFinalTone ? freq : freq * 2, now);

      // Mix oscillators into noteGain
      osc1.connect(noteGain);
      osc2.connect(noteGain);

      // Connect noteGain into master processing chain
      const masterChain = getAudioChain(ctx);
      noteGain.connect(masterChain);

      // Fast attack prevents click/pop; pleasant exponential decay
      const attackDuration = 0.008;
      const peakVolume = isFinalTone ? 0.85 : 0.78;
      const endTime = now + duration;

      noteGain.gain.setValueAtTime(0.0001, now);
      noteGain.gain.exponentialRampToValueAtTime(peakVolume, now + attackDuration);
      noteGain.gain.setValueAtTime(peakVolume, now + duration * 0.45);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(endTime);
      osc2.stop(endTime);

      const record = { osc1, osc2, noteGain };
      activeAudioNodes.push(record);

      osc1.onended = () => {
        activeAudioNodes = activeAudioNodes.filter(item => item !== record);
      };
    } catch (err) {
      console.warn('Web Audio playback error caught:', err);
    }
  }

  /**
   * Triggers one cycle of the 3-beep ascending medical alert chime:
   * Beep 1: C6 (1046.50 Hz)
   * Beep 2: E6 (1318.51 Hz)
   * Beep 3: G6 (1567.98 Hz) - slightly longer resolve
   */
  function trigger3BeepChime() {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime + 0.03;
    // Ascending medical chime triad
    playMedicalTone(1046.50, t, 0.12, false);
    playMedicalTone(1318.51, t + 0.15, 0.12, false);
    playMedicalTone(1567.98, t + 0.30, 0.28, true);
  }

  /**
   * Immediately silences and halts all currently ringing audio nodes
   */
  function stopAllActiveNotes() {
    const ctx = AppState.audioCtx;
    const now = ctx ? ctx.currentTime : 0;
    activeAudioNodes.forEach(item => {
      try {
        if (item.noteGain && ctx) {
          item.noteGain.gain.cancelScheduledValues(now);
          item.noteGain.gain.setValueAtTime(0, now);
        }
        if (item.osc1) item.osc1.stop(now);
        if (item.osc2) item.osc2.stop(now);
      } catch {}
    });
    activeAudioNodes = [];
  }

  /**
   * Starts repeating the loud 3-beep medical alarm sound.
   * Continues until stopAlarmSound is called (when user clicks Snooze or Mark as Taken).
   */
  function startAlarmSound() {
    if (!AppState.soundEnabled) return;
    stopAlarmSound();
    stopTestSound();

    initOrResumeAudioContext().catch(() => {});

    // Initial chime burst
    trigger3BeepChime();

    // Repeat every 1.8 seconds while modal remains active
    AppState.alarmAudioTimer = setInterval(trigger3BeepChime, 1800);
  }

  /**
   * Stops the repeating alarm sound and cuts off active audio nodes
   */
  function stopAlarmSound() {
    if (AppState.alarmAudioTimer) {
      clearInterval(AppState.alarmAudioTimer);
      AppState.alarmAudioTimer = null;
    }
    stopAllActiveNotes();
  }

  /**
   * Plays a loud test demonstration of the medical reminder alarm sound
   * so the user can verify volume and tone on their laptop speaker at any time.
   */
  function testAlarmSound() {
    if (AppState.activeAlarmMedicine) {
      showToast('Medical reminder alarm is currently active!', 'warning');
      return;
    }

    if (isTestingSound) {
      stopTestSound();
      showToast('Alarm sound test stopped', 'info');
      return;
    }

    // Automatically enable sound if previously muted
    if (!AppState.soundEnabled) {
      AppState.soundEnabled = true;
      localStorage.setItem(STORAGE_KEY_SOUND, 'true');
      updateSoundIcon();
      showToast('Sound unmuted for alarm test', 'info');
    }

    initOrResumeAudioContext().catch(() => {});

    isTestingSound = true;
    updateTestButtonsState(true);
    showToast('🔊 Playing loud medical reminder chime...', 'info');

    // First 3-beep pattern
    trigger3BeepChime();

    // Second repeating 3-beep cycle after 1.8 seconds (total 2 cycles ~ 3.6s)
    const repeatTimer = setTimeout(() => {
      if (isTestingSound) {
        trigger3BeepChime();
      }
    }, 1800);

    testSoundTimeout = setTimeout(() => {
      stopTestSound();
      showToast('Alarm sound test finished', 'success');
    }, 3600);

    testSoundTimeout._repeatTimer = repeatTimer;
  }

  /**
   * Cancels active test sound playback and resets button UI
   */
  function stopTestSound() {
    if (testSoundTimeout) {
      if (testSoundTimeout._repeatTimer) {
        clearTimeout(testSoundTimeout._repeatTimer);
      }
      clearTimeout(testSoundTimeout);
      testSoundTimeout = null;
    }
    isTestingSound = false;
    stopAllActiveNotes();
    updateTestButtonsState(false);
  }

  /**
   * Updates test button UI states across all locations safely without innerHTML
   */
  function updateTestButtonsState(isActive) {
    const testBtns = [
      DOM.btnTestSound,
      DOM.heroBtnTestSound,
      DOM.dashBtnTestSound,
      DOM.aboutBtnTestSound
    ].filter(Boolean);

    testBtns.forEach(btn => {
      btn.replaceChildren();
      const icon = document.createElement('i');
      const span = document.createElement('span');

      if (isActive) {
        btn.classList.add('playing');
        icon.className = 'fa-solid fa-volume-high fa-beat';
        span.textContent = ' Stop Test Sound';
      } else {
        btn.classList.remove('playing');
        icon.className = 'fa-solid fa-volume-high';
        span.textContent = ' Test Alarm Sound';
      }

      btn.appendChild(icon);
      btn.appendChild(span);
    });
  }

  /* ==========================================================================
     6. USER AUTHENTICATION & SESSION MANAGEMENT (LOCALSTORAGE)
     ========================================================================== */
  const DEFAULT_DEMO_USER = {
    id: 'user_demo_1',
    name: 'Demo User',
    username: 'demo',
    email: 'demo@medicare.com',
    password: 'password123',
    createdAt: new Date().toISOString()
  };

  /**
   * Retrieves registered users from localStorage, seeds demo account if empty
   */
  function getUsersFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USERS);
      if (raw) {
        const users = JSON.parse(raw);
        if (Array.isArray(users) && users.length > 0) {
          return users;
        }
      }
    } catch (e) {
      console.warn('Error reading users from storage:', e);
    }
    const initialUsers = [DEFAULT_DEMO_USER];
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(initialUsers));
    return initialUsers;
  }

  function saveUsersToStorage(users) {
    try {
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
    } catch (e) {
      console.error('Error saving users to storage:', e);
    }
  }

  /**
   * Checks for an active logged-in user session in localStorage
   */
  function loadUserSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      if (raw) {
        const user = JSON.parse(raw);
        if (user && (user.username || user.email)) {
          AppState.currentUser = user;
          updateUserDisplay();
          return true;
        }
      }
    } catch (e) {
      console.warn('Error loading user session:', e);
    }
    AppState.currentUser = null;
    updateUserDisplay();
    return false;
  }

  function saveUserSession(user) {
    AppState.currentUser = user;
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
    } catch (e) {
      console.error('Error saving user session:', e);
    }
    updateUserDisplay();
  }

  function clearUserSession() {
    AppState.currentUser = null;
    try {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    } catch (e) {
      console.error('Error clearing session:', e);
    }
    updateUserDisplay();
  }

  /**
   * Syncs user details across top navigation and dashboard welcome banner
   */
  function updateUserDisplay() {
    const isLogged = !!AppState.currentUser;
    if (isLogged) {
      document.body.classList.remove('not-logged-in');
      if (DOM.userNavChip) DOM.userNavChip.classList.remove('hidden');
      if (DOM.userNavName) DOM.userNavName.textContent = AppState.currentUser.username;
      if (DOM.dashUsername) DOM.dashUsername.textContent = AppState.currentUser.name || AppState.currentUser.username;
    } else {
      document.body.classList.add('not-logged-in');
      if (DOM.userNavChip) DOM.userNavChip.classList.add('hidden');
      if (DOM.userNavName) DOM.userNavName.textContent = '';
      if (DOM.dashUsername) DOM.dashUsername.textContent = 'User';
    }
  }

  function switchAuthTab(tabName) {
    clearAuthAlerts();
    if (tabName === 'login') {
      if (DOM.tabLogin) {
        DOM.tabLogin.classList.add('active');
        DOM.tabLogin.setAttribute('aria-selected', 'true');
      }
      if (DOM.tabRegister) {
        DOM.tabRegister.classList.remove('active');
        DOM.tabRegister.setAttribute('aria-selected', 'false');
      }
      if (DOM.formLogin) DOM.formLogin.classList.remove('hidden');
      if (DOM.formRegister) DOM.formRegister.classList.add('hidden');
    } else {
      if (DOM.tabRegister) {
        DOM.tabRegister.classList.add('active');
        DOM.tabRegister.setAttribute('aria-selected', 'true');
      }
      if (DOM.tabLogin) {
        DOM.tabLogin.classList.remove('active');
        DOM.tabLogin.setAttribute('aria-selected', 'false');
      }
      if (DOM.formRegister) DOM.formRegister.classList.remove('hidden');
      if (DOM.formLogin) DOM.formLogin.classList.add('hidden');
    }
  }

  function togglePasswordInput(inputElem, iconElem) {
    if (!inputElem || !iconElem) return;
    if (inputElem.type === 'password') {
      inputElem.type = 'text';
      iconElem.className = 'fa-regular fa-eye-slash';
    } else {
      inputElem.type = 'password';
      iconElem.className = 'fa-regular fa-eye';
    }
  }

  function showAuthAlert(msg, isSuccess = false) {
    if (isSuccess) {
      if (DOM.authSuccessText) DOM.authSuccessText.textContent = msg;
      if (DOM.authSuccessAlert) DOM.authSuccessAlert.classList.remove('hidden');
      if (DOM.authAlert) DOM.authAlert.classList.add('hidden');
    } else {
      if (DOM.authAlertText) DOM.authAlertText.textContent = msg;
      if (DOM.authAlert) DOM.authAlert.classList.remove('hidden');
      if (DOM.authSuccessAlert) DOM.authSuccessAlert.classList.add('hidden');
    }
  }

  function clearAuthAlerts() {
    if (DOM.authAlert) DOM.authAlert.classList.add('hidden');
    if (DOM.authSuccessAlert) DOM.authSuccessAlert.classList.add('hidden');
    if (DOM.errLoginUsername) DOM.errLoginUsername.textContent = '';
    if (DOM.errLoginPassword) DOM.errLoginPassword.textContent = '';
    if (DOM.errRegFullname) DOM.errRegFullname.textContent = '';
    if (DOM.errRegUsername) DOM.errRegUsername.textContent = '';
    if (DOM.errRegEmail) DOM.errRegEmail.textContent = '';
    if (DOM.errRegPassword) DOM.errRegPassword.textContent = '';
    if (DOM.errRegConfirmPassword) DOM.errRegConfirmPassword.textContent = '';
    
    [DOM.loginUsername, DOM.loginPassword, DOM.regFullname, DOM.regUsername, DOM.regEmail, DOM.regPassword, DOM.regConfirmPassword].forEach(el => {
      if (el) el.classList.remove('is-invalid');
    });
  }

  function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    clearAuthAlerts();

    const usernameOrEmail = DOM.loginUsername.value.trim();
    const password = DOM.loginPassword.value;

    let hasError = false;
    if (!usernameOrEmail) {
      DOM.loginUsername.classList.add('is-invalid');
      setSafeText(DOM.errLoginUsername, 'Please enter your username or email.');
      hasError = true;
    }
    if (!password) {
      DOM.loginPassword.classList.add('is-invalid');
      setSafeText(DOM.errLoginPassword, 'Please enter your password.');
      hasError = true;
    }

    if (hasError) {
      showAuthAlert('Please fill in all required login fields.');
      return;
    }

    const users = getUsersFromStorage();
    const query = usernameOrEmail.toLowerCase();
    const foundUser = users.find(u => 
      (u.username && u.username.toLowerCase() === query) ||
      (u.email && u.email.toLowerCase() === query)
    );

    if (!foundUser) {
      DOM.loginUsername.classList.add('is-invalid');
      showAuthAlert('No account found with this username or email. Please register first.');
      return;
    }

    if (foundUser.password !== password) {
      DOM.loginPassword.classList.add('is-invalid');
      showAuthAlert('Incorrect password. Please verify and try again.');
      return;
    }

    // Unlock Web Audio immediately on login submit
    initOrResumeAudioContext().catch(() => {});

    // Login successful
    saveUserSession(foundUser);
    loadMedicinesFromStorage();
    DOM.formLogin.reset();
    showToast(`Welcome back, ${foundUser.name || foundUser.username}!`, 'success');
    navigateToView('dashboard');
  }

  function handleRegisterSubmit(e) {
    if (e) e.preventDefault();
    clearAuthAlerts();

    const name = DOM.regFullname.value.trim();
    const username = DOM.regUsername.value.trim();
    const email = DOM.regEmail.value.trim();
    const password = DOM.regPassword.value;
    const confirmPassword = DOM.regConfirmPassword.value;

    let hasError = false;

    if (!name) {
      DOM.regFullname.classList.add('is-invalid');
      setSafeText(DOM.errRegFullname, 'Please enter your full name.');
      hasError = true;
    }

    if (!username || username.length < 3) {
      DOM.regUsername.classList.add('is-invalid');
      setSafeText(DOM.errRegUsername, 'Username must be at least 3 characters.');
      hasError = true;
    }

    if (!email || !email.includes('@')) {
      DOM.regEmail.classList.add('is-invalid');
      setSafeText(DOM.errRegEmail, 'Please enter a valid email address.');
      hasError = true;
    }

    if (!password || password.length < 4) {
      DOM.regPassword.classList.add('is-invalid');
      setSafeText(DOM.errRegPassword, 'Password must be at least 4 characters long.');
      hasError = true;
    }

    if (password !== confirmPassword) {
      DOM.regConfirmPassword.classList.add('is-invalid');
      setSafeText(DOM.errRegConfirmPassword, 'Passwords do not match.');
      hasError = true;
    }

    if (hasError) {
      showAuthAlert('Please correct the highlighted registration errors.');
      return;
    }

    const users = getUsersFromStorage();
    const existing = users.find(u => 
      (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
      (u.email && u.email.toLowerCase() === email.toLowerCase())
    );

    if (existing) {
      if (existing.username.toLowerCase() === username.toLowerCase()) {
        DOM.regUsername.classList.add('is-invalid');
        showAuthAlert('This username is already taken. Please choose another.');
      } else {
        DOM.regEmail.classList.add('is-invalid');
        showAuthAlert('An account with this email address already exists. Please log in.');
      }
      return;
    }

    // Unlock Audio Context on registration
    initOrResumeAudioContext().catch(() => {});

    const newUser = {
      id: 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      name,
      username,
      email,
      password,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsersToStorage(users);

    // Automatically log in newly registered user
    saveUserSession(newUser);
    loadMedicinesFromStorage();
    DOM.formRegister.reset();
    showToast(`Account created! Welcome to Medicine Reminder, ${newUser.name}!`, 'success');
    navigateToView('dashboard');
  }

  function handleQuickDemoLogin() {
    clearAuthAlerts();
    initOrResumeAudioContext().catch(() => {});
    const users = getUsersFromStorage();
    let demoUser = users.find(u => u.username === 'demo');
    if (!demoUser) {
      demoUser = DEFAULT_DEMO_USER;
      users.push(demoUser);
      saveUsersToStorage(users);
    }

    saveUserSession(demoUser);
    loadMedicinesFromStorage();
    showToast(`Logged in as Demo User (${demoUser.username})!`, 'success');
    navigateToView('dashboard');
  }

  function handleLogout() {
    stopAlarmSound();
    stopTestSound();
    clearUserSession();
    navigateToView('auth');
    showToast('You have been logged out.', 'info');
  }

  /* ==========================================================================
     7. USER-SCOPED LOCALSTORAGE PERSISTENCE
     ========================================================================== */
  function getUserMedicineStorageKey() {
    if (!AppState.currentUser) return STORAGE_KEY_MEDS;
    return `medicare_medicines_${AppState.currentUser.username.toLowerCase()}`;
  }

  function loadMedicinesFromStorage() {
    try {
      const userKey = getUserMedicineStorageKey();
      let raw = localStorage.getItem(userKey);
      
      // Fallback: Check global/legacy key if user key is not set
      if (!raw) {
        raw = localStorage.getItem(STORAGE_KEY_MEDS);
      }

      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          AppState.medicines = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Could not parse saved medicines from localStorage:', e);
    }
    
    // If no medicines exist for this account yet, pre-load sample data
    loadSampleData(false);
  }

  function saveMedicinesToStorage() {
    try {
      const dataStr = JSON.stringify(AppState.medicines);
      const userKey = getUserMedicineStorageKey();
      localStorage.setItem(userKey, dataStr);
      localStorage.setItem(STORAGE_KEY_MEDS, dataStr);
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
      showToast('Error saving data to local storage', 'danger');
    }
  }

  /* ==========================================================================
     7. THEME & SETTINGS INITIALIZATION
     ========================================================================== */
  function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
    setTheme(savedTheme);

    const savedSound = localStorage.getItem(STORAGE_KEY_SOUND);
    if (savedSound !== null) {
      AppState.soundEnabled = savedSound === 'true';
    }
    updateSoundIcon();

    const savedViewMode = localStorage.getItem(STORAGE_KEY_VIEW_MODE);
    if (savedViewMode === 'table') {
      AppState.viewMode = 'table';
      DOM.btnViewCards.classList.remove('active');
      DOM.btnViewTable.classList.add('active');
      DOM.allMedicinesGrid.classList.add('hidden');
      DOM.medicinesTableWrapper.classList.remove('hidden');
    }
  }

  function setTheme(theme) {
    AppState.theme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    if (theme === 'dark') {
      DOM.themeIcon.className = 'fa-solid fa-sun';
      DOM.btnToggleTheme.setAttribute('title', 'Switch to Light Mode');
    } else {
      DOM.themeIcon.className = 'fa-solid fa-moon';
      DOM.btnToggleTheme.setAttribute('title', 'Switch to Dark Mode');
    }
  }

  function toggleTheme() {
    const nextTheme = AppState.theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    showToast(`Switched to ${nextTheme} mode`, 'info');
  }

  function toggleSound() {
    AppState.soundEnabled = !AppState.soundEnabled;
    localStorage.setItem(STORAGE_KEY_SOUND, AppState.soundEnabled ? 'true' : 'false');
    updateSoundIcon();
    showToast(`Chime sound ${AppState.soundEnabled ? 'enabled' : 'muted'}`, 'info');
    if (!AppState.soundEnabled) {
      stopAlarmSound();
    }
  }

  function updateSoundIcon() {
    if (AppState.soundEnabled) {
      DOM.soundIcon.className = 'fa-solid fa-volume-high';
      DOM.btnToggleSound.classList.remove('text-danger');
    } else {
      DOM.soundIcon.className = 'fa-solid fa-volume-xmark';
      DOM.btnToggleSound.classList.add('text-danger');
    }
  }

  /* ==========================================================================
     8. BROWSER DESKTOP NOTIFICATIONS
     ========================================================================== */
  function initNotificationPermission() {
    if (!('Notification' in window)) {
      DOM.btnToggleNotif.style.display = 'none';
      return;
    }
    updateNotifIcon();
  }

  function updateNotifIcon() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      DOM.notifIcon.className = 'fa-solid fa-bell text-success';
      DOM.btnToggleNotif.setAttribute('title', 'Browser notifications enabled');
    } else if (Notification.permission === 'denied') {
      DOM.notifIcon.className = 'fa-solid fa-bell-slash text-danger';
      DOM.btnToggleNotif.setAttribute('title', 'Notifications blocked in browser');
    } else {
      DOM.notifIcon.className = 'fa-regular fa-bell';
      DOM.btnToggleNotif.setAttribute('title', 'Click to permit desktop alerts');
    }
  }

  function requestNotificationPermission() {
    if (!('Notification' in window)) {
      showToast('Notifications are not supported in this browser', 'warning');
      return;
    }

    if (Notification.permission === 'granted') {
      showToast('Desktop alerts are already enabled', 'info');
      return;
    }

    Notification.requestPermission().then(permission => {
      updateNotifIcon();
      if (permission === 'granted') {
        showToast('Desktop notifications successfully enabled!', 'success');
        try {
          new Notification('MediCare System', {
            body: 'Medicine reminder notifications are now active.',
            icon: 'favicon.ico'
          });
        } catch {
          // ignore
        }
      } else {
        showToast('Notification permission was dismissed or denied.', 'warning');
      }
    });
  }

  function sendBrowserNotification(med) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const notif = new Notification(`Medicine Reminder: ${med.name}`, {
        body: `Time to take ${med.dosage} (${med.instructions || 'Scheduled dose'}).`,
        tag: `medicare_${med.id}`,
        requireInteraction: true
      });
      notif.onclick = () => {
        window.focus();
        showAlarmModal(med);
      };
    } catch (e) {
      console.warn('Could not launch system notification:', e);
    }
  }

  /* ==========================================================================
     9. NAVIGATION / VIEW SWITCHING & SESSION ROUTE GUARD
     ========================================================================== */
  function navigateToView(viewId) {
    // Session Guard: If user is not logged in, prevent direct access to dashboard & other views
    if (!AppState.currentUser && viewId !== 'auth') {
      viewId = 'auth';
      showToast('Please log in or register to access the Medicine Reminder Dashboard.', 'warning');
    }

    AppState.currentView = viewId;

    const sections = document.querySelectorAll('.view-section');
    sections.forEach(section => {
      if (section.id === `view-${viewId}`) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    DOM.navLinks.forEach(link => {
      if (link.getAttribute('data-view') === viewId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Close mobile nav menu if open
    if (DOM.navMenu) {
      DOM.navMenu.classList.remove('open');
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh application views if not on auth screen
    if (viewId !== 'auth') {
      renderAllViews();
    }
  }

  /* ==========================================================================
     10. CLOCK & LIVE COUNTDOWN TIMER
     ========================================================================== */
  function updateLiveClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    const timeString = `${hours}:${minutes}:${seconds} ${ampm}`;
    if (DOM.liveClockText) {
      DOM.liveClockText.textContent = timeString;
    }
  }

  /**
   * Calculates time remaining until the next upcoming dose today
   */
  function updateNextDoseCountdown() {
    const todayStr = getLocalDateString();
    const now = new Date();

    // Find pending medicines scheduled for today or upcoming
    const candidates = AppState.medicines.filter(m => {
      if (m.taken) return false;
      // Doses scheduled for today or future dates
      return m.date >= todayStr;
    });

    if (candidates.length === 0) {
      setSafeText(DOM.nextDoseName, 'No upcoming doses scheduled');
      setSafeText(DOM.nextDoseMeta, 'All medications are taken or none scheduled.');
      setSafeText(DOM.timerHours, '00');
      setSafeText(DOM.timerMinutes, '00');
      setSafeText(DOM.timerSeconds, '00');
      return;
    }

    // Sort candidates by DateTime
    candidates.sort((a, b) => {
      const dtA = new Date(`${a.date}T${a.time}:00`);
      const dtB = new Date(`${b.date}T${b.time}:00`);
      return dtA - dtB;
    });

    // Find first candidate that has not passed or nearest in future
    let nextMed = candidates.find(m => {
      const dt = new Date(`${m.date}T${m.time}:00`);
      return dt >= now;
    });

    // If none are in future, take the first overdue candidate for today
    if (!nextMed) {
      nextMed = candidates[0];
    }

    const targetDate = new Date(`${nextMed.date}T${nextMed.time}:00`);
    const diffMs = targetDate - now;

    setSafeText(DOM.nextDoseName, `${nextMed.name} (${nextMed.dosage})`);

    if (diffMs <= 0) {
      // Overdue
      setSafeText(DOM.nextDoseMeta, `⚠️ Overdue since ${format12Hour(nextMed.time)} (${formatReadableDate(nextMed.date)})`);
      setSafeText(DOM.timerHours, '00');
      setSafeText(DOM.timerMinutes, '00');
      setSafeText(DOM.timerSeconds, '00');
    } else {
      const diffSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(diffSecs / 3600);
      const minutes = Math.floor((diffSecs % 3600) / 60);
      const seconds = diffSecs % 60;

      const dateLabel = nextMed.date === todayStr ? 'Today' : formatReadableDate(nextMed.date);
      setSafeText(DOM.nextDoseMeta, `Scheduled for ${dateLabel} at ${format12Hour(nextMed.time)} • ${nextMed.instructions || 'Standard'}`);
      setSafeText(DOM.timerHours, String(hours).padStart(2, '0'));
      setSafeText(DOM.timerMinutes, String(minutes).padStart(2, '0'));
      setSafeText(DOM.timerSeconds, String(seconds).padStart(2, '0'));
    }
  }

  /* ==========================================================================
     11. MEDICINE CRUD & STATE HANDLERS
     ========================================================================== */

  /**
   * Validates form and saves new or edited medicine
   */
  function handleFormSubmit(e) {
    e.preventDefault();

    // Reset error messages
    setSafeText(DOM.errName, '');
    setSafeText(DOM.errDosage, '');
    setSafeText(DOM.errDate, '');
    setSafeText(DOM.errTime, '');
    DOM.medName.classList.remove('is-invalid');
    DOM.medDosage.classList.remove('is-invalid');
    DOM.medDate.classList.remove('is-invalid');
    DOM.medTime.classList.remove('is-invalid');

    const name = DOM.medName.value.trim();
    const dosage = DOM.medDosage.value.trim();
    const type = DOM.medType.value;
    const date = DOM.medDate.value;
    const time = DOM.medTime.value;
    const frequency = DOM.medFrequency.value;
    const instructions = DOM.medInstructions.value;
    const notes = DOM.medNotes.value.trim();
    const priorityElem = document.querySelector('input[name="med-priority"]:checked');
    const priority = priorityElem ? priorityElem.value : 'normal';

    let hasError = false;

    if (!name) {
      setSafeText(DOM.errName, 'Medicine name cannot be empty.');
      DOM.medName.classList.add('is-invalid');
      hasError = true;
    }

    if (!dosage) {
      setSafeText(DOM.errDosage, 'Dosage amount cannot be empty.');
      DOM.medDosage.classList.add('is-invalid');
      hasError = true;
    }

    if (!date) {
      setSafeText(DOM.errDate, 'Please choose a schedule date.');
      DOM.medDate.classList.add('is-invalid');
      hasError = true;
    }

    if (!time) {
      setSafeText(DOM.errTime, 'Please choose a reminder time.');
      DOM.medTime.classList.add('is-invalid');
      hasError = true;
    }

    if (hasError) {
      showToast('Please correct form errors before saving', 'warning');
      return;
    }

    const editId = DOM.editMedId.value;

    if (editId) {
      // Editing existing medicine
      const index = AppState.medicines.findIndex(m => m.id === editId);
      if (index !== -1) {
        AppState.medicines[index] = {
          ...AppState.medicines[index],
          name,
          dosage,
          type,
          date,
          time,
          frequency,
          instructions,
          priority,
          notes,
          updatedAt: new Date().toISOString()
        };
        saveMedicinesToStorage();
        showToast(`Updated "${name}" successfully`, 'success');
        resetForm();
        navigateToView('medicines');
      }
    } else {
      // Creating new medicine
      const newMedicine = {
        id: generateId(),
        name,
        dosage,
        type,
        date,
        time,
        frequency,
        instructions,
        priority,
        notes,
        taken: false,
        takenAt: null,
        snoozedUntil: null,
        createdAt: new Date().toISOString()
      };

      AppState.medicines.push(newMedicine);
      saveMedicinesToStorage();
      showToast(`Medicine "${name}" saved!`, 'success');
      resetForm();
      navigateToView('medicines');
    }
  }

  function resetForm() {
    DOM.medForm.reset();
    DOM.editMedId.value = '';
    setSafeText(DOM.formTitle, 'Add New Medicine');
    setSafeText(DOM.formSubtitle, 'Fill in medicine details to receive timely smart reminders.');
    setSafeText(DOM.btnSaveText, 'Save Medicine');
    DOM.medDate.value = getLocalDateString();
  }

  function startEditMedicine(id) {
    const med = AppState.medicines.find(m => m.id === id);
    if (!med) return;

    DOM.editMedId.value = med.id;
    DOM.medName.value = med.name;
    DOM.medDosage.value = med.dosage;
    DOM.medType.value = med.type || 'tablet';
    DOM.medDate.value = med.date;
    DOM.medTime.value = med.time;
    DOM.medFrequency.value = med.frequency || 'Once Daily';
    DOM.medInstructions.value = med.instructions || 'After Meal';
    DOM.medNotes.value = med.notes || '';

    const priorityRadio = document.querySelector(`input[name="med-priority"][value="${med.priority || 'normal'}"]`);
    if (priorityRadio) priorityRadio.checked = true;

    setSafeText(DOM.formTitle, `Edit Medicine: ${med.name}`);
    setSafeText(DOM.formSubtitle, 'Modify schedule, dosage, or reminder details below.');
    setSafeText(DOM.btnSaveText, 'Update Medicine');

    navigateToView('add');
  }

  function toggleMedicineTaken(id) {
    const med = AppState.medicines.find(m => m.id === id);
    if (!med) return;

    med.taken = !med.taken;
    med.takenAt = med.taken ? new Date().toISOString() : null;

    saveMedicinesToStorage();
    renderAllViews();

    if (med.taken) {
      showToast(`Marked "${med.name}" as taken!`, 'success');
    } else {
      showToast(`Marked "${med.name}" as pending`, 'info');
    }
  }

  function promptDeleteMedicine(id) {
    AppState.confirmActionType = 'delete';
    AppState.medicinePendingDeletionId = id;
    const med = AppState.medicines.find(m => m.id === id);
    const medName = med ? `"${med.name}"` : 'this medicine';
    setSafeText(DOM.deleteModalTitle, 'Delete Medicine?');
    setSafeText(DOM.deleteModalMsg, `Are you sure you want to permanently delete ${medName} from your schedule? This action cannot be undone.`);
    DOM.deleteModal.classList.remove('hidden');
  }

  function executeDeleteMedicine() {
    if (AppState.confirmActionType === 'reset') {
      AppState.medicines = [];
      saveMedicinesToStorage();
      DOM.deleteModal.classList.add('hidden');
      AppState.confirmActionType = 'delete';
      showToast('All medicine data has been reset.', 'info');
      renderAllViews();
      return;
    }

    const id = AppState.medicinePendingDeletionId;
    if (!id) return;

    const med = AppState.medicines.find(m => m.id === id);
    const medName = med ? med.name : 'Medicine';

    AppState.medicines = AppState.medicines.filter(m => m.id !== id);
    saveMedicinesToStorage();

    DOM.deleteModal.classList.add('hidden');
    AppState.medicinePendingDeletionId = null;

    showToast(`Deleted "${medName}"`, 'info');
    renderAllViews();
  }

  /* ==========================================================================
     12. REMINDER LOOP & ALARM MODAL
     ========================================================================== */

  /**
   * Background checker running every 5 seconds
   */
  function checkScheduledReminders() {
    const now = new Date();
    const currentDate = getLocalDateString(now);
    const currentTime = getLocalTimeString(now);
    const minuteStamp = `${currentDate}_${currentTime}`;

    AppState.medicines.forEach(med => {
      // If already taken, skip
      if (med.taken) return;

      const alertKey = `${med.id}_${minuteStamp}`;
      if (AppState.alertedMedicinesThisMinute.has(alertKey)) {
        return; // Already triggered this minute
      }

      // Check snooze condition: trigger when snooze time has elapsed
      if (med.snoozedUntil) {
        const snoozeDate = new Date(med.snoozedUntil);
        if (now >= snoozeDate) {
          AppState.alertedMedicinesThisMinute.add(alertKey);
          med.snoozedUntil = null;
          saveMedicinesToStorage();
          triggerAlarm(med);
          return;
        } else {
          return; // Still in snooze window
        }
      }

      // Check schedule match: exactly matching date and time
      const isDateMatch = med.date === currentDate;
      const isTimeMatch = med.time === currentTime;

      if (isDateMatch && isTimeMatch) {
        AppState.alertedMedicinesThisMinute.add(alertKey);
        triggerAlarm(med);
      }
    });

    // Keep alert set clean
    if (AppState.alertedMedicinesThisMinute.size > 50) {
      AppState.alertedMedicinesThisMinute.clear();
    }
  }

  function triggerAlarm(med) {
    AppState.activeAlarmMedicine = med;
    showAlarmModal(med);
    startAlarmSound();
    sendBrowserNotification(med);
  }

  function showAlarmModal(med) {
    const typeInfo = MED_TYPE_CONFIG[med.type] || MED_TYPE_CONFIG.other;

    setSafeText(DOM.alarmMedName, med.name);
    setSafeText(DOM.alarmMedDosage, `Dosage: ${med.dosage}`);
    setSafeText(DOM.alarmTimeDisplay, format12Hour(med.time));
    setSafeText(DOM.alarmInstructions, med.instructions || 'Standard');
    setSafeText(DOM.alarmFrequency, med.frequency || 'Once Daily');

    // Safe icon replacement
    DOM.alarmTypeIcon.replaceChildren();
    const icon = document.createElement('i');
    icon.className = typeInfo.icon;
    DOM.alarmTypeIcon.appendChild(icon);

    if (med.notes) {
      setSafeText(DOM.alarmNotes, med.notes);
      DOM.alarmNotesContainer.classList.remove('hidden');
    } else {
      DOM.alarmNotesContainer.classList.add('hidden');
    }

    DOM.reminderModal.classList.remove('hidden');
  }

  function closeAlarmModal() {
    DOM.reminderModal.classList.add('hidden');
    stopAlarmSound();
    AppState.activeAlarmMedicine = null;
  }

  function snoozeActiveMedicine(minutes = 10) {
    const med = AppState.activeAlarmMedicine;
    if (!med) {
      closeAlarmModal();
      return;
    }

    const snoozeDate = new Date(Date.now() + minutes * 60 * 1000);
    med.snoozedUntil = snoozeDate.toISOString();
    saveMedicinesToStorage();

    closeAlarmModal();
    showToast(`"${med.name}" snoozed for ${minutes} minutes`, 'warning');
    renderAllViews();
  }

  function markActiveMedicineTaken() {
    const med = AppState.activeAlarmMedicine;
    if (!med) {
      closeAlarmModal();
      return;
    }

    med.taken = true;
    med.takenAt = new Date().toISOString();
    med.snoozedUntil = null;
    saveMedicinesToStorage();

    closeAlarmModal();
    showToast(`Great job! Marked "${med.name}" as taken.`, 'success');
    renderAllViews();
  }

  /* ==========================================================================
     13. DOM RENDERING HELPERS (XSS SAFE)
     ========================================================================== */

  /**
   * Calculates status for a given medicine: 'taken' | 'missed' | 'pending'
   */
  function getMedicineStatus(med) {
    if (med.taken) return 'taken';

    const todayStr = getLocalDateString();
    const nowTimeStr = getLocalTimeString();

    if (med.date < todayStr) return 'missed';
    if (med.date === todayStr && med.time < nowTimeStr) return 'missed';
    return 'pending';
  }

  /**
   * Safely builds a single Medicine Card element using DOM APIs
   */
  function createMedicineCardElement(med) {
    const status = getMedicineStatus(med);
    const typeInfo = MED_TYPE_CONFIG[med.type] || MED_TYPE_CONFIG.other;

    const card = document.createElement('div');
    card.className = `med-card status-${status}`;
    card.setAttribute('data-id', med.id);

    // Top section
    const topRow = document.createElement('div');
    topRow.className = 'med-card-top';

    const mainInfo = document.createElement('div');
    mainInfo.className = 'med-card-main';

    const iconBox = document.createElement('div');
    iconBox.className = 'med-icon-box';
    const icon = document.createElement('i');
    icon.className = typeInfo.icon;
    iconBox.appendChild(icon);

    const nameCol = document.createElement('div');
    const nameElem = document.createElement('h3');
    nameElem.className = 'med-name';
    nameElem.textContent = med.name;

    const dosageElem = document.createElement('div');
    dosageElem.className = 'med-dosage';
    dosageElem.textContent = `${med.dosage} • ${typeInfo.label}`;

    nameCol.appendChild(nameElem);
    nameCol.appendChild(dosageElem);
    mainInfo.appendChild(iconBox);
    mainInfo.appendChild(nameCol);

    const badgeBox = document.createElement('div');
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge badge-${status}`;
    const statusIcon = document.createElement('i');

    if (status === 'taken') {
      statusIcon.className = 'fa-solid fa-check';
      statusBadge.appendChild(statusIcon);
      statusBadge.appendChild(document.createTextNode(' Taken'));
    } else if (status === 'missed') {
      statusIcon.className = 'fa-solid fa-circle-exclamation';
      statusBadge.appendChild(statusIcon);
      statusBadge.appendChild(document.createTextNode(' Missed'));
    } else {
      statusIcon.className = 'fa-regular fa-clock';
      statusBadge.appendChild(statusIcon);
      statusBadge.appendChild(document.createTextNode(' Pending'));
    }
    badgeBox.appendChild(statusBadge);

    if (med.priority === 'high') {
      const highBadge = document.createElement('span');
      highBadge.className = 'badge badge-high-priority';
      highBadge.textContent = 'High';
      badgeBox.appendChild(highBadge);
    }

    topRow.appendChild(mainInfo);
    topRow.appendChild(badgeBox);
    card.appendChild(topRow);

    // Details Grid
    const detailsGrid = document.createElement('div');
    detailsGrid.className = 'med-card-details';

    // Time item
    const timeItem = document.createElement('div');
    timeItem.className = 'detail-item';
    const timeLabel = document.createElement('span');
    timeLabel.className = 'label';
    timeLabel.textContent = 'Time';
    const timeVal = document.createElement('span');
    timeVal.className = 'value';
    const clockIcon = document.createElement('i');
    clockIcon.className = 'fa-regular fa-clock';
    timeVal.appendChild(clockIcon);
    timeVal.appendChild(document.createTextNode(` ${format12Hour(med.time)}`));
    timeItem.appendChild(timeLabel);
    timeItem.appendChild(timeVal);

    // Date item
    const dateItem = document.createElement('div');
    dateItem.className = 'detail-item';
    const dateLabel = document.createElement('span');
    dateLabel.className = 'label';
    dateLabel.textContent = 'Date';
    const dateVal = document.createElement('span');
    dateVal.className = 'value';
    const calIcon = document.createElement('i');
    calIcon.className = 'fa-regular fa-calendar';
    dateVal.appendChild(calIcon);
    dateVal.appendChild(document.createTextNode(` ${formatReadableDate(med.date)}`));
    dateItem.appendChild(dateLabel);
    dateItem.appendChild(dateVal);

    // Frequency item
    const freqItem = document.createElement('div');
    freqItem.className = 'detail-item';
    const freqLabel = document.createElement('span');
    freqLabel.className = 'label';
    freqLabel.textContent = 'Frequency';
    const freqVal = document.createElement('span');
    freqVal.className = 'value';
    freqVal.textContent = med.frequency || 'Once Daily';
    freqItem.appendChild(freqLabel);
    freqItem.appendChild(freqVal);

    // Instructions item
    const instItem = document.createElement('div');
    instItem.className = 'detail-item';
    const instLabel = document.createElement('span');
    instLabel.className = 'label';
    instLabel.textContent = 'Timing';
    const instVal = document.createElement('span');
    instVal.className = 'value';
    instVal.textContent = med.instructions || 'After Meal';
    instItem.appendChild(instLabel);
    instItem.appendChild(instVal);

    detailsGrid.appendChild(timeItem);
    detailsGrid.appendChild(dateItem);
    detailsGrid.appendChild(freqItem);
    detailsGrid.appendChild(instItem);
    card.appendChild(detailsGrid);

    // Doctor Notes if present
    if (med.notes) {
      const notesBox = document.createElement('div');
      notesBox.className = 'med-card-notes';
      notesBox.textContent = `Note: ${med.notes}`;
      card.appendChild(notesBox);
    }

    // Actions Row
    const actionsRow = document.createElement('div');
    actionsRow.className = 'med-card-actions';

    // Mark Taken / Untaken Button
    const btnTake = document.createElement('button');
    btnTake.className = `btn btn-sm btn-card-take ${med.taken ? 'btn-outline' : 'btn-success'}`;
    const takeIcon = document.createElement('i');
    takeIcon.className = med.taken ? 'fa-solid fa-arrow-rotate-left' : 'fa-solid fa-check';
    btnTake.appendChild(takeIcon);
    btnTake.appendChild(document.createTextNode(med.taken ? ' Mark Pending' : ' Mark as Taken'));
    btnTake.addEventListener('click', () => toggleMedicineTaken(med.id));
    actionsRow.appendChild(btnTake);

    // Edit Button
    const btnEdit = document.createElement('button');
    btnEdit.className = 'icon-btn';
    btnEdit.setAttribute('title', 'Edit Medicine');
    btnEdit.setAttribute('aria-label', 'Edit Medicine');
    const editIcon = document.createElement('i');
    editIcon.className = 'fa-solid fa-pen-to-square';
    btnEdit.appendChild(editIcon);
    btnEdit.addEventListener('click', () => startEditMedicine(med.id));
    actionsRow.appendChild(btnEdit);

    // Delete Button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'icon-btn text-danger';
    btnDelete.setAttribute('title', 'Delete Medicine');
    btnDelete.setAttribute('aria-label', 'Delete Medicine');
    const deleteIcon = document.createElement('i');
    deleteIcon.className = 'fa-solid fa-trash';
    btnDelete.appendChild(deleteIcon);
    btnDelete.addEventListener('click', () => promptDeleteMedicine(med.id));
    actionsRow.appendChild(btnDelete);

    card.appendChild(actionsRow);
    return card;
  }

  /**
   * Safely builds a Table Row element for table view
   */
  function createMedicineTableRow(med) {
    const status = getMedicineStatus(med);
    const typeInfo = MED_TYPE_CONFIG[med.type] || MED_TYPE_CONFIG.other;

    const tr = document.createElement('tr');

    // Status Cell
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge badge-${status}`;
    badge.textContent = status === 'taken' ? 'Taken' : (status === 'missed' ? 'Missed' : 'Pending');
    tdStatus.appendChild(badge);
    tr.appendChild(tdStatus);

    // Name & Type Cell
    const tdName = document.createElement('td');
    const nameWrap = document.createElement('div');
    nameWrap.style.display = 'flex';
    nameWrap.style.alignItems = 'center';
    nameWrap.style.gap = '0.5rem';
    const typeIcon = document.createElement('i');
    typeIcon.className = typeInfo.icon;
    typeIcon.style.color = typeInfo.color;
    const strongName = document.createElement('strong');
    strongName.textContent = med.name;
    nameWrap.appendChild(typeIcon);
    nameWrap.appendChild(strongName);
    tdName.appendChild(nameWrap);
    tr.appendChild(tdName);

    // Dosage Cell
    const tdDosage = document.createElement('td');
    tdDosage.textContent = `${med.dosage} (${typeInfo.label})`;
    tr.appendChild(tdDosage);

    // Schedule Cell
    const tdSchedule = document.createElement('td');
    tdSchedule.textContent = `${format12Hour(med.time)}, ${formatReadableDate(med.date)}`;
    tr.appendChild(tdSchedule);

    // Frequency Cell
    const tdFreq = document.createElement('td');
    tdFreq.textContent = med.frequency || 'Once Daily';
    tr.appendChild(tdFreq);

    // Instructions Cell
    const tdInst = document.createElement('td');
    tdInst.textContent = med.instructions || 'After Meal';
    tr.appendChild(tdInst);

    // Actions Cell
    const tdActions = document.createElement('td');
    const actWrap = document.createElement('div');
    actWrap.className = 'table-actions';

    const btnTake = document.createElement('button');
    btnTake.className = `btn btn-sm ${med.taken ? 'btn-outline' : 'btn-success'}`;
    const tIcon = document.createElement('i');
    tIcon.className = med.taken ? 'fa-solid fa-arrow-rotate-left' : 'fa-solid fa-check';
    btnTake.appendChild(tIcon);
    btnTake.addEventListener('click', () => toggleMedicineTaken(med.id));

    const btnEdit = document.createElement('button');
    btnEdit.className = 'icon-btn';
    btnEdit.title = 'Edit';
    const eIcon = document.createElement('i');
    eIcon.className = 'fa-solid fa-pen';
    btnEdit.appendChild(eIcon);
    btnEdit.addEventListener('click', () => startEditMedicine(med.id));

    const btnDel = document.createElement('button');
    btnDel.className = 'icon-btn text-danger';
    btnDel.title = 'Delete';
    const dIcon = document.createElement('i');
    dIcon.className = 'fa-solid fa-trash';
    btnDel.appendChild(dIcon);
    btnDel.addEventListener('click', () => promptDeleteMedicine(med.id));

    actWrap.appendChild(btnTake);
    actWrap.appendChild(btnEdit);
    actWrap.appendChild(btnDel);
    tdActions.appendChild(actWrap);
    tr.appendChild(tdActions);

    return tr;
  }

  /* ==========================================================================
     14. RENDERING ALL SECTIONS
     ========================================================================== */

  function renderAllViews() {
    renderHomeView();
    renderDashboardView();
    renderMedicinesListView();
    updateNextDoseCountdown();
    setSafeText(DOM.navMedCount, String(AppState.medicines.length));
  }

  /**
   * Render Today's Scheduled Reminders (Home View)
   */
  function renderHomeView() {
    const todayStr = getLocalDateString();
    setSafeText(DOM.todayDateText, `Schedule for ${formatReadableDate(todayStr)}`);

    let todayMeds = AppState.medicines.filter(m => m.date === todayStr);

    if (AppState.todayFilter === 'pending') {
      todayMeds = todayMeds.filter(m => !m.taken);
    } else if (AppState.todayFilter === 'taken') {
      todayMeds = todayMeds.filter(m => m.taken);
    }

    // Sort by scheduled time
    todayMeds.sort((a, b) => a.time.localeCompare(b.time));

    DOM.todayMedicinesGrid.replaceChildren();

    if (todayMeds.length === 0) {
      DOM.todayEmptyState.classList.remove('hidden');
    } else {
      DOM.todayEmptyState.classList.add('hidden');
      todayMeds.forEach(med => {
        DOM.todayMedicinesGrid.appendChild(createMedicineCardElement(med));
      });
    }
  }

  /**
   * Render Adherence Dashboard Statistics
   */
  function renderDashboardView() {
    const todayStr = getLocalDateString();
    const nowTimeStr = getLocalTimeString();

    const totalCount = AppState.medicines.length;
    const todayMeds = AppState.medicines.filter(m => m.date === todayStr);
    const todayTotal = todayMeds.length;

    const completedToday = todayMeds.filter(m => m.taken).length;
    const pendingToday = todayMeds.filter(m => !m.taken && m.time >= nowTimeStr).length;
    const missedToday = todayMeds.filter(m => !m.taken && m.time < nowTimeStr).length;

    // Stat Cards
    setSafeText(DOM.statTotal, String(totalCount));
    setSafeText(DOM.statToday, String(todayTotal));
    setSafeText(DOM.statUpcoming, String(pendingToday));
    setSafeText(DOM.statCompleted, String(completedToday));
    setSafeText(DOM.statMissed, String(missedToday));

    // Adherence Percentage
    let adherenceRate = 0;
    if (todayTotal > 0) {
      adherenceRate = Math.round((completedToday / todayTotal) * 100);
    } else if (totalCount > 0) {
      // If none today, show lifetime completed rate
      const totalTaken = AppState.medicines.filter(m => m.taken).length;
      adherenceRate = Math.round((totalTaken / totalCount) * 100);
    }

    setSafeText(DOM.adherencePercentage, `${adherenceRate}%`);
    setSafeText(DOM.adhTakenCount, String(completedToday));
    setSafeText(DOM.adhPendingCount, String(pendingToday));
    setSafeText(DOM.adhMissedCount, String(missedToday));

    // Progress Ring offset calculation (Circumference = 2 * PI * 64 = ~402.12)
    const circumference = 402.12;
    const offset = circumference - (circumference * adherenceRate) / 100;
    DOM.adherenceCircle.style.strokeDashoffset = offset;

    // Status description
    if (adherenceRate >= 80) {
      DOM.adherenceCircle.setAttribute('stroke', '#10b981');
      setSafeText(DOM.adherenceStatusTag, 'Excellent');
      setSafeText(DOM.adherenceHeading, 'Optimal Adherence');
      setSafeText(DOM.adherenceDesc, 'Outstanding compliance! You are consistently taking your doses on time.');
    } else if (adherenceRate >= 50) {
      DOM.adherenceCircle.setAttribute('stroke', '#0284c7');
      setSafeText(DOM.adherenceStatusTag, 'Good');
      setSafeText(DOM.adherenceHeading, 'Steady Progress');
      setSafeText(DOM.adherenceDesc, 'You are keeping up with your doses. Don’t forget pending medications.');
    } else {
      DOM.adherenceCircle.setAttribute('stroke', '#f59e0b');
      setSafeText(DOM.adherenceStatusTag, 'Needs Attention');
      setSafeText(DOM.adherenceHeading, 'Adherence Alert');
      setSafeText(DOM.adherenceDesc, 'Multiple doses are still pending or missed. Maintain your routine to ensure treatment effectiveness.');
    }

    // Medicine Type Breakdown Bars
    renderTypeBreakdown();
  }

  function renderTypeBreakdown() {
    DOM.typesBreakdownList.replaceChildren();

    const counts = {};
    Object.keys(MED_TYPE_CONFIG).forEach(key => (counts[key] = 0));

    AppState.medicines.forEach(med => {
      const type = med.type || 'tablet';
      if (counts[type] !== undefined) {
        counts[type]++;
      } else {
        counts.other = (counts.other || 0) + 1;
      }
    });

    const total = AppState.medicines.length || 1;

    Object.keys(MED_TYPE_CONFIG).forEach(key => {
      const count = counts[key] || 0;
      if (count === 0 && AppState.medicines.length > 0) return; // Hide empty types if there are medicines

      const typeConfig = MED_TYPE_CONFIG[key];
      const pct = Math.round((count / total) * 100);

      const item = document.createElement('div');
      item.className = 'type-progress-item';

      const infoRow = document.createElement('div');
      infoRow.className = 'type-progress-info';

      const labelSpan = document.createElement('span');
      const icon = document.createElement('i');
      icon.className = `${typeConfig.icon} me-1`;
      labelSpan.appendChild(icon);
      labelSpan.appendChild(document.createTextNode(` ${typeConfig.label}`));

      const countSpan = document.createElement('span');
      countSpan.textContent = `${count} (${pct}%)`;

      infoRow.appendChild(labelSpan);
      infoRow.appendChild(countSpan);

      const barBg = document.createElement('div');
      barBg.className = 'type-progress-bar-bg';
      const barFill = document.createElement('div');
      barFill.className = 'type-progress-bar-fill';
      barFill.style.width = `${pct}%`;
      barBg.appendChild(barFill);

      item.appendChild(infoRow);
      item.appendChild(barBg);
      DOM.typesBreakdownList.appendChild(item);
    });
  }

  /**
   * Render All / Filtered Medicines (My Medicines View)
   */
  function renderMedicinesListView() {
    let list = [...AppState.medicines];

    // Search filter
    if (AppState.searchQuery) {
      const q = AppState.searchQuery.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.dosage.toLowerCase().includes(q) ||
        (m.notes && m.notes.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (AppState.filterStatus !== 'all') {
      if (AppState.filterStatus === 'high') {
        list = list.filter(m => m.priority === 'high');
      } else {
        list = list.filter(m => getMedicineStatus(m) === AppState.filterStatus);
      }
    }

    // Type filter
    if (AppState.filterType !== 'all') {
      list = list.filter(m => m.type === AppState.filterType);
    }

    // Date filter
    if (AppState.filterDate) {
      list = list.filter(m => m.date === AppState.filterDate);
    }

    // Sorting
    list.sort((a, b) => {
      if (AppState.sortBy === 'time-asc') {
        return a.time.localeCompare(b.time);
      } else if (AppState.sortBy === 'time-desc') {
        return b.time.localeCompare(a.time);
      } else if (AppState.sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      } else if (AppState.sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      } else if (AppState.sortBy === 'priority') {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        return a.time.localeCompare(b.time);
      }
      return 0;
    });

    // Update Filter Summary
    setSafeText(DOM.filteredCountText, `Showing ${list.length} of ${AppState.medicines.length} medicines`);

    const hasActiveFilters = AppState.searchQuery || AppState.filterStatus !== 'all' || AppState.filterType !== 'all' || AppState.filterDate;
    if (hasActiveFilters) {
      DOM.resetFiltersBtn.classList.remove('hidden');
    } else {
      DOM.resetFiltersBtn.classList.add('hidden');
    }

    // Render Cards or Table
    DOM.allMedicinesGrid.replaceChildren();
    DOM.medicinesTableBody.replaceChildren();

    if (list.length === 0) {
      DOM.allEmptyState.classList.remove('hidden');
      DOM.allMedicinesGrid.classList.add('hidden');
      DOM.medicinesTableWrapper.classList.add('hidden');
    } else {
      DOM.allEmptyState.classList.add('hidden');

      if (AppState.viewMode === 'cards') {
        DOM.allMedicinesGrid.classList.remove('hidden');
        DOM.medicinesTableWrapper.classList.add('hidden');
        list.forEach(med => {
          DOM.allMedicinesGrid.appendChild(createMedicineCardElement(med));
        });
      } else {
        DOM.allMedicinesGrid.classList.add('hidden');
        DOM.medicinesTableWrapper.classList.remove('hidden');
        list.forEach(med => {
          DOM.medicinesTableBody.appendChild(createMedicineTableRow(med));
        });
      }
    }
  }

  /* ==========================================================================
     15. PRELOAD REALISTIC SAMPLE DATA FOR DEMONSTRATIONS
     ========================================================================== */
  function loadSampleData(notify = true) {
    const today = getLocalDateString();
    const now = new Date();
    
    // Create a time 1 minute into the future so faculty can witness the live reminder
    const reminderDate = new Date(now.getTime() + 65 * 1000);
    const demoTime = getLocalTimeString(reminderDate);

    const samples = [
      {
        id: generateId(),
        name: 'Amoxicillin 500mg',
        dosage: '1 Capsule',
        type: 'capsule',
        date: today,
        time: '08:00',
        frequency: 'Twice Daily',
        instructions: 'After Meal',
        priority: 'high',
        notes: 'Take with full glass of water. Finish entire antibiotic course.',
        taken: true,
        takenAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      },
      {
        id: generateId(),
        name: 'Metformin Hydrochloride',
        dosage: '500 mg',
        type: 'tablet',
        date: today,
        time: demoTime, // Scheduled to ring in ~1 minute for demo!
        frequency: 'Twice Daily',
        instructions: 'With Meal',
        priority: 'high',
        notes: 'Prescribed for blood sugar management by Dr. Mehta.',
        taken: false,
        takenAt: null,
        createdAt: new Date().toISOString()
      },
      {
        id: generateId(),
        name: 'Ascoril D Plus Cough Syrup',
        dosage: '10 ml',
        type: 'syrup',
        date: today,
        time: '14:30',
        frequency: 'Thrice Daily',
        instructions: 'After Meal',
        priority: 'normal',
        notes: 'Measure using calibrated measuring cap.',
        taken: false,
        takenAt: null,
        createdAt: new Date().toISOString()
      },
      {
        id: generateId(),
        name: 'Lubricant Eye Drops',
        dosage: '2 Drops',
        type: 'drops',
        date: today,
        time: '19:00',
        frequency: 'Every 6 Hours',
        instructions: 'Anytime',
        priority: 'normal',
        notes: 'Apply in both eyes to relieve digital eye fatigue.',
        taken: false,
        takenAt: null,
        createdAt: new Date().toISOString()
      },
      {
        id: generateId(),
        name: 'Vitamin D3 & Calcium',
        dosage: '60,000 IU',
        type: 'tablet',
        date: today,
        time: '21:00',
        frequency: 'Weekly',
        instructions: 'Bedtime',
        priority: 'normal',
        notes: 'Take after dinner with warm milk.',
        taken: false,
        takenAt: null,
        createdAt: new Date().toISOString()
      }
    ];

    AppState.medicines = samples;
    saveMedicinesToStorage();
    renderAllViews();
    if (notify) {
      showToast(`Loaded 5 sample medicines. "Metformin" will ring at ${format12Hour(demoTime)}!`, 'success');
    }
  }

  /* ==========================================================================
     16. EVENT LISTENERS SETUP
     ========================================================================== */
  function setupEventListeners() {
    // Navigation Links
    DOM.navLinks.forEach(link => {
      link.addEventListener('click', () => {
        const view = link.getAttribute('data-view');
        navigateToView(view);
      });
    });

    // Brand Logo Click -> Go Dashboard (if logged in) or Auth (if logged out)
    DOM.brandLogo.addEventListener('click', () => {
      if (AppState.currentUser) {
        navigateToView('dashboard');
      } else {
        navigateToView('auth');
      }
    });

    // Mobile Menu Toggle
    DOM.mobileToggle.addEventListener('click', () => {
      DOM.navMenu.classList.toggle('open');
    });

    // Theme & Sound & Notification Toggles
    DOM.btnToggleTheme.addEventListener('click', toggleTheme);
    DOM.btnToggleSound.addEventListener('click', toggleSound);
    DOM.btnToggleNotif.addEventListener('click', requestNotificationPermission);

    // Test Alarm Sound Buttons
    if (DOM.btnTestSound) {
      DOM.btnTestSound.addEventListener('click', testAlarmSound);
    }
    if (DOM.heroBtnTestSound) {
      DOM.heroBtnTestSound.addEventListener('click', testAlarmSound);
    }
    if (DOM.dashBtnTestSound) {
      DOM.dashBtnTestSound.addEventListener('click', testAlarmSound);
    }
    if (DOM.aboutBtnTestSound) {
      DOM.aboutBtnTestSound.addEventListener('click', testAlarmSound);
    }

    // Hero CTA Buttons
    DOM.heroBtnAdd.addEventListener('click', () => {
      resetForm();
      navigateToView('add');
    });
    DOM.heroBtnList.addEventListener('click', () => navigateToView('medicines'));
    DOM.heroBtnDemo.addEventListener('click', () => loadSampleData(true));
    DOM.emptyAddBtn.addEventListener('click', () => {
      resetForm();
      navigateToView('add');
    });

    // Auth Switching Tabs
    if (DOM.tabLogin) DOM.tabLogin.addEventListener('click', () => switchAuthTab('login'));
    if (DOM.tabRegister) DOM.tabRegister.addEventListener('click', () => switchAuthTab('register'));
    if (DOM.linkGotoRegister) DOM.linkGotoRegister.addEventListener('click', () => switchAuthTab('register'));
    if (DOM.linkGotoLogin) DOM.linkGotoLogin.addEventListener('click', () => switchAuthTab('login'));

    // Password Eye Show/Hide Buttons
    if (DOM.btnToggleLoginPwd) {
      DOM.btnToggleLoginPwd.addEventListener('click', () => togglePasswordInput(DOM.loginPassword, DOM.iconLoginPwd));
    }
    if (DOM.btnToggleRegPwd) {
      DOM.btnToggleRegPwd.addEventListener('click', () => togglePasswordInput(DOM.regPassword, DOM.iconRegPwd));
    }
    if (DOM.btnToggleRegConfirmPwd) {
      DOM.btnToggleRegConfirmPwd.addEventListener('click', () => togglePasswordInput(DOM.regConfirmPassword, DOM.iconRegConfirmPwd));
    }

    // Auth Forms Submission
    if (DOM.formLogin) DOM.formLogin.addEventListener('submit', handleLoginSubmit);
    if (DOM.formRegister) DOM.formRegister.addEventListener('submit', handleRegisterSubmit);

    // Quick Demo Button
    if (DOM.btnQuickDemo) DOM.btnQuickDemo.addEventListener('click', handleQuickDemoLogin);

    // Logout Buttons (Dashboard & Navbar)
    if (DOM.btnNavLogout) DOM.btnNavLogout.addEventListener('click', handleLogout);
    if (DOM.dashBtnLogout) DOM.dashBtnLogout.addEventListener('click', handleLogout);

    // Today's Home Filters
    DOM.homeFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        DOM.homeFilterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.todayFilter = btn.getAttribute('data-filter') || 'all';
        renderHomeView();
      });
    });

    // Form Events
    DOM.medForm.addEventListener('submit', handleFormSubmit);
    DOM.btnCancelEdit.addEventListener('click', () => {
      resetForm();
      navigateToView('medicines');
    });

    // Search Input
    DOM.searchInput.addEventListener('input', e => {
      AppState.searchQuery = e.target.value.trim();
      if (AppState.searchQuery) {
        DOM.clearSearchBtn.classList.remove('hidden');
      } else {
        DOM.clearSearchBtn.classList.add('hidden');
      }
      renderMedicinesListView();
    });

    DOM.clearSearchBtn.addEventListener('click', () => {
      DOM.searchInput.value = '';
      AppState.searchQuery = '';
      DOM.clearSearchBtn.classList.add('hidden');
      renderMedicinesListView();
    });

    // Filter Controls
    DOM.filterStatus.addEventListener('change', e => {
      AppState.filterStatus = e.target.value;
      renderMedicinesListView();
    });

    DOM.filterType.addEventListener('change', e => {
      AppState.filterType = e.target.value;
      renderMedicinesListView();
    });

    DOM.filterDate.addEventListener('change', e => {
      AppState.filterDate = e.target.value;
      if (AppState.filterDate) {
        DOM.btnClearDate.classList.remove('hidden');
      } else {
        DOM.btnClearDate.classList.add('hidden');
      }
      renderMedicinesListView();
    });

    DOM.btnClearDate.addEventListener('click', () => {
      DOM.filterDate.value = '';
      AppState.filterDate = '';
      DOM.btnClearDate.classList.add('hidden');
      renderMedicinesListView();
    });

    DOM.sortBy.addEventListener('change', e => {
      AppState.sortBy = e.target.value;
      renderMedicinesListView();
    });

    DOM.resetFiltersBtn.addEventListener('click', () => {
      DOM.searchInput.value = '';
      AppState.searchQuery = '';
      DOM.clearSearchBtn.classList.add('hidden');

      DOM.filterStatus.value = 'all';
      AppState.filterStatus = 'all';

      DOM.filterType.value = 'all';
      AppState.filterType = 'all';

      DOM.filterDate.value = '';
      AppState.filterDate = '';
      DOM.btnClearDate.classList.add('hidden');

      DOM.sortBy.value = 'time-asc';
      AppState.sortBy = 'time-asc';

      renderMedicinesListView();
    });

    // View Mode Toggle (Cards vs Table)
    DOM.btnViewCards.addEventListener('click', () => {
      AppState.viewMode = 'cards';
      localStorage.setItem(STORAGE_KEY_VIEW_MODE, 'cards');
      DOM.btnViewCards.classList.add('active');
      DOM.btnViewTable.classList.remove('active');
      renderMedicinesListView();
    });

    DOM.btnViewTable.addEventListener('click', () => {
      AppState.viewMode = 'table';
      localStorage.setItem(STORAGE_KEY_VIEW_MODE, 'table');
      DOM.btnViewTable.classList.add('active');
      DOM.btnViewCards.classList.remove('active');
      renderMedicinesListView();
    });

    // Add button from list view
    DOM.btnAddFromList.addEventListener('click', () => {
      resetForm();
      navigateToView('add');
    });
    DOM.btnEmptyAddAction.addEventListener('click', () => {
      resetForm();
      navigateToView('add');
    });

    // Alarm Modal Actions
    DOM.btnAlarmTake.addEventListener('click', markActiveMedicineTaken);
    DOM.btnAlarmSnooze.addEventListener('click', () => snoozeActiveMedicine(10));
    DOM.btnAlarmDismiss.addEventListener('click', closeAlarmModal);

    // Delete Modal Actions
    DOM.btnCancelDelete.addEventListener('click', () => {
      DOM.deleteModal.classList.add('hidden');
      AppState.medicinePendingDeletionId = null;
    });
    DOM.btnConfirmDelete.addEventListener('click', executeDeleteMedicine);

    // Dashboard Data Export / Reset
    DOM.btnExportData.addEventListener('click', exportDataAsJson);
    DOM.btnResetData.addEventListener('click', resetAllData);
  }

  function exportDataAsJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(AppState.medicines, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `medicare_schedule_${getLocalDateString()}.json`);
    dlAnchor.click();
    showToast('Schedule exported successfully!', 'success');
  }

  function resetAllData() {
    AppState.confirmActionType = 'reset';
    setSafeText(DOM.deleteModalTitle, 'Reset All Records?');
    setSafeText(DOM.deleteModalMsg, 'Are you sure you want to permanently erase all saved medicines and reset the schedule? This action cannot be undone.');
    DOM.deleteModal.classList.remove('hidden');
  }

  /* ==========================================================================
     17. INITIALIZATION
     ========================================================================== */
  function init() {
    setupAudioAutoplayUnlock();
    initTheme();
    initNotificationPermission();
    setupEventListeners();

    // Default form date to today
    if (DOM.medDate) {
      DOM.medDate.value = getLocalDateString();
    }

    // Check user session
    const hasSession = loadUserSession();
    if (hasSession) {
      loadMedicinesFromStorage();
      navigateToView('dashboard');
    } else {
      navigateToView('auth');
    }

    // Start Live Clock
    updateLiveClock();
    setInterval(updateLiveClock, 1000);

    // Start Countdown update loop (every second)
    setInterval(updateNextDoseCountdown, 1000);

    // Start Scheduled Reminders polling loop (every 5 seconds)
    setInterval(checkScheduledReminders, 5000);
  }

  // Expose namespace for testing & developer inspection
  window.MediCare = {
    AppState,
    DOM,
    triggerAlarm,
    testAlarmSound,
    stopAlarmSound,
    navigateToView,
    getUsersFromStorage,
    saveUserSession,
    clearUserSession,
    loadSampleData
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
