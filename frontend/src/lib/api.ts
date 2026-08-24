import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3141",
  withCredentials: true,
});

// On a 401 from an expired access token, try one silent refresh then retry the
// original request; if the refresh also fails, surface the 401 to the caller.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      try {
        await api.post("/api/auth/refresh");
        return api(original);
      } catch {
        // fall through to reject
      }
    }
    return Promise.reject(error);
  }
);
