import { useEffect, useRef, useState } from 'react'
import { getSession } from 'next-auth/react'

export default function ConsultationPage({
  id,
  initial,
  role,
}: any) {
  const [consultation, setConsultation] = useState<any>(initial)
  const [joined, setJoined] = useState(false)
  const [connState, setConnState] = useState('idle')

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const processedMessagesRef = useRef<Set<string>>(new Set())
  const pendingIceRef = useRef<any[]>([])
  const leavingRef = useRef(false)

  async function sendSignal(type: string, payload: any) {
    const response = await fetch(
      `/api/consultations/${id}/signal`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          type,
          payload,
        }),
      }
    )

    if (!response.ok) {
      console.error(
        'Signal POST failed:',
        await response.text()
      )
    }
  }

  async function processMessages(
    pc: RTCPeerConnection,
    messages: any[]
  ) {
    for (const message of messages) {
      if (!message?.id) continue

      if (
        processedMessagesRef.current.has(
          message.id
        )
      ) {
        continue
      }

      processedMessagesRef.current.add(message.id)

      try {
        console.log(
          'Received signal:',
          message.type
        )

        if (message.type === 'offer') {
          /*
           * Only the participant who receives
           * the offer creates the answer.
           */
          if (pc.signalingState !== 'stable') {
            continue
          }

          await pc.setRemoteDescription(
            new RTCSessionDescription(
              message.payload
            )
          )

          // Apply ICE candidates that arrived
          // before the remote description.
          for (const candidate of pendingIceRef.current) {
            try {
              await pc.addIceCandidate(candidate)
            } catch (error) {
              console.warn(
                'Unable to add pending ICE:',
                error
              )
            }
          }

          pendingIceRef.current = []

          const answer =
            await pc.createAnswer()

          await pc.setLocalDescription(answer)

          await sendSignal(
            'answer',
            answer
          )
        }

        if (message.type === 'answer') {
          if (
            pc.signalingState ===
            'have-local-offer'
          ) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(
                message.payload
              )
            )

            for (const candidate of pendingIceRef.current) {
              try {
                await pc.addIceCandidate(
                  candidate
                )
              } catch (error) {
                console.warn(
                  'Unable to add pending ICE:',
                  error
                )
              }
            }

            pendingIceRef.current = []
          }
        }

        if (message.type === 'ice') {
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(
                message.payload
              )
            } catch (error) {
              console.warn(
                'Unable to add ICE:',
                error
              )
            }
          } else {
            pendingIceRef.current.push(
              message.payload
            )
          }
        }
      } catch (error) {
        console.error(
          'Signal processing failed:',
          error
        )
      }
    }
  }

  async function pollSignals(
    pc: RTCPeerConnection
  ) {
    try {
      const response = await fetch(
        `/api/consultations/${id}/signal`,
        {
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        console.error(
          'Signal GET failed:',
          response.status
        )
        return
      }

      const data = await response.json()

      console.log(
        'Signal poll:',
        data.messages?.map(
          (m: any) => m.type
        )
      )

      await processMessages(
        pc,
        data.messages || []
      )
    } catch (error) {
      console.error(
        'Signal polling error:',
        error
      )
    }
  }

  async function startPolling(
    pc: RTCPeerConnection
  ) {
    console.log(
      'Starting signal polling for consultation:',
      id
    )

    await pollSignals(pc)

    pollRef.current = setInterval(
      () => {
        void pollSignals(pc)
      },
      500
    )
  }

  async function join() {
    try {
      leavingRef.current = false
      processedMessagesRef.current.clear()
      pendingIceRef.current = []

      const auth = await fetch(
        `/api/consultations/${id}/join`,
        {
          method: 'POST',
        }
      )

      if (!auth.ok) {
        const data = await auth
          .json()
          .catch(() => ({}))

        alert(
          'Not authorized to join: ' +
            (data?.error || auth.status)
        )

        return
      }

      setConnState('starting')

      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
            video: true,
          }
        )

      localStreamRef.current = stream

      if (localVideoRef.current) {
        localVideoRef.current.srcObject =
          stream
      }

      const pc =
        new RTCPeerConnection({
          iceServers: [
            {
              urls:
                'stun:stun.l.google.com:19302',
            },
          ],
        })

      pcRef.current = pc

      stream
        .getTracks()
        .forEach((track) => {
          pc.addTrack(track, stream)
        })

      const remoteStream =
        new MediaStream()

      remoteStreamRef.current =
        remoteStream

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject =
          remoteStream
      }

      pc.ontrack = (event) => {
        console.log(
          'Remote track received:',
          event.track.kind
        )

        if (event.streams?.[0]) {
          event.streams[0]
            .getTracks()
            .forEach((track) => {
              if (
                !remoteStream
                  .getTracks()
                  .some(
                    (existing) =>
                      existing.id ===
                      track.id
                  )
              ) {
                remoteStream.addTrack(
                  track
                )
              }
            })
        } else {
          remoteStream.addTrack(
            event.track
          )
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject =
            remoteStream

          void remoteVideoRef.current
            .play()
            .catch(() => {})
        }
      }

      pc.onconnectionstatechange = () => {
        console.log(
          'Connection state:',
          pc.connectionState
        )

        setConnState(
          pc.connectionState
        )
      }

      pc.oniceconnectionstatechange =
        () => {
          console.log(
            'ICE connection state:',
            pc.iceConnectionState
          )
        }

      pc.onsignalingstatechange = () => {
        console.log(
          'Signaling state:',
          pc.signalingState
        )
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void sendSignal(
            'ice',
            event.candidate
          )
        }
      }

      /*
       * Start polling BEFORE negotiation.
       */
      await startPolling(pc)

      /*
       * IMPORTANT:
       *
       * Patient = offerer
       * Doctor = answerer
       *
       * The role comes directly from
       * getServerSideProps(), which uses the
       * authenticated NextAuth session.
       */
      console.log(
        'Consultation WebRTC role:',
        role
      )

      if (role === 'PATIENT') {
        const offer =
          await pc.createOffer()

        await pc.setLocalDescription(
          offer
        )

        await sendSignal(
          'offer',
          offer
        )

        console.log(
          'Patient offer sent'
        )
      } else {
        console.log(
          'Doctor waiting for patient offer'
        )
      }

      setJoined(true)
    } catch (error: any) {
      console.error(
        'Join failed:',
        error
      )

      setConnState('failed')

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          )

        localStreamRef.current = null
      }

      alert(
        'Unable to start consultation: ' +
          (error?.message ||
            'Unknown error')
      )
    }
  }

  async function leave() {
    if (leavingRef.current) {
      return
    }

    leavingRef.current = true

    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    if (pcRef.current) {
      pcRef.current.close()
      pcRef.current = null
    }

    if (localStreamRef.current) {
      localStreamRef.current
        .getTracks()
        .forEach((track) =>
          track.stop()
        )

      localStreamRef.current = null
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject =
        null
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject =
        null
    }

    remoteStreamRef.current = null
    pendingIceRef.current = []
    processedMessagesRef.current.clear()

    setJoined(false)
    setConnState('idle')

    try {
      await fetch(
        `/api/consultations/${id}/signal`,
        {
          method: 'POST',
          headers: {
            'content-type':
              'application/json',
          },
          body: JSON.stringify({
            type: 'control',
            payload: {
              event: 'left',
            },
          }),
        }
      )

      await fetch(
        `/api/consultations/${id}/leave`,
        {
          method: 'POST',
        }
      )
    } catch (error) {
      console.error(
        'Leave error:',
        error
      )
    }
  }

  function toggleAudio() {
    if (!localStreamRef.current) {
      return
    }

    localStreamRef.current
      .getAudioTracks()
      .forEach((track) => {
        track.enabled = !track.enabled
      })
  }

  function toggleVideo() {
    if (!localStreamRef.current) {
      return
    }

    localStreamRef.current
      .getVideoTracks()
      .forEach((track) => {
        track.enabled = !track.enabled
      })
  }

  return (
    <main className="container py-8">
      <h1 className="text-2xl font-semibold mb-4">
        Consultation
      </h1>

      <div className="mb-3">
        Status: {consultation?.status}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm mb-1">
            You
          </div>

          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-64 bg-black rounded"
          />
        </div>

        <div>
          <div className="text-sm mb-1">
            Other participant
          </div>

          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-64 bg-black rounded"
          />
        </div>
      </div>

      <div className="mt-4 space-x-2">
        {!joined && (
          <button
            onClick={join}
            className="px-3 py-2 bg-sky-600 text-white rounded"
          >
            Join
          </button>
        )}

        {joined && (
          <button
            onClick={leave}
            className="px-3 py-2 bg-red-600 text-white rounded"
          >
            Leave
          </button>
        )}

        <button
          onClick={toggleAudio}
          className="px-3 py-2 border rounded"
        >
          Toggle Mic
        </button>

        <button
          onClick={toggleVideo}
          className="px-3 py-2 border rounded"
        >
          Toggle Cam
        </button>
      </div>

      <div className="mt-2">
        Connection: {connState}
      </div>
    </main>
  )
}

export async function getServerSideProps(
  ctx: any
) {
  const session = await getSession(ctx)

  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    }
  }

  const { id } = ctx.query as any

  const r = await fetch(
    `${process.env.NEXTAUTH_URL || ''}/api/consultations/${id}`,
    {
      headers: ctx.req
        ? {
            cookie:
              ctx.req.headers.cookie || '',
          }
        : undefined,
    }
  )

  if (r.status !== 200) {
    return {
      redirect: {
        destination: '/dashboard',
        permanent: false,
      },
    }
  }

  const j = await r.json()

  return {
    props: {
      id,
      initial: j.consultation,
      role: (session.user as any).role,
    },
  }
}