import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { v4 as uuid } from 'uuid'
import './App.css'
import { ensureAmplifyConfigured } from './amplify/client'
import type { Session, TrackPoint } from './amplify/types'
import { MapView } from './components/MapView'
import { useLiveTracks } from './hooks/useLiveTracks'
import { useTrackRecorder } from './hooks/useTrackRecorder'
import {
  createSession,
  endSession as endSessionMutation,
  listTrackPointsByTime,
} from './services/appsyncService'

const DEVICE_ID_KEY = 'flyers:deviceId'
const SESSION_KEY = 'flyers:session'

const toDateTimeLocal = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const parseStoredSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as Session
  } catch (error) {
    console.warn('Failed to parse stored session', error)
    return null
  }
}

const persistSession = (session: Session | null) => {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

const loadDeviceId = () => {
  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) {
    return existing
  }
  const next = uuid()
  localStorage.setItem(DEVICE_ID_KEY, next)
  return next
}

const isSessionActive = (session: Session | null) =>
  Boolean(session && !session.endedAt)

function App() {
  const [deviceId] = useState(() => loadDeviceId())
  const [session, setSession] = useState<Session | null>(() =>
    parseStoredSession(),
  )
  const [nickname, setNickname] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [historyPoints, setHistoryPoints] = useState<TrackPoint[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const [historyStart, setHistoryStart] = useState(() =>
    toDateTimeLocal(new Date(Date.now() - 60 * 60 * 1000)),
  )
  const [historyEnd, setHistoryEnd] = useState(() =>
    toDateTimeLocal(new Date()),
  )

  useEffect(() => {
    ensureAmplifyConfigured()
  }, [])

  const handleRecorderError = useCallback((message: string) => {
    setErrorMessage(message)
  }, [])

  const {
    points: selfPoints,
    isTracking,
    lastSyncAt,
    stop: stopRecorder,
    flushNow,
  } = useTrackRecorder({
    session,
    autoStart: true,
    onError: handleRecorderError,
  })

  const { grouped: peerTracks, lastFetchedAt } = useLiveTracks({
    enabled: true,
    trackWindowMinutes: 15,
    pollingIntervalMs: 15000,
    excludeTrackId: session?.sessionId,
    onError: handleRecorderError,
  })

  useEffect(() => {
    persistSession(session)
  }, [session])

  const startSession = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setErrorMessage(null)
      const trimmed = nickname.trim()
      const nicknameToUse =
        trimmed || `ゲスト-${deviceId.slice(0, 4).toUpperCase()}`

      setIsSubmitting(true)
      try {
        const newSession: Session = await createSession({
          sessionId: uuid(),
          nickname: nicknameToUse,
          deviceId,
          startedAt: new Date().toISOString(),
        })

        setSession(newSession)
        setNickname('')
        setStatusMessage('セッションを開始しました。')
      } catch (error) {
        console.error('Failed to create session', error)
        setErrorMessage('セッションの作成に失敗しました。再度お試しください。')
      } finally {
        setIsSubmitting(false)
      }
    },
    [deviceId, nickname],
  )

  const endSession = useCallback(async () => {
    if (!session) {
      return
    }

    setIsEnding(true)
    setErrorMessage(null)
    try {
      stopRecorder()
      await flushNow()
      const ended = await endSessionMutation({
        sessionId: session.sessionId,
        endedAt: new Date().toISOString(),
      })
      setSession(ended)
      setStatusMessage('セッションを終了しました。お疲れさまでした。')
    } catch (error) {
      console.error('Failed to end session', error)
      setErrorMessage('セッションの終了に失敗しました。通信状況をご確認ください。')
    } finally {
      setIsEnding(false)
    }
  }, [flushNow, session, stopRecorder])

  const loadHistory = useCallback(async () => {
    if (!historyStart || !historyEnd) {
      setErrorMessage('時間範囲を入力してください。')
      return
    }

    const startDate = new Date(historyStart)
    const endDate = new Date(historyEnd)
    if (startDate >= endDate) {
      setErrorMessage('開始時刻は終了時刻より前に設定してください。')
      return
    }

    setIsLoadingHistory(true)
    setErrorMessage(null)
    try {
      const data = await listTrackPointsByTime({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        limit: 5000,
      })
      const sorted = [...data].sort(
        (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime(),
      )
      setHistoryPoints(sorted)
      setStatusMessage('履歴データを読み込みました。')
    } catch (error) {
      console.error('Failed to load history', error)
      setErrorMessage('履歴データの取得に失敗しました。')
    } finally {
      setIsLoadingHistory(false)
    }
  }, [historyEnd, historyStart])

  const activePoint = useMemo(
    () => selfPoints[selfPoints.length - 1] ?? null,
    [selfPoints],
  )

  const isActive = isSessionActive(session)

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Flyers Tracker</h1>
          <p className="app__subtitle">
            ニックネームだけで参加できるリアルタイム軌跡共有
          </p>
        </div>
        {isActive ? (
          <button
            className="button button--danger"
            onClick={endSession}
            disabled={isEnding}
          >
            {isEnding ? '終了中...' : 'セッションを終了'}
          </button>
        ) : null}
      </header>

      <main className="app__main">
        <section className="panel">
          <h2>参加</h2>
          {isActive ? (
            <div className="status-box">
              <div>
                <strong>{session?.nickname}</strong> として参加中
              </div>
              <div className="status-box__meta">
                開始時刻: {session?.startedAt}
              </div>
              <div className="status-box__meta">
                {isTracking
                  ? '位置情報を取得しています。'
                  : '位置情報は停止しています。'}
                {lastSyncAt
                  ? ` 最終送信: ${new Date(lastSyncAt).toLocaleTimeString()}`
                  : null}
              </div>
            </div>
          ) : (
              <form className="form" onSubmit={startSession}>
              <label className="form__label" htmlFor="nickname">
                ニックネーム（任意）
              </label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                placeholder="例: Flyers太郎"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="form__input"
                autoComplete="off"
              />
              <button
                type="submit"
                className="button button--primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? '参加中...' : 'セッションを開始'}
              </button>
            </form>
          )}

          <div className="history">
            <h3>履歴を表示</h3>
            <div className="history__inputs">
              <label className="form__label" htmlFor="history-start">
                開始
              </label>
              <input
                id="history-start"
                type="datetime-local"
                className="form__input"
                value={historyStart}
                onChange={(event) => setHistoryStart(event.target.value)}
              />

              <label className="form__label" htmlFor="history-end">
                終了
              </label>
              <input
                id="history-end"
                type="datetime-local"
                className="form__input"
                value={historyEnd}
                onChange={(event) => setHistoryEnd(event.target.value)}
              />
            </div>
            <button
              className="button"
              onClick={loadHistory}
              disabled={isLoadingHistory}
            >
              {isLoadingHistory ? '読み込み中...' : '履歴を取得'}
            </button>
            <div className="history__meta">
              表示中の点数: {historyPoints.length}
            </div>
          </div>

          <div className="status">
            {statusMessage ? (
              <p className="status__message">{statusMessage}</p>
            ) : null}
            {errorMessage ? (
              <p className="status__error">{errorMessage}</p>
            ) : null}
          </div>

          <div className="meta">
            <span>端末ID: {deviceId.slice(0, 8)}...</span>
            <span>
              他参加者の更新:{' '}
              {lastFetchedAt
                ? new Date(lastFetchedAt).toLocaleTimeString()
                : '取得前'}
            </span>
          </div>
        </section>

        <section className="panel panel--map">
          <MapView
            selfPoints={selfPoints}
            peers={peerTracks}
            history={historyPoints}
            focus={activePoint}
          />
        </section>
      </main>
    </div>
  )
}

export default App
