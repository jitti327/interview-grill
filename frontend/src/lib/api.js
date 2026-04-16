import axios from "axios";

const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

export const createSession = (data) => api.post("/sessions", data);
export const listSessions = (status) => api.get("/sessions", { params: status ? { status } : {} });
export const getSession = (id) => api.get(`/sessions/${id}`);
export const generateQuestion = (sessionId) => api.post("/interview/question", { session_id: sessionId });
export const evaluateAnswer = (sessionId, roundId, answer) =>
  api.post("/interview/evaluate", { session_id: sessionId, round_id: roundId, answer });
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

export default api;
