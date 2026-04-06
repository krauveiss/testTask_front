const fallbackApiUrl = "http://127.0.0.1:8000/api";

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL?.trim() || fallbackApiUrl
).replace(/\/+$/, "");

export const API_ORIGIN = API_BASE_URL.replace(/\/api$/i, "");

