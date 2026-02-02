// Centralized configuration for the frontend app
// NEXT_PUBLIC_API_URL should include /api, e.g., https://api.example.com/api

const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const API_URL = envUrl;
export const API_BASE_URL = envUrl.replace(/\/api\/?$/, '');

// Helper function to build API URLs
export function apiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_URL}/${cleanPath}`;
}

// Helper function to build base URLs (for things like avatar images)
export function baseUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
}
