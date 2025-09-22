import axios from 'axios'

const api = axios.create({
  // Use relative path; Vite dev server proxy or same-origin in production
  baseURL: '/api/ai'
})

export const getVapiToken = async () => {
  const { data } = await api.post('/vapi/token')
  return data
}

export const searchHotels = async (q) => {
  const { data } = await api.get('/hotels', { params: { q } })
  return data
}

export const getAvailability = async (params) => {
  const { data } = await api.get('/availability', { params })
  return data
}

export default {
  getVapiToken,
  searchHotels,
  getAvailability
}



