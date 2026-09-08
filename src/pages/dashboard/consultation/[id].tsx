import { useEffect, useRef, useState } from 'react'
import { getSession } from 'next-auth/react'

export default function ConsultationPage({ id, initial }: any){
  const [consultation, setConsultation] = useState<any>(initial)
  const [joined, setJoined] = useState(false)
  const [connState, setConnState] = useState('idle')
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const pollRef = useRef<any>(null)

  useEffect(()=>{
    return ()=>{ leave() }
  },[])

  async function fetchDetails(){
    const r = await fetch(`/api/consultations/${id}`)
    const j = await r.json()
    setConsultation(j.consultation)
  }

  async function join(){
    setConnState('starting')
    // get media
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    localStreamRef.current = stream
    if (localVideoRef.current) localVideoRef.current.srcObject = stream

    const pc = new RTCPeerConnection()
    pcRef.current = pc
    stream.getTracks().forEach(t=>pc.addTrack(t, stream))
    const remoteStream = new MediaStream()
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
    pc.ontrack = (ev)=>{ ev.streams[0].getTracks().forEach(t=>remoteStream.addTrack(t)) }
    pc.onconnectionstatechange = ()=> setConnState(pc.connectionState)

    pc.onicecandidate = (ev)=>{ if (ev.candidate) fetch(`/api/consultations/${id}/signal`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ type:'ice', payload: ev.candidate })}) }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await fetch(`/api/consultations/${id}/signal`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ type:'offer', payload: offer })})

    // poll for answer/ice
    pollRef.current = setInterval(async ()=>{
      const r = await fetch(`/api/consultations/${id}/signal`)
      const j = await r.json()
      for (const m of j.messages || []){
        if (m.type === 'answer'){
          await pc.setRemoteDescription(new RTCSessionDescription(m.payload))
        }else if (m.type === 'ice'){
          try{ await pc.addIceCandidate(m.payload) }catch(e){ }
        }
      }
    },1000)

    setJoined(true)
  }

  async function leave(){
    if (pollRef.current) clearInterval(pollRef.current)
    if (pcRef.current){ pcRef.current.close(); pcRef.current = null }
    if (localStreamRef.current){ localStreamRef.current.getTracks().forEach(t=>t.stop()); localStreamRef.current=null }
    setJoined(false)
    setConnState('idle')
    // notify server for audit
    await fetch(`/api/consultations/${id}/signal`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ type:'control', payload: { event: 'left' } })})
  }

  async function toggleAudio(){ if (!localStreamRef.current) return; const tracks = localStreamRef.current.getAudioTracks(); tracks.forEach(t=>t.enabled = !t.enabled) }
  async function toggleVideo(){ if (!localStreamRef.current) return; const tracks = localStreamRef.current.getVideoTracks(); tracks.forEach(t=>t.enabled = !t.enabled) }

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold mb-4">Consultation</h1>
      <div className="mb-3">Status: {consultation?.status}</div>
      <div className="grid grid-cols-2 gap-4">
        <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-64 bg-black" />
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-64 bg-black" />
      </div>
      <div className="mt-4 space-x-2">
        {!joined && <button onClick={join} className="px-3 py-2 bg-sky-600 text-white rounded">Join</button>}
        {joined && <button onClick={leave} className="px-3 py-2 bg-red-600 text-white rounded">Leave</button>}
        <button onClick={toggleAudio} className="px-3 py-2 border rounded">Toggle Mic</button>
        <button onClick={toggleVideo} className="px-3 py-2 border rounded">Toggle Cam</button>
      </div>
      <div className="mt-2">Connection: {connState}</div>
    </main>
  )
}

export async function getServerSideProps(ctx:any){
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  const { id } = ctx.query as any
  const r = await fetch(`${process.env.NEXTAUTH_URL || ''}/api/consultations/${id}`, { headers: ctx.req ? { cookie: ctx.req.headers.cookie || '' } : undefined })
  if (r.status !== 200) return { redirect: { destination: '/dashboard', permanent: false } }
  const j = await r.json()
  return { props: { id, initial: j.consultation } }
}
