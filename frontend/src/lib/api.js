import axios from "axios";
import { resolveBackendBase } from "@/lib/backendBase";

const API_BASE = `${resolveBackendBase()}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: 20000,
});

function sessionSecretKey(sessionId) {
  return `ig_session_secret_${sessionId}`;
}

export function storeInterviewSessionSecret(sessionId, secret) {
  if (sessionId && secret && typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(sessionSecretKey(sessionId), secret);
  }
}

export function clearInterviewSessionSecret(sessionId) {
  if (sessionId && typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(sessionSecretKey(sessionId));
  }
}

function resolveSessionIdFromConfig(config) {
  const url = config.url || "";
  const m = url.match(/^\/sessions\/([^/]+)/);
  if (m) return m[1];
  const data = config.data;
  if (data instanceof FormData) {
    const sid = data.get("session_id");
    return typeof sid === "string" ? sid : null;
  }
  if (data && typeof data === "object" && data.session_id) {
    return data.session_id;
  }
  return null;
}

export function getClientFingerprint() {
  if (typeof window === "undefined") return undefined;
  const k = "ig_client_fingerprint";
  let v = localStorage.getItem(k);
  if (!v) {
    v =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(k, v);
  }
  return v;
}

api.interceptors.request.use((config) => {
  const sid = resolveSessionIdFromConfig(config);
  if (sid && typeof sessionStorage !== "undefined") {
    const sec = sessionStorage.getItem(sessionSecretKey(sid));
    if (sec) {
      config.headers = config.headers || {};
      config.headers["X-Session-Secret"] = sec;
    }
  }
  return config;
});

export const createSession = (data) => {
  const payload = { ...data };
  if (typeof window !== "undefined" && payload.client_fingerprint == null) {
    payload.client_fingerprint = getClientFingerprint();
  }
  return api.post("/sessions", payload);
};
export const listSessions = (status) => api.get("/sessions", { params: status ? { status } : {} });
export const getSession = (id) => api.get(`/sessions/${id}`);
export const getQuestions = (stack, limit, difficulty) =>
  api.get("/questions", { params: { stack, limit, ...(difficulty ? { difficulty } : {}) } });
export const updateQuestionCodingAssets = (questionId, coding_template, coding_test_cases) =>
  api.put(`/questions/${questionId}/coding-assets`, { coding_template, coding_test_cases });
export const createRound = (sessionId, questionId) =>
  api.post("/interview/round", { session_id: sessionId, question_id: questionId });
export const generateQuestion = (sessionId) => api.post("/interview/question", { session_id: sessionId });
export const evaluateAnswer = (sessionId, roundId, answer) =>
  api.post("/interview/evaluate", { session_id: sessionId, round_id: roundId, answer });
export const runCode = (stack, code, stdin = "") =>
  api.post("/interview/code/run", { stack, code, stdin });
export const submitAnswer = (sessionId, roundId, answer) =>
  api.post("/interview/submit", { session_id: sessionId, round_id: roundId, answer });
export const updateSubmittedAnswer = (sessionId, roundId, answer) =>
  api.post("/interview/answer", { session_id: sessionId, round_id: roundId, answer });
export const uploadAnswerAudio = (sessionId, roundId, audioBlob, transcript = "", durationMs = null) => {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("round_id", roundId);
  formData.append("transcript", transcript);
  if (typeof durationMs === "number") formData.append("duration_ms", String(durationMs));
  formData.append("audio", audioBlob, `answer-${roundId}.webm`);
  return api.post("/interview/answer-audio", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
export const deleteAnswerAudio = (sessionId, roundId) =>
  api.post("/interview/answer-audio/delete", { session_id: sessionId, round_id: roundId });
export const completeSession = (sessionId) => api.post(`/sessions/${sessionId}/complete`);
export const getDashboardOverview = () => api.get("/dashboard/overview");
export const getSkillRadar = () => api.get("/dashboard/skill-radar");
export const getScoreTrend = () => api.get("/dashboard/trend");
export const getCategoryStats = () => api.get("/dashboard/category-stats");
export const getWeakTopics = () => api.get("/dashboard/weak-topics");
export const getComparisonData = (id1, id2) => api.get("/comparison", { params: { session1: id1, session2: id2 } });
export const createBookmark = (sessionId, roundId) => api.post("/bookmarks", { session_id: sessionId, round_id: roundId });
export const listBookmarks = () => api.get("/bookmarks");
export const deleteBookmark = (id) => api.delete(`/bookmarks/${id}`);
export const verifyEmail = (token) => api.post("/auth/verify-email", { token });
export const resendVerificationEmail = (email) => api.post("/auth/resend-verification", { email });

export function buildSessionAuthHeaders(sessionId) {
  const h = {};
  if (sessionId && typeof sessionStorage !== "undefined") {
    const sec = sessionStorage.getItem(sessionSecretKey(sessionId));
    if (sec) h["X-Session-Secret"] = sec;
  }
  return h;
}

export default api;
