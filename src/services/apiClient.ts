interface ApiResponse<T = unknown> {
  data: T
  success: boolean
  message?: string
  error?: string
}

interface ApiError {
  message: string
  status: number
  code?: string
}

class ApiClient {
  private baseUrl: string
  private defaultHeaders: Record<string, string>

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()

      if (!response.ok) {
        throw {
          message: data.message || 'Request failed',
          status: response.status,
          code: data.code,
        } as ApiError
      }

      return {
        data: data.data || data,
        success: true,
        message: data.message,
      }
    } catch (error) {
      if (error instanceof TypeError) {
        // Network error
        throw {
          message: 'Network error - please check your connection',
          status: 0,
        } as ApiError
      }
      
      throw error as ApiError
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string | number>): Promise<ApiResponse<T>> {
    const searchParams = params ? new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {} as Record<string, string>)
    ).toString() : ''
    const url = searchParams ? `${endpoint}?${searchParams}` : endpoint
    
    return this.request<T>(url, {
      method: 'GET',
    })
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    })
  }

  async upload<T>(
    endpoint: string, 
    formData: FormData,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<T>> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText)
          
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({
              data: data.data || data,
              success: true,
              message: data.message,
            })
          } else {
            reject({
              message: data.message || 'Upload failed',
              status: xhr.status,
              code: data.code,
            } as ApiError)
          }
        } catch (error) {
          reject({
            message: 'Invalid response format',
            status: xhr.status,
          } as ApiError)
        }
      })

      xhr.addEventListener('error', () => {
        reject({
          message: 'Upload failed',
          status: xhr.status || 0,
        } as ApiError)
      })

      xhr.open('POST', `${this.baseUrl}${endpoint}`)
      xhr.send(formData)
    })
  }

  setAuthToken(token: string) {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  removeAuthToken() {
    delete this.defaultHeaders['Authorization']
  }
}

export const apiClient = new ApiClient()
export type { ApiResponse, ApiError }