export function ConsoleController({ side }) {
  if (side === 'left') {
    return (
      <aside className="controller controller-left" aria-hidden="true">
        <span className="minus-control" />
        <div className="analog-stick"><span /></div>
        <div className="d-pad"><i className="up" /><i className="right" /><i className="down" /><i className="left" /><b /></div>
        <span className="controller-led" />
      </aside>
    )
  }
  return (
    <aside className="controller controller-right" aria-hidden="true">
      <span className="plus-control" />
      <div className="action-buttons"><i>A</i><i>B</i><i>X</i><i>Y</i></div>
      <div className="analog-stick lower"><span /></div>
      <span className="home-control">⌂</span>
    </aside>
  )
}
