const PROVIDER = process.env.MAPS_PROVIDER || 'google'
const API_KEY = process.env.MAPS_API_KEY || ''

type HospitalResult = {
  id: string
  name: string
  address?: string
  distanceMeters?: number
  lat?: number
  lng?: number
  phone?: string | null
}

function computeDistanceMeters(a:{lat:number,lng:number}, b:{lat:number,lng:number}){
  try{
    const toRad = (v:number)=> v * Math.PI/180
    const R = 6371000 // meters
    const dLat = toRad(b.lat - a.lat)
    const dLon = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const sinDLat = Math.sin(dLat/2)
    const sinDLon = Math.sin(dLon/2)
    const aa = sinDLat*sinDLat + sinDLon*sinDLon * Math.cos(lat1) * Math.cos(lat2)
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa))
    return Math.round(R * c)
  }catch(e){ return undefined }
}

export async function findNearbyHospitals(lat?:number, lng?:number, q?:string, radius=5000, limit=10): Promise<HospitalResult[]>{
  if (PROVIDER === 'mapbox'){
    if (!API_KEY) throw new Error('MAPS_API_KEY not configured')
    // Mapbox forward geocoding for 'hospital' category near proximity
    const prox = (lng!==undefined && lat!==undefined) ? `&proximity=${lng},${lat}` : ''
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/hospital.json?access_token=${API_KEY}&limit=${limit}${prox}`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Mapbox error')
    const j = await res.json()
    const results: HospitalResult[] = j.features.map((f:any)=>{
      const [lngf, latf] = f.center
      const out: HospitalResult = { id: f.id, name: f.text, address: f.place_name, lat: latf, lng: lngf }
      if (lat && lng) out.distanceMeters = computeDistanceMeters({lat,lng},{lat:latf,lng:lngf})
      return out
    })
    return results
  }

  // default: google places
  if (!API_KEY) throw new Error('MAPS_API_KEY not configured')
  if (!lat || !lng){
    // Google Places requires location; if missing, fall back to text search using Places Text Search
    if (!q) throw new Error('Either lat/lng or query required')
    const turl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q+' hospital')}&key=${API_KEY}&type=hospital&pagetoken=`
    const tres = await fetch(turl)
    if (!tres.ok) throw new Error('Google Places error')
    const tj = await tres.json()
    return (tj.results||[]).slice(0,limit).map((r:any)=>({ id: r.place_id, name: r.name, address: r.formatted_address || r.vicinity, lat: r.geometry?.location?.lat, lng: r.geometry?.location?.lng }))
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=hospital&key=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Google Places error')
  const j = await res.json()
  const out = (j.results||[]).slice(0,limit).map((r:any)=>{
    const o: HospitalResult = { id: r.place_id, name: r.name, address: r.vicinity || r.formatted_address, lat: r.geometry?.location?.lat, lng: r.geometry?.location?.lng }
    if (lat && lng && o.lat && o.lng) o.distanceMeters = computeDistanceMeters({lat,lng},{lat:o.lat,lng:o.lng})
    return o
  })
  return out
}

export type { HospitalResult }
