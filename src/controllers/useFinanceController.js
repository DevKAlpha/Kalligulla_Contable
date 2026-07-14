import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addMovementToFinanceData, buildCashFlow, createMovement, exportFinanceCsv, importFinanceCsv,
  loadFinanceData, removeMovementFromFinanceData, saveFinanceData,
} from '../models/financeModel.js'

export function useFinanceController() {
  const [data, setData] = useState(loadFinanceData)
  const [activeView, setActiveView] = useState(() => window.location.hash.slice(1) || 'inicio')
  const [modalOpen, setModalOpen] = useState(false)
  const [movementType, setMovementType] = useState('expense')
  const [goalOpen, setGoalOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => saveFinanceData(data), [data])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const navigate = useCallback((viewId) => {
    setActiveView(viewId)
    window.history.replaceState(null, '', viewId === 'inicio' ? window.location.pathname : `#${viewId}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    window.requestAnimationFrame(() => {
      document.querySelector('.screen-content')?.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }, [])

  const addMovement = useCallback((values) => {
    try {
      const movement = createMovement(values)
      setData((current) => addMovementToFinanceData(current, movement))
      setModalOpen(false)
      navigate('inicio')
      setToast('Movimiento guardado en este dispositivo')
      return true
    } catch (error) {
      setToast(error.message)
      return false
    }
  }, [navigate])

  const removeMovement = useCallback((movementId) => {
    setData((current) => removeMovementFromFinanceData(current, movementId))
    setToast('Registro eliminado')
  }, [])

  const goalProgress = useMemo(
    () => data.goal.target > 0 ? Math.min(100, (data.goal.current / data.goal.target) * 100) : 0,
    [data.goal],
  )
  const cashFlow = useMemo(() => buildCashFlow(data.movements), [data.movements])

  const saveGoal = useCallback((values) => {
    const current = Number(values.current)
    const target = Number(values.target)
    if (!values.name?.trim() || !Number.isFinite(current) || !Number.isFinite(target) || current < 0 || target <= 0) {
      setToast('Completa la meta con valores válidos')
      return false
    }
    setData((state) => ({ ...state, goal: { name: values.name.trim(), current, target } }))
    setGoalOpen(false)
    setToast('Meta actualizada')
    return true
  }, [])

  const clearGoal = useCallback(() => {
    setData((state) => ({ ...state, goal: { name: 'Meta de ahorro', current: 0, target: 0 } }))
    setToast('Meta eliminada')
  }, [])

  const downloadBackup = useCallback(() => {
    const blob = new Blob([exportFinanceCsv(data)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kaligula-backup-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setToast('Respaldo CSV descargado')
  }, [data])

  const restoreBackup = useCallback(async (file) => {
    try {
      const restored = importFinanceCsv(await file.text())
      setData(restored)
      setBackupOpen(false)
      navigate('inicio')
      setToast('Respaldo restaurado correctamente')
      return true
    } catch (error) {
      setToast(error.message)
      return false
    }
  }, [navigate])

  return {
    data, activeView, modalOpen, movementType, goalOpen, backupOpen, toast, goalProgress, cashFlow,
    navigate,
    openMovementModal: (type = 'expense') => {
      setMovementType(typeof type === 'string' ? type : 'expense')
      setModalOpen(true)
    },
    closeMovementModal: () => setModalOpen(false),
    openGoal: () => setGoalOpen(true),
    closeGoal: () => setGoalOpen(false),
    openBackup: () => setBackupOpen(true),
    closeBackup: () => setBackupOpen(false),
    notify: setToast,
    addMovement,
    removeMovement,
    saveGoal,
    clearGoal,
    downloadBackup,
    restoreBackup,
  }
}
