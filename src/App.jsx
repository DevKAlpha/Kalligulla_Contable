import { useFinanceController } from './controllers/useFinanceController.js'
import { AppView } from './views/AppView.jsx'

export default function App() {
  const controller = useFinanceController()
  return <AppView controller={controller} />
}
