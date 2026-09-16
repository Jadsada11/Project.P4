import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request interceptor: attach Bearer token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle errors & normalize error messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginRequest = error.config?.url?.includes("/auth/login");
      if (!isLoginRequest) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Helper to extract human-readable error message from Axios error
 */
export function getErrorMessage(error) {
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => d.msg || d.message).join(", ");
    }
    return JSON.stringify(detail);
  }
  if (error.message === "Network Error") {
    return "Cannot connect to server. Please ensure the backend is running at " + API_BASE_URL;
  }
  return error.message || "An unexpected error occurred.";
}

// ==========================================
// YOLO Detection & History Service
// ==========================================
export const detectionApi = {
  getStats: () => api.get("/detection/stats").then((res) => res.data),
  getHistory: (category = "") =>
    api
      .get("/detection/history", {
        params: category && category !== "ALL" ? { category } : {},
      })
      .then((res) => res.data),
  detectImage: (formData) =>
    api
      .post("/detection/detect-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => res.data),
  detectESP32: (payload) =>
    api.post("/detection/detect-esp32", payload).then((res) => res.data),
  getEsp32StreamUrl: (ip, port = "") => {
    const cleanIp = ip ? ip.trim().replace(/^https?:\/\//, "").split("/")[0] : "192.168.137.65";
    const cleanPort = port && port.trim() !== "8000" && port.trim() !== "80" ? port.trim() : "";
    return `${API_BASE_URL}/detection/esp32-stream?camera_ip=${encodeURIComponent(cleanIp)}&camera_port=${encodeURIComponent(cleanPort)}`;
  },
  getEsp32SnapshotUrl: (ip, port = "", path = "/capture") => {
    const cleanIp = ip ? ip.trim().replace(/^https?:\/\//, "").split("/")[0] : "192.168.137.65";
    const cleanPort = port && port.trim() !== "8000" && port.trim() !== "80" ? port.trim() : "";
    return `${API_BASE_URL}/detection/esp32-snapshot?camera_ip=${encodeURIComponent(cleanIp)}&camera_port=${encodeURIComponent(cleanPort)}&camera_path=${encodeURIComponent(path || "/capture")}&_t=${Date.now()}`;
  },
  fetchEsp32SnapshotBlob: (ip, port = "", path = "/capture") => {
    const cleanIp = ip ? ip.trim().replace(/^https?:\/\//, "").split("/")[0] : "192.168.137.65";
    const cleanPort = port && port.trim() !== "8000" && port.trim() !== "80" ? port.trim() : "";
    return api
      .get("/detection/esp32-snapshot", {
        params: {
          camera_ip: cleanIp,
          camera_port: cleanPort,
          camera_path: path || "/capture",
          _t: Date.now(),
        },
        responseType: "blob",
      })
      .then((res) => res.data);
  },
  deleteHistory: (id) =>
    api.delete(`/detection/history/${id}`).then((res) => res.data),
  clearHistory: (category = "") =>
    api
      .delete("/detection/history", {
        params: category && category !== "ALL" ? { category } : {},
      })
      .then((res) => res.data),
  identifyPerson: (historyId, payload) =>
    api
      .put(`/detection/history/${historyId}/identify`, payload)
      .then((res) => res.data),
};

// ==========================================
// Security Alerts Service
// ==========================================
export const alertsApi = {
  getAlerts: (category = "", unreadOnly = false) =>
    api
      .get("/alerts", {
        params: {
          category: category && category !== "ALL" ? category : undefined,
          unread_only: unreadOnly ? true : undefined,
        },
      })
      .then((res) => res.data),
  getUnreadCount: () =>
    api.get("/alerts/unread-count").then((res) => res.data?.unread_count ?? 0),
  markRead: (id, isRead) =>
    api.put(`/alerts/${id}/read`, { is_read: isRead }).then((res) => res.data),
  markAllRead: () => api.put("/alerts/read-all").then((res) => res.data),
  deleteAlert: (id) => api.delete(`/alerts/${id}`).then((res) => res.data),
<<<<<<< HEAD
  clearAlerts: (category = "", readOnly = false) =>
=======
  clearAlerts: ({ category = "", readOnly = false } = {}) =>
>>>>>>> 260fd4a03c97f6988bbee365acab77fd6d4d31f2
    api
      .delete("/alerts", {
        params: {
          category: category && category !== "ALL" ? category : undefined,
          read_only: readOnly ? true : undefined,
        },
      })
      .then((res) => res.data),
};

// ==========================================
// Person Database Service (Identities)
// ==========================================
export const personsApi = {
  getPersons: (category = "", search = "") =>
    api
      .get("/persons", {
        params: {
          category: category && category !== "ALL" ? category : undefined,
          search: search || undefined,
        },
      })
      .then((res) => res.data),
  createPerson: (data) => api.post("/persons", data).then((res) => res.data),
  getPerson: (id) => api.get(`/persons/${id}`).then((res) => res.data),
  updatePerson: (id, data) =>
    api.put(`/persons/${id}`, data).then((res) => res.data),
  deletePerson: (id) => api.delete(`/persons/${id}`).then((res) => res.data),
  getModelStatus: () => api.get("/persons/model-status").then((res) => res.data),
  retrainModel: () => api.post("/persons/train").then((res) => res.data),
};

export default api;
