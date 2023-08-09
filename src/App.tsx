import { Event, SimplePool, nip19, relayInit } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { useDebounce } from 'use-debounce'

import { Spinner } from './components'

const SourceRelays = [
  'wss://relay.damus.io',
  'wss://offchain.pub',
  'wss://eden.nostr.land',
  'wss://nostr.wine',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://relay.current.fyi',
]

const npubRegex = /^npub1[0-9a-z]{58}$/
const relayRegex = /^wss:\/\/[0-9a-z.-]+(:[0-9]+)?\/?$/

function App() {
  // TODO: implement user input for source relays
  const [sourceRelays, setSourceRelays] = useState<string[]>(SourceRelays)
  const [targetRelay, setTargetRelay] = useState<string>('')
  const [sourcePool, setSourcePool] = useState<SimplePool | null>(null)

  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [npub, setNpub] = useState('')

  const [eventsImmediate, setEvents] = useState<Event[]>([])
  const [events] = useDebounce(eventsImmediate, 5000)
  const [syncedEventCount, setSyncedEventCount] = useState(0)
  const [noteCount, setNoteCount] = useState(0)
  const [profileCount, setProfileCount] = useState(0)
  const [otherCount, setOtherCount] = useState(0)

  const handleSync = () => {
    if (!npubRegex.test(npub)) {
      alert('Invalid npub')
      return
    }

    if (!relayRegex.test(targetRelay)) {
      alert('Invalid relay url')
      return
    }

    setLoading(true)
    setCompleted(false)
    setEvents([])
    setSyncedEventCount(0)
    setNoteCount(0)
    setProfileCount(0)
    setOtherCount(0)

    const pool = new SimplePool()
    setSourcePool(pool)
    const sub = pool.sub(sourceRelays, [
      {
        limit: 1000,
        authors: [nip19.decode(npub).data.toString()],
      },
    ])

    sub.on('event', (data) => {
      setEvents((events) => [...events, data])
    })

    sub.on('eose', () => {
      sub.unsub()
    })
  }

  const publishEvents = async () => {
    if (events.length === 0 || !loading) return

    try {
      const relay = relayInit(targetRelay)
      relay.on('connect', () => {
        console.log(`connected to ${relay.url}`)
      })
      relay.on('error', () => {
        console.log(`failed to connect to ${relay.url}`)
      })
      relay.on('disconnect', () => {
        console.log(`disconnected from ${relay.url}`)
      })

      await relay.connect()

      let syncedEvents: string[] = []
      for (const e of events) {
        if (syncedEvents.includes(e.id)) continue

        await relay.publish(e)
        syncedEvents.push(e.id)
        setSyncedEventCount((count) => count + 1)
        if (e.kind === 0) {
          setProfileCount((count) => count + 1)
        } else if (e.kind === 1) {
          setNoteCount((count) => count + 1)
        } else {
          setOtherCount((count) => count + 1)
        }
      }

      relay.close()
      if (sourcePool) {
        sourcePool.close(sourceRelays)
        setSourcePool(null)
      }
    } catch (e) {
      console.log(e)
    }

    setLoading(false)
    setCompleted(true)
  }

  useEffect(() => {
    publishEvents()
  }, [events])

  return (
    <div className="flex flex-col items-center max-md:w-full w-[768px] mx-auto">
      <h1 className="text-3xl font-bold mb-4">Nostr Sync</h1>

      <input
        className="input w-full h-10 rounded-lg px-4 mb-4"
        autoFocus
        placeholder="Enter your npub..."
        value={npub}
        onChange={(e) => setNpub(e.target.value)}
      />
      <input
        className="input w-full h-10 rounded-lg px-4 mb-4"
        autoFocus
        placeholder="Enter your target relay start with wss://..."
        value={targetRelay}
        onChange={(e) => setTargetRelay(e.target.value)}
      />

      <button
        className="btn w-[128px] h-[48px] mb-4 text-center"
        disabled={loading}
        onClick={handleSync}
      >
        {loading ? <Spinner /> : 'Sync'}
      </button>

      {completed && (
        <div className="font-bold mb-4">
          ✅ {syncedEventCount} events synced ({noteCount} notes, {profileCount} profiles,{' '}
          {otherCount} others)
        </div>
      )}

      <div className="flex flex-col w-full gap-3">
        <div className="card">
          <div className="text-md font-bold text-center mb-2">Target Relay</div>
          <div className="text-sm font-bold">- {targetRelay}</div>
        </div>
        <div className="card">
          <div className="text-md font-bold text-center mb-2">Source Relays</div>
          {sourceRelays.map((relay, index) => (
            <div key={index} className="text-sm font-bold">
              - {relay}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
